import { credentialController } from "../../../modules/credentials/controllers/credential-controller";
export const runtime = "nodejs";
export function GET(request: Request) {
  return credentialController(request);
}
export function POST(request: Request) {
  return credentialController(request);
}
