import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "../../../shared/lib/auth/server";
import { getDatabase } from "../../../shared/lib/db/client";
import { isKeycloakEnabled } from "../services/keycloak-config";
import { createKeycloakSessionService } from "../services/keycloak-session-service";
import { createKeycloakIdentityRepository } from "../models/keycloak-identity-repository";
export type Principal = { id: string; name: string };
let sessions: ReturnType<typeof createKeycloakSessionService> | undefined;
export async function getPrincipal(
  requestHeaders: Headers,
): Promise<Principal | null> {
  if (!isKeycloakEnabled()) return null;
  sessions ??= createKeycloakSessionService(
    getAuth(),
    createKeycloakIdentityRepository(getDatabase()),
  );
  return sessions.getPrincipal(requestHeaders);
}
export async function requirePageAccess() {
  let principal: Principal | null = null;
  try {
    principal = await getPrincipal(await headers());
  } catch {
    console.error(JSON.stringify({ event: "auth.access_unavailable" }));
  }
  if (!principal) redirect("/login");
  return principal;
}
