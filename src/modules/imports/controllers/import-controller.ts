import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { parseCsv } from "../services/csv-service";
import { sendRecords, IntegrationError } from "../services/gcc-service";

const inputSchema = z.object({
  kind: z.enum([
    "contratos",
    "documentos_fiscais",
    "pagamentos",
    "funcionarios",
    "servidores_cedidos",
  ]),
  code: z.string().trim().min(1).max(100),
  csv: z.string().min(1).max(2_000_000),
});
export async function importController(request: Request) {
  const reply = (body: unknown, status = 200) =>
    Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    return reply({ error: "Origem não permitida." }, 403);
  const expected = process.env.COLLECTOR_ACCESS_TOKEN;
  const supplied =
    request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (!expected || expected.length < 32)
    return reply(
      { error: "O acesso ao coletor ainda não foi configurado no servidor." },
      503,
    );
  const a = Buffer.from(expected);
  const b = Buffer.from(supplied);
  if (a.length !== b.length || !timingSafeEqual(a, b))
    return reply({ error: "Código de acesso ao coletor inválido." }, 401);
  if (Number(request.headers.get("content-length")) > 2_100_000)
    return reply({ error: "Arquivo muito grande." }, 413);
  let raw: string;
  try {
    const reader = request.body?.getReader();
    if (!reader) return reply({ error: "Requisição vazia." }, 400);
    const chunks: Uint8Array[] = [];
    let length = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 2_100_000) {
        await reader.cancel();
        return reply({ error: "Arquivo muito grande." }, 413);
      }
      chunks.push(value);
    }
    raw = Buffer.concat(chunks).toString("utf8");
  } catch {
    return reply({ error: "Não foi possível ler o arquivo." }, 400);
  }
  let input;
  try {
    input = inputSchema.safeParse(JSON.parse(raw));
  } catch {
    return reply({ error: "Requisição inválida." }, 400);
  }
  if (!input.success)
    return reply(
      {
        error:
          "Verifique o tipo de importação, código do ajuste e tamanho do arquivo.",
      },
      400,
    );
  const preview = parseCsv(input.data.csv, input.data.kind);
  if (preview.errors.length)
    return reply(
      { error: "Corrija a planilha antes de enviar.", errors: preview.errors },
      422,
    );
  try {
    return reply(
      await sendRecords(input.data.kind, input.data.code, preview.records),
    );
  } catch (error) {
    return reply(
      {
        error:
          error instanceof IntegrationError
            ? error.message
            : "Não foi possível processar a importação.",
      },
      502,
    );
  }
}
