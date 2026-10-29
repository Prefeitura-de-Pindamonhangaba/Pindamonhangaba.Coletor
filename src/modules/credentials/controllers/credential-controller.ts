import { getPrincipal } from "../../auth/controllers/access-controller";
import {
  isSameOrigin,
  readJsonBody,
} from "../../../shared/lib/security/request";
import { getCredentialService } from "../../../shared/lib/credentials/server";
import {
  createCredentialSchema,
  updateCredentialSchema,
  credentialIdSchema,
} from "../schemas/credential-input";
import { CredentialError } from "../services/credential-service";
export async function credentialController(request: Request, id?: string) {
  const reply = (body: unknown, status = 200) =>
    Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
  if (request.method !== "GET" && !isSameOrigin(request))
    return reply({ error: "Origem não permitida." }, 403);
  try {
    const principal = await getPrincipal(request.headers);
    if (!principal)
      return reply({ error: "Entre com sua conta institucional." }, 401);
    const service = getCredentialService();
    if (request.method === "GET")
      return reply(await service.list(principal.id));
    let body: unknown;
    try {
      body = await readJsonBody(request);
    } catch {
      return reply({ error: "Requisição inválida ou muito grande." }, 400);
    }
    if (request.method === "POST") {
      const parsed = createCredentialSchema.safeParse(body);
      if (!parsed.success)
        return reply(
          {
            error:
              "Informe sistema, nome da chave (até 100 caracteres) e segredo válido.",
          },
          400,
        );
      return reply(await service.create(principal.id, parsed.data), 201);
    }
    const parsed = updateCredentialSchema.safeParse(body);
    if (!credentialIdSchema.safeParse(id).success || !parsed.success)
      return reply({ error: "Dados da chave inválidos." }, 400);
    return reply(await service.update(principal.id, id!, parsed.data));
  } catch (error) {
    if (error instanceof CredentialError)
      return reply({ error: error.message }, 404);
    return reply(
      {
        error:
          "Não foi possível salvar ou consultar as chaves. Verifique se o nome já está em uso para esse sistema e se o servidor está configurado.",
      },
      503,
    );
  }
}
