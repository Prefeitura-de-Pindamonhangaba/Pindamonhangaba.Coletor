import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "../../../shared/lib/auth/server";
import { isKeycloakEnabled } from "../services/keycloak-config";
export type Principal = { id: string; name: string };
export async function getPrincipal(
  requestHeaders: Headers,
): Promise<Principal | null> {
  if (!isKeycloakEnabled()) return null;
  const session = await getAuth().api.getSession({ headers: requestHeaders });
  if (!session?.user.enabled) return null;
  return { id: session.user.id, name: session.user.name };
}
export async function requirePageAccess() {
  const principal = await getPrincipal(await headers());
  if (!principal) redirect("/login");
  return principal;
}
