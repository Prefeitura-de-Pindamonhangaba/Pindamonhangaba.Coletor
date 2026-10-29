import { WorkbookPage } from "../modules/imports/views/workbook-page";
import { requirePageAccess } from "../modules/auth/controllers/access-controller";
import { getCredentialService } from "../shared/lib/credentials/server";
export const dynamic = "force-dynamic";
export default async function Page() {
  const principal = await requirePageAccess();
  const credentials = await getCredentialService().list(principal.id);
  return (
    <WorkbookPage
      userName={principal.name}
      credentials={credentials
        .filter((item) => item.active && item.systemCode === "gcc")
        .map((item) => ({ id: item.id, label: item.label }))}
    />
  );
}
