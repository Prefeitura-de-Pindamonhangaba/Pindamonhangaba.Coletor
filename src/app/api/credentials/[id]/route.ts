import { credentialController } from "../../../../modules/credentials/controllers/credential-controller";
export const runtime = "nodejs";
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return credentialController(request, (await context.params).id);
}
