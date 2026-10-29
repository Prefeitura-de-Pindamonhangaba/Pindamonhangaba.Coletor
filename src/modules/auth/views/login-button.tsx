"use client";
import { useState } from "react";
import { authClient } from "../../../shared/lib/auth/client";
export function LoginButton({ enabled }: { enabled: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <>
      <button
        className="button"
        disabled={!enabled || busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            const result = await authClient.signIn.social({
              provider: "keycloak",
              callbackURL: "/",
              errorCallbackURL: "/login?error=auth",
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
