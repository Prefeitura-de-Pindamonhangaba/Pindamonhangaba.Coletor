import { expect, test } from "bun:test";
import { randomBytes } from "node:crypto";
import {
  parseAuthEnvironment,
  isKeycloakEnabled,
  keycloakAccountId,
} from "../src/modules/auth/services/keycloak-config";
import {
  encryptCredential,
  decryptCredential,
} from "../src/shared/lib/security/credential-cipher";
import {
  createCredentialSchema,
  updateCredentialSchema,
} from "../src/modules/credentials/schemas/credential-input";
import { createWorkbookController } from "../src/modules/imports/controllers/workbook-controller";

const config = {
  APP_ENV: "development",
  APP_URL: "http://localhost:3000",
  BETTER_AUTH_SECRET: "test-auth-secret-with-at-least-32-characters",
  KEYCLOAK_ENABLED: "true",
  KEYCLOAK_ISSUER: "https://id.example/realms/cidade",
  KEYCLOAK_CLIENT_ID: "coletor",
  KEYCLOAK_CLIENT_SECRET: "test-only",
};
test("Keycloak desabilitado nega login e configuração habilitada exige credenciais", () => {
  expect(isKeycloakEnabled({})).toBe(false);
  expect(() =>
    parseAuthEnvironment({ ...config, KEYCLOAK_CLIENT_SECRET: "" }),
  ).toThrow("KEYCLOAK");
  expect(parseAuthEnvironment(config).keycloak.enabled).toBe(true);
});
test("HTTP é restrito ao desenvolvimento local e exige opção explícita para o IdP", () => {
  expect(() =>
    parseAuthEnvironment({
      ...config,
      KEYCLOAK_ISSUER: "http://localhost:8080/realms/cidade",
    }),
  ).toThrow("KEYCLOAK");
  expect(
    parseAuthEnvironment({
      ...config,
      KEYCLOAK_ISSUER: "http://localhost:8080/realms/cidade",
      KEYCLOAK_ALLOW_INSECURE_HTTP: "true",
    }).keycloak.enabled,
  ).toBe(true);
  expect(() =>
    parseAuthEnvironment({
      ...config,
      APP_ENV: "production",
      KEYCLOAK_ALLOW_INSECURE_HTTP: "true",
    }),
  ).toThrow("APP_URL");
  expect(() =>
    parseAuthEnvironment({
      ...config,
      APP_ENV: "production",
      APP_URL: "https://coletor.example",
      KEYCLOAK_ALLOW_INSECURE_HTTP: "true",
      KEYCLOAK_ISSUER: "http://id.example/realms/cidade",
    }),
  ).toThrow("KEYCLOAK");
});
test("identidade inclui o issuer e impede subject vazio ou com espaço", () => {
  expect(keycloakAccountId("https://id/realms/a", "same-sub")).not.toBe(
    keycloakAccountId("https://id/realms/b", "same-sub"),
  );
  expect(() => keycloakAccountId("https://id/realms/a", "")).toThrow();
  expect(() =>
    keycloakAccountId("https://id/realms/a", "invalid sub"),
  ).toThrow();
});
test("criptografia autentica o segredo e seu contexto sem revelar texto", () => {
  const key = randomBytes(32);
  const context = { id: "credential-a", userId: "owner-a", systemCode: "gcc" };
  const value = encryptCredential("chave-confidencial-teste", context, key);
  expect(value).not.toContain("chave-confidencial-teste");
  expect(decryptCredential(value, context, key)).toBe(
    "chave-confidencial-teste",
  );
  expect(encryptCredential("chave-confidencial-teste", context, key)).not.toBe(
    value,
  );
  for (const modified of [
    { ...context, id: "credential-b" },
    { ...context, userId: "owner-b" },
    { ...context, systemCode: "outro" },
  ])
    expect(() => decryptCredential(value, modified, key)).toThrow();
  expect(() => decryptCredential(value, context, randomBytes(32))).toThrow();
});
test("cadastro aceita sistemas genéricos e rejeita troca de proprietário/sistema", () => {
  expect(
    createCredentialSchema.parse({
      systemCode: "Sistema-Dois",
      label: "Minha chave",
      secret: "segredo",
    }).systemCode,
  ).toBe("sistema-dois");
  expect(
    updateCredentialSchema.safeParse({ userId: "outro", label: "Nome" })
      .success,
  ).toBe(false);
  expect(updateCredentialSchema.safeParse({ systemCode: "gcc" }).success).toBe(
    false,
  );
});
test("preview e envio exigem sessão antes de processar arquivos", async () => {
  const controller = createWorkbookController({
    getPrincipal: async () => null,
    getGccSecret: async () => {
      throw new Error("Não deve consultar chaves.");
    },
    sendRecords: async () => {
      throw new Error("Não deve transmitir.");
    },
  });
  const origin = process.env.APP_URL
    ? new URL(process.env.APP_URL).origin
    : "http://localhost";
  for (const action of ["", "?action=send"]) {
    const result = await controller(
      new Request(`${origin}/api/workbooks${action}`, {
        method: "POST",
        headers: { origin },
      }),
    );
    expect(result.status).toBe(401);
  }
});
