import { timingSafeEqual } from "node:crypto";
import {
  readWorkbookFiles,
  prepareWorkbook,
  WorkbookError,
} from "../services/workbook-service";
import { sendRecords, IntegrationError } from "../services/gcc-service";
import { submissionOrder } from "../models/workbook-catalog";

export async function workbookController(request: Request) {
  const reply = (body: unknown, status = 200) =>
    Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
  if (
    request.headers.get("origin") &&
    request.headers.get("origin") !== new URL(request.url).origin
  )
    return reply({ error: "Origem não permitida." }, 403);
  const send = new URL(request.url).searchParams.get("action") === "send";
  if (send) {
    const expected = process.env.COLLECTOR_ACCESS_TOKEN ?? "";
    const supplied =
      request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
    if (expected.length < 32)
      return reply(
        { error: "O acesso ao coletor ainda não foi configurado no servidor." },
        503,
      );
    const a = Buffer.from(expected);
    const b = Buffer.from(supplied);
    if (a.length !== b.length || !timingSafeEqual(a, b))
      return reply({ error: "Código de acesso ao coletor inválido." }, 401);
  }
  if (!request.headers.get("content-type")?.startsWith("multipart/form-data"))
    return reply(
      { error: "Envie os arquivos pelo formulário de importação." },
      400,
    );
  try {
    const reader = request.body?.getReader();
    if (!reader) return reply({ error: "Arquivo ausente." }, 400);
    const chunks: Uint8Array[] = [];
    let length = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 5_100_000) {
        await reader.cancel();
        return reply({ error: "Limite de 5 MB por importação." }, 413);
      }
      chunks.push(value);
    }
    const form = await new Response(Buffer.concat(chunks), {
      headers: { "Content-Type": request.headers.get("content-type")! },
    }).formData();
    const files = form
      .getAll("files")
      .filter((value): value is File => value instanceof File);
    const instrument = String(form.get("instrument") ?? "");
    const prepared = prepareWorkbook(
      await readWorkbookFiles(files),
      instrument,
    );
    if (!send) return reply(prepared.preview);
    if (prepared.preview.errors.length)
      return reply(
        {
          error: "Corrija as pendências de todas as tabelas antes de enviar.",
          errors: prepared.preview.errors,
        },
        422,
      );
    const kind = submissionOrder.find((item) => item === form.get("kind"));
    if (!kind || !prepared.records[kind]?.length)
      return reply({ error: "Etapa de envio inválida ou vazia." }, 400);
    return reply(
      await sendRecords(kind, prepared.preview.code, prepared.records[kind]!),
    );
  } catch (error) {
    return reply(
      {
        error:
          error instanceof WorkbookError || error instanceof IntegrationError
            ? error.message
            : "Não foi possível processar os arquivos. Confira o modelo e tente novamente.",
      },
      error instanceof IntegrationError ? 502 : 400,
    );
  }
}
