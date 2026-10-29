import { getAuth } from "../../../../shared/lib/auth/server";
import { isKeycloakEnabled } from "../../../../modules/auth/services/keycloak-config";
export const runtime = "nodejs";
async function handle(request: Request) {
  try {
    if (!isKeycloakEnabled())
      return Response.json(
        { error: "Login institucional ainda não configurado." },
        { status: 503 },
      );
    return await getAuth().handler(request);
  } catch {
    return Response.json(
      { error: "Não foi possível concluir a autenticação." },
      { status: 503 },
    );
  }
}
export const GET = handle;
export const POST = handle;
