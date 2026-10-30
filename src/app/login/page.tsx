import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { LoginPage } from "../../modules/auth/views/login-page";
import {
  isKeycloakEnabled,
  parseAuthEnvironment,
} from "../../modules/auth/services/keycloak-config";
import { getPrincipal } from "../../modules/auth/controllers/access-controller";
export const dynamic = "force-dynamic";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  let configured = false;
  let signedIn = false;
  try {
    configured =
      isKeycloakEnabled() && parseAuthEnvironment(process.env).keycloak.enabled;
    if (configured) signedIn = !!(await getPrincipal(await headers()));
  } catch {
    configured = false;
  }
  if (signedIn) redirect("/");
  const query = await searchParams;
  return (
    <LoginPage
      configured={configured}
      hasError={!!query.error || query.sso === "error"}
    />
  );
}
