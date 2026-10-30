import { expect, test } from "bun:test";
import { parseKeycloakIdentity } from "../src/modules/auth/services/keycloak-identity";
const issuer = "https://id.example/realms/test";
const profile = {
  iss: issuer,
  sub: "stable-subject",
  name: "Servidor",
  resource_access: { collector: { roles: ["viewer", "operator", "admin"] } },
};
test("aceita somente papéis do cliente correto e prioriza admin", () => {
  expect(parseKeycloakIdentity(profile, issuer, "collector")?.role).toBe(
    "admin",
  );
  expect(parseKeycloakIdentity(profile, issuer, "other-client")).toBeNull();
  expect(
    parseKeycloakIdentity(
      profile,
      "https://other.example/realms/test",
      "collector",
    ),
  ).toBeNull();
  expect(
    parseKeycloakIdentity(
      { ...profile, resource_access: { collector: { roles: ["unknown"] } } },
      issuer,
      "collector",
    ),
  ).toBeNull();
});
test("identidade e e-mail técnico dependem do issuer e subject", () => {
  const first = parseKeycloakIdentity(profile, issuer, "collector")!;
  const renamed = parseKeycloakIdentity(
    { ...profile, name: "Outro nome", email: "other@example.com" },
    issuer,
    "collector",
  )!;
  expect(first.accountId).toBe(renamed.accountId);
  expect(first.technicalEmail).toBe(renamed.technicalEmail);
  expect(first.technicalEmail.endsWith("@identity.invalid")).toBe(true);
  expect(
    parseKeycloakIdentity(
      { ...profile, sub: "another-subject" },
      issuer,
      "collector",
    )?.technicalEmail,
  ).not.toBe(first.technicalEmail);
});
