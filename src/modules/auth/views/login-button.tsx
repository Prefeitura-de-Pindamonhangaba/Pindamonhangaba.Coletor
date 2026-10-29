"use client";
import { useHydrated } from "../../../shared/lib/auth/use-hydrated";
import { useState } from "react";
import { authClient } from "../../../shared/lib/auth/client";
export function LoginButton({ enabled }: { enabled: boolean }) {
  const hydrated = useHydrated();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <>
      <button
        className="button"
        disabled={!enabled || busy || !hydrated}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            const result = await authClient.signIn.social({
              provider: "keycloak",
              callbackURL: "/",
              errorCallbackURL: "/login?sso=error",
            });
            if (result.error) {
              setError("Não foi possível iniciar o login institucional.");
              setBusy(false);
            }
          } catch {
            setError("Não foi possível iniciar o login institucional.");
            setBusy(false);
          }
        }}
      >
        {busy ? "Redirecionando…" : "Login"}
      </button>
      {error && (
        <p className="welcome-alert" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
