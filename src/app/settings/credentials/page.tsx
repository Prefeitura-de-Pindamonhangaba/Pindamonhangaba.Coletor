import { requirePageAccess } from "../../../modules/auth/controllers/access-controller";
import { getCredentialService } from "../../../shared/lib/credentials/server";
import { CredentialsPage } from "../../../modules/credentials/views/credentials-page";
export const dynamic = "force-dynamic";
export default async function Page() {
  const principal = await requirePageAccess();
  const credentials = await getCredentialService().list(principal.id);
  return (
    <CredentialsPage
      userName={principal.name}
      initialCredentials={credentials.map((item) => ({
        ...item,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
      }))}
    />
  );
}
