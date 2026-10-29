"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "../../../shared/lib/auth/client";
export function SessionControls({ name }: { name: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <div className="session-controls">
      <span>{name}</span>
      <div>
        <button
          className="text-button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              const result = await authClient.signOut();
              if (result.error) {
                setError("Não foi possível sair.");
                setBusy(false);
              } else {
                router.replace("/login");
                router.refresh();
              }
            } catch {
              setError("Não foi possível sair.");
              setBusy(false);
            }
          }}
        >
          {busy ? "Saindo…" : "Sair"}
        </button>
        {error && <p role="alert">{error}</p>}
      </div>
    </div>
  );
}
