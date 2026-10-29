import {
  getPrincipal,
  type Principal,
} from "../../auth/controllers/access-controller";
import { getCredentialService } from "../../../shared/lib/credentials/server";
import { CredentialError } from "../../credentials/services/credential-service";
import { credentialIdSchema } from "../../credentials/schemas/credential-input";
import { isSameOrigin } from "../../../shared/lib/security/request";
import {
  readWorkbookFiles,
  prepareWorkbook,
  WorkbookError,
} from "../services/workbook-service";
import { sendRecords, IntegrationError } from "../services/gcc-service";
import { submissionOrder } from "../models/workbook-catalog";

type WorkbookDependencies = {
  getPrincipal: (headers: Headers) => Promise<Principal | null>;
  getGccSecret: (owner: string, id: string) => Promise<string>;
  sendRecords: typeof sendRecords;
};
export function createWorkbookController(dependencies: WorkbookDependencies) {
  return async function workbookController(request: Request) {
    const reply = (body: unknown, status = 200) =>
      Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
    if (!isSameOrigin(request))
      return reply({ error: "Origem não permitida." }, 403);
    let principal: Principal | null;
    try {
      principal = await dependencies.getPrincipal(request.headers);
    } catch {
      return reply(
        {
          error:
            "Autenticação indisponível. Confira a configuração do servidor.",
        },
        503,
      );
    }
    if (!principal)
      return reply({ error: "Entre com sua conta institucional." }, 401);
    const send = new URL(request.url).searchParams.get("action") === "send";
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
      const credentialId = form.get("credentialId");
      if (send && !credentialIdSchema.safeParse(credentialId).success)
        return reply(
          { error: "Selecione uma chave GCC cadastrada na sua conta." },
          400,
        );
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
        await dependencies.sendRecords(
          kind,
          prepared.preview.code,
          prepared.records[kind]!,
          await dependencies.getGccSecret(principal.id, String(credentialId)),
        ),
      );
    } catch (error) {
      return reply(
        {
          error:
            error instanceof WorkbookError ||
            error instanceof IntegrationError ||
            error instanceof CredentialError
              ? error.message
              : "Não foi possível processar os arquivos. Confira o modelo e tente novamente.",
        },
        error instanceof IntegrationError
          ? 502
          : error instanceof CredentialError
            ? 404
            : error instanceof WorkbookError
              ? 400
              : 503,
      );
    }
  };
}
export const workbookController = createWorkbookController({
  getPrincipal,
  getGccSecret: (owner, id) => getCredentialService().getGccSecret(owner, id),
  sendRecords,
});
