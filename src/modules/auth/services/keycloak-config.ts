import { z } from "zod";
export function isKeycloakEnabled(
  env: Record<string, string | undefined> = process.env,
) {
  const value = z
    .enum(["true", "false"])
    .default("false")
    .safeParse(env.KEYCLOAK_ENABLED);
  if (!value.success)
    throw new Error("Configuração inválida: KEYCLOAK_ENABLED.");
  return value.data === "true";
}
export function parseAuthEnvironment(env: Record<string, string | undefined>) {
  const development =
    env.APP_ENV === "development" ||
    (!env.APP_ENV && env.NODE_ENV === "development");
  const config = z
    .object({
      APP_URL: z.url().refine((value) => {
        const url = new URL(value);
        return (
          !url.username &&
          !url.password &&
          !url.search &&
          !url.hash &&
          url.pathname === "/" &&
          (url.protocol === "https:" ||
            (development &&
              url.protocol === "http:" &&
              ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)))
        );
      }),
      BETTER_AUTH_SECRET: z.string().min(32),
    })
    .safeParse(env);
  if (!config.success)
    throw new Error(
      "Configure APP_URL e BETTER_AUTH_SECRET válidos no servidor.",
    );
  if (!isKeycloakEnabled(env))
    return { ...config.data, keycloak: { enabled: false as const } };
  const allowHttp =
    development &&
    env.KEYCLOAK_ALLOW_INSECURE_HTTP === "true" &&
    config.data.APP_URL.startsWith("http:");
  if (
    env.KEYCLOAK_ALLOW_INSECURE_HTTP &&
    !["true", "false"].includes(env.KEYCLOAK_ALLOW_INSECURE_HTTP)
  )
    throw new Error("Configuração inválida: KEYCLOAK_ALLOW_INSECURE_HTTP.");
  const provider = z
    .object({
      KEYCLOAK_ISSUER: z.url().refine((value) => {
        const url = new URL(value);
        return (
          !url.username &&
          !url.password &&
          !url.search &&
          !url.hash &&
          /\/realms\/[^/]+\/?$/.test(url.pathname) &&
          (url.protocol === "https:" || (allowHttp && url.protocol === "http:"))
        );
      }),
      KEYCLOAK_CLIENT_ID: z.string().trim().min(1).max(255),
      KEYCLOAK_CLIENT_SECRET: z.string().min(1),
    })
    .safeParse(env);
  if (!provider.success)
    throw new Error(
      "Configure KEYCLOAK_ISSUER, KEYCLOAK_CLIENT_ID e KEYCLOAK_CLIENT_SECRET válidos.",
    );
  return {
    ...config.data,
    keycloak: {
      enabled: true as const,
      issuer: provider.data.KEYCLOAK_ISSUER.replace(/\/$/, ""),
      clientId: provider.data.KEYCLOAK_CLIENT_ID,
      clientSecret: provider.data.KEYCLOAK_CLIENT_SECRET,
    },
  };
}
export function keycloakAccountId(issuer: string, subject: unknown) {
  const parsed = z
    .string()
    .min(1)
    .max(255)
    .regex(/^[^\x00-\x20\x7f]+$/)
    .safeParse(subject);
  if (!parsed.success) throw new Error("Identificador Keycloak inválido.");
  return JSON.stringify([issuer, parsed.data]);
}
