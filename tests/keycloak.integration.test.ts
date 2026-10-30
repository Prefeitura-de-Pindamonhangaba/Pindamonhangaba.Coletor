import { beforeAll, afterAll, describe, expect, test } from "bun:test";
import { randomUUID, randomBytes } from "node:crypto";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { eq } from "drizzle-orm";
import { createMockKeycloak } from "./helpers/mock-keycloak";
import { createDatabase } from "../src/shared/lib/db/client";
import { createAuthService } from "../src/modules/auth/services/auth-service";
import {
  parseAuthEnvironment,
  keycloakAccountId,
} from "../src/modules/auth/services/keycloak-config";
import { createKeycloakSessionService } from "../src/modules/auth/services/keycloak-session-service";
import { createKeycloakIdentityRepository } from "../src/modules/auth/models/keycloak-identity-repository";
import { user, account } from "../src/modules/auth/models/auth-schema";

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  "Login Keycloak com OIDC simulado",
  () => {
    let idp: Awaited<ReturnType<typeof createMockKeycloak>>;
    let connection: ReturnType<typeof createDatabase>;
    let server: ReturnType<typeof Bun.serve>;
    let origin: string;
    let auth: ReturnType<typeof createAuthService>;
    const subject = randomUUID(),
      userId = randomUUID(),
      email = `${randomUUID()}@test.invalid`;
    const rateIp = `10.${[...randomBytes(3)].join(".")}`;
    function absorb(response: Response, jar: Map<string, string>) {
      for (const cookie of response.headers.getSetCookie()) {
        const pair = cookie.split(";")[0]!;
        const equals = pair.indexOf("=");
        if (/max-age=0/i.test(cookie)) jar.delete(pair.slice(0, equals));
        else jar.set(pair.slice(0, equals), pair.slice(equals + 1));
      }
    }
    const cookieHeader = (jar: Map<string, string>) =>
      [...jar].map(([key, value]) => `${key}=${value}`).join("; ");
    async function login(
      profile = { sub: subject, email, verified: true, roles: ["operator"] },
      tamperState = false,
    ) {
      idp.setProfile(profile);
      const jar = new Map<string, string>();
      const initial = await fetch(`${origin}/api/auth/sign-in/social`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin,
          "x-real-ip": rateIp,
        },
        body: JSON.stringify({
          provider: "keycloak",
          callbackURL: `${origin}/`,
          errorCallbackURL: `${origin}/login?error=auth`,
        }),
        redirect: "manual",
      });
      expect(initial.status).toBe(200);
      absorb(initial, jar);
      const start = (await initial.json()) as { url: string };
      const authUrl = new URL(start.url);
      expect(authUrl.searchParams.get("code_challenge_method")).toBe("S256");
      expect(authUrl.searchParams.get("nonce")).toBeTruthy();
      const authorized = await fetch(start.url, { redirect: "manual" });
      const callbackUrl = new URL(authorized.headers.get("location")!);
      if (tamperState) callbackUrl.searchParams.set("state", "invalid-state");
      const callback = await fetch(callbackUrl, {
        headers: { cookie: cookieHeader(jar) },
        redirect: "manual",
      });
      absorb(callback, jar);
      const sessionResponse = await fetch(`${origin}/api/auth/get-session`, {
        headers: { cookie: cookieHeader(jar) },
      });
      return {
        callback,
        jar,
        session: (await sessionResponse.json()) as {
          user?: { id: string };
        } | null,
      };
    }
    beforeAll(async () => {
      connection = createDatabase(process.env.TEST_DATABASE_URL!);
      await migrate(connection.database, { migrationsFolder: "drizzle" });
      idp = await createMockKeycloak();
      server = Bun.serve({
        port: 0,
        hostname: "127.0.0.1",
        fetch: (request) => auth.handler(request),
      });
      origin = `http://127.0.0.1:${server.port}`;
      const env = parseAuthEnvironment({
        APP_ENV: "development",
        APP_URL: origin,
        BETTER_AUTH_SECRET: "oidc-test-secret-with-at-least-32-characters",
        KEYCLOAK_ENABLED: "true",
        KEYCLOAK_ALLOW_INSECURE_HTTP: "true",
        KEYCLOAK_ISSUER: idp.issuer,
        KEYCLOAK_CLIENT_ID: "coletor-test",
        KEYCLOAK_CLIENT_SECRET: "mock-only",
      });
      auth = createAuthService(connection.database, env);
      await connection.database.insert(user).values({
        id: userId,
        email,
        name: "Usuário autorizado",
        emailVerified: true,
      });
      await connection.database.insert(account).values({
        userId,
        providerId: "keycloak",
        accountId: keycloakAccountId(idp.issuer, subject),
      });
    });
    afterAll(async () => {
      server?.stop(true);
      idp?.stop();
      await connection?.client.end();
    });
    test("usuário vinculado entra com PKCE e sessão pode ser revogada", async () => {
      const result = await login();
      expect(result.callback.status).toBe(302);
      expect(result.session?.user?.id).toBe(userId);
      expect(idp.exchanges()).toBeGreaterThan(0);
      const [storedAccount] = await connection.database
        .select()
        .from(account)
        .where(eq(account.userId, userId));
      expect(storedAccount?.accessToken).not.toBe("mock-access-token");
      let now = Date.now();
      const sessions = createKeycloakSessionService(
        auth,
        createKeycloakIdentityRepository(connection.database),
        () => now,
      );
      const headers = new Headers({ cookie: cookieHeader(result.jar) });
      expect((await sessions.getPrincipal(headers))?.role).toBe("operator");
      idp.setProfile({ sub: subject, email, verified: true, roles: ["admin"] });
      now += 60_001;
      expect((await sessions.getPrincipal(headers))?.role).toBe("admin");
      const logout = await fetch(`${origin}/api/auth/sign-out`, {
        method: "POST",
        headers: {
          origin,
          cookie: cookieHeader(result.jar),
          "Content-Type": "application/json",
        },
        body: "{}",
      });
      expect(logout.status).toBe(200);
      const reused = await fetch(`${origin}/api/auth/get-session`, {
        headers: { cookie: cookieHeader(result.jar) },
      });
      expect(await reused.json()).toBeNull();
      expect(await sessions.getPrincipal(headers)).toBeNull();
    });
    test("provisiona outro subject com papel sem vincular pelo mesmo e-mail", async () => {
      const otherSubject = randomUUID();
      const result = await login({
        sub: otherSubject,
        email,
        verified: true,
        roles: ["viewer"],
      });
      expect(result.session?.user?.id).toBeTruthy();
      expect(result.session?.user?.id).not.toBe(userId);
      const sessions = createKeycloakSessionService(
        auth,
        createKeycloakIdentityRepository(connection.database),
      );
      idp.setProfile({
        sub: otherSubject,
        email,
        verified: true,
        roles: [],
      });
      expect(
        await sessions.getPrincipal(
          new Headers({ cookie: cookieHeader(result.jar) }),
        ),
      ).toBeNull();
      const revoked = await auth.api.getSession({
        headers: new Headers({ cookie: cookieHeader(result.jar) }),
      });
      expect(revoked).toBeNull();
    });
    test("e-mail não é identidade e state alterado continua rejeitado", async () => {
      expect(
        (
          await login({
            sub: subject,
            email,
            verified: false,
            roles: ["operator"],
          })
        ).session?.user?.id,
      ).toBe(userId);
      expect((await login(undefined, true)).session).toBeNull();
    });
    test("rejeita usuário sem papel do cliente mesmo com vínculo local", async () => {
      expect(
        (await login({ sub: subject, email, verified: true, roles: [] }))
          .session,
      ).toBeNull();
    });
    test("limita tentativas repetidas de login", async () => {
      const response = await fetch(`${origin}/api/auth/sign-in/social`, {
        method: "POST",
        headers: {
          origin,
          "Content-Type": "application/json",
          "x-real-ip": rateIp,
        },
        body: JSON.stringify({
          provider: "keycloak",
          callbackURL: `${origin}/`,
        }),
      });
      expect(response.status).toBe(429);
    });
  },
);
