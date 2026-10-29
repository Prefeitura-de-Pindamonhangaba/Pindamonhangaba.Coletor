import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { genericOAuth, keycloak } from "better-auth/plugins/generic-oauth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { eq } from "drizzle-orm";
import type { Database } from "../../../shared/lib/db/client";
import * as schema from "../models/auth-schema";
import {
  keycloakAccountId,
  type parseAuthEnvironment,
} from "./keycloak-config";

export function createAuthService(
  database: Database,
  env: ReturnType<typeof parseAuthEnvironment>,
) {
  return betterAuth({
    appName: "Pinda Coletor",
    baseURL: env.APP_URL,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [env.APP_URL],
    onAPIError: { errorURL: `${env.APP_URL}/login` },
    database: drizzleAdapter(database, {
      provider: "pg",
      schema,
      transaction: true,
    }),
    account: {
      encryptOAuthTokens: true,
      accountLinking: { enabled: false, disableImplicitLinking: true },
    },
    plugins: env.keycloak.enabled
      ? [
          genericOAuth({
            config: [
              {
                ...keycloak({
                  issuer: env.keycloak.issuer,
                  clientId: env.keycloak.clientId,
                  clientSecret: env.keycloak.clientSecret,
                  pkce: true,
                  disableSignUp: true,
                  disableImplicitSignUp: true,
                  overrideUserInfo: false,
                  disableProviderLogout: true,
                }),
                requireIdTokenVerification: true,
                accountSubject: ({ profile }) =>
                  keycloakAccountId(
                    env.keycloak.enabled ? env.keycloak.issuer : "",
                    profile.sub,
                  ),
              },
            ],
          }),
        ]
      : [],
    emailAndPassword: { enabled: false, disableSignUp: true },
    session: {
      expiresIn: 60 * 60 * 8,
      disableSessionRefresh: true,
      cookieCache: { enabled: false },
    },
    user: {
      validateUserInfo: ({ source }) => {
        if (source.oauth?.providerId !== "keycloak") return;
        const profile = source.oauth.profile;
        if (
          !env.keycloak.enabled ||
          profile?.iss !== env.keycloak.issuer ||
          profile?.email_verified !== true
        )
          return {
            error: "access_denied",
            errorDescription: "Acesso institucional não autorizado.",
          };
      },
      additionalFields: {
        enabled: {
          type: "boolean",
          required: true,
          defaultValue: true,
          input: false,
        },
      },
    },
    databaseHooks: {
      session: {
        create: {
          before: async (data) => {
            const [owner] = await database
              .select({ enabled: schema.user.enabled })
              .from(schema.user)
              .where(eq(schema.user.id, data.userId))
              .limit(1);
            if (!owner?.enabled)
              throw new APIError("UNAUTHORIZED", {
                message: "Acesso não autorizado.",
              });
          },
        },
      },
    },
    advanced: {
      cookiePrefix: "pinda-coletor",
      database: { generateId: "uuid" },
      useSecureCookies: env.APP_URL.startsWith("https://"),
      defaultCookieAttributes: { httpOnly: true, sameSite: "lax", path: "/" },
      ipAddress: { ipAddressHeaders: ["x-real-ip"] },
    },
    rateLimit: {
      enabled: true,
      storage: "database",
      window: 60,
      max: 60,
      customRules: { "/sign-in/social": { window: 60, max: 5 } },
    },
    logger: {
      level: "error",
      log: (level) => {
        console.error(JSON.stringify({ event: "auth.internal_error", level }));
      },
    },
  });
}
