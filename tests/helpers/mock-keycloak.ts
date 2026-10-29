import { createHash, randomUUID } from "node:crypto";
import { exportJWK, generateKeyPair, SignJWT } from "jose";

export async function createMockKeycloak(port = 0) {
  const keys = await generateKeyPair("RS256");
  const jwk = {
    ...(await exportJWK(keys.publicKey)),
    kid: "test-key",
    alg: "RS256",
    use: "sig",
  };
  let current = {
    sub: randomUUID(),
    email: "mock@test.invalid",
    verified: true,
    roles: ["operator"] as string[],
  };
  const codes = new Map<
    string,
    {
      nonce: string;
      challenge: string;
      redirect: string;
      profile: typeof current;
    }
  >();
  const refreshTokens = new Map<string, string>();
  let exchanges = 0;
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port,
    async fetch(request) {
      const url = new URL(request.url),
        issuer = `${url.origin}/realms/coletor-test`;
      if (url.pathname.endsWith("/.well-known/openid-configuration"))
        return Response.json({
          issuer,
          authorization_endpoint: `${issuer}/protocol/openid-connect/auth`,
          token_endpoint: `${issuer}/protocol/openid-connect/token`,
          jwks_uri: `${issuer}/protocol/openid-connect/certs`,
          userinfo_endpoint: `${issuer}/protocol/openid-connect/userinfo`,
          response_types_supported: ["code"],
          subject_types_supported: ["public"],
          id_token_signing_alg_values_supported: ["RS256"],
          token_endpoint_auth_methods_supported: [
            "client_secret_post",
            "client_secret_basic",
          ],
          code_challenge_methods_supported: ["S256"],
        });
      if (url.pathname.endsWith("/certs"))
        return Response.json({ keys: [jwk] });
      if (url.pathname.endsWith("/auth")) {
        const code = randomUUID();
        const nonce = url.searchParams.get("nonce"),
          challenge = url.searchParams.get("code_challenge"),
          redirect = url.searchParams.get("redirect_uri");
        if (
          !nonce ||
          !challenge ||
          !redirect ||
          url.searchParams.get("code_challenge_method") !== "S256"
        )
          return new Response("PKCE/nonce ausente", { status: 400 });
        codes.set(code, {
          nonce,
          challenge,
          redirect,
          profile: { ...current },
        });
        const callback = new URL(redirect);
        callback.searchParams.set("code", code);
        callback.searchParams.set("state", url.searchParams.get("state") ?? "");
        return Response.redirect(callback.toString(), 302);
      }
      if (url.pathname.endsWith("/token")) {
        const body = new URLSearchParams(await request.text());
        const refresh = body.get("grant_type") === "refresh_token";
        const refreshSubject = refreshTokens.get(
          body.get("refresh_token") ?? "",
        );
        const code = body.get("code") ?? "";
        const data =
          refresh && refreshSubject === current.sub
            ? { nonce: undefined, profile: current }
            : codes.get(code);
        codes.delete(code);
        if (
          !data ||
          (!refresh &&
            (createHash("sha256")
              .update(body.get("code_verifier") ?? "")
              .digest("base64url") !==
              (data as { challenge: string }).challenge ||
              body.get("redirect_uri") !==
                (data as { redirect: string }).redirect))
        )
          return Response.json({ error: "invalid_grant" }, { status: 400 });
        exchanges++;
        const refreshToken = randomUUID();
        refreshTokens.set(refreshToken, data.profile.sub);
        const idToken = await new SignJWT({
          resource_access: { "coletor-test": { roles: data.profile.roles } },
          email: data.profile.email,
          email_verified: data.profile.verified,
          name: "Usuário OIDC de teste",
          nonce: data.nonce,
        })
          .setProtectedHeader({ alg: "RS256", kid: "test-key" })
          .setSubject(data.profile.sub)
          .setIssuer(issuer)
          .setAudience("coletor-test")
          .setIssuedAt()
          .setExpirationTime("5m")
          .sign(keys.privateKey);
        return Response.json({
          access_token: "mock-access-token",
          refresh_token: refreshToken,
          id_token: idToken,
          expires_in: 300,
          token_type: "Bearer",
          scope: "openid email profile",
        });
      }
      return new Response("Não encontrado", { status: 404 });
    },
  });
  return {
    issuer: `http://127.0.0.1:${server.port}/realms/coletor-test`,
    setProfile: (
      profile: Omit<typeof current, "roles"> & { roles?: string[] },
    ) => {
      current = { ...profile, roles: profile.roles ?? ["operator"] };
    },
    exchanges: () => exchanges,
    stop: () => server.stop(true),
  };
}
