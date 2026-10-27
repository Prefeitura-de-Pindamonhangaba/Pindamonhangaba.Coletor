import { expect, test } from "bun:test";
import { getRuntimeConfig } from "../src/shared/lib/env";

test("desenvolvimento aceita banco local e flag falsa", () => {
  const config = getRuntimeConfig({
    DATABASE_URL: "postgresql://coletor:senha@database:5432/coletor",
  });
  expect(config.appEnv).toBe("development");
  expect(config.externalDatabase).toBe(false);
});
test("produção exige flag de banco externo", () => {
  expect(() =>
    getRuntimeConfig({
      APP_ENV: "production",
      DATABASE_URL: "postgres://user:pass@db/coletor",
    }),
  ).toThrow("DATABASE_EXTERNAL");
});
test("produção aceita conexão PostgreSQL externa", () => {
  const config = getRuntimeConfig({
    APP_ENV: "production",
    DATABASE_EXTERNAL: "true",
    DATABASE_URL:
      "postgresql://user:pass@external:5432/coletor?sslmode=require",
  });
  expect(config.externalDatabase).toBe(true);
});
test("rejeita conexão ausente, vazia, outro protocolo ou sem banco", () => {
  for (const url of [
    undefined,
    "",
    "   ",
    "https://host/coletor",
    "postgres://host",
  ]) {
    expect(() =>
      getRuntimeConfig({ DATABASE_EXTERNAL: "true", DATABASE_URL: url }),
    ).toThrow("DATABASE_URL");
  }
});
test("rejeita flags ambíguas sem vazar credenciais nos erros", () => {
  const credentials = "postgres://user:segredo-nao-expor@host/coletor";
  expect(() =>
    getRuntimeConfig({ DATABASE_EXTERNAL: "1", DATABASE_URL: credentials }),
  ).toThrow("DATABASE_EXTERNAL");
  try {
    getRuntimeConfig({ DATABASE_URL: "segredo-nao-expor" });
  } catch (error) {
    expect(String(error)).not.toContain("segredo-nao-expor");
  }
});
