import { getDatabase } from "../db/client";
import { parseAuthEnvironment } from "../../../modules/auth/services/keycloak-config";
import { createAuthService } from "../../../modules/auth/services/auth-service";
let instance: ReturnType<typeof createAuthService> | undefined;
export function getAuth() {
  instance ??= createAuthService(
    getDatabase(),
    parseAuthEnvironment(process.env),
  );
  return instance;
}
