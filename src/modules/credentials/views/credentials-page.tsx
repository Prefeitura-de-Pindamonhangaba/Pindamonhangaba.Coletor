"use client";
import { useState } from "react";
import {
  InstitutionalHeader,
  InstitutionalFooter,
} from "../../../shared/components/institutional-shell";
import type { CredentialSummary } from "../models/credential-schema";
export type CredentialView = Omit<
  CredentialSummary,
  "createdAt" | "updatedAt"
> & { createdAt: string; updatedAt: string };
export function CredentialsPage({
  userName,
  initialCredentials,
}: {
  userName: string;
  initialCredentials: CredentialView[];
}) {
  const [credentials, setCredentials] = useState(initialCredentials);
  const [editing, setEditing] = useState<string | null>(null);
  const [system, setSystem] = useState("gcc");
  const [otherSystem, setOtherSystem] = useState("");
  const [label, setLabel] = useState("");
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  function clear() {
    setEditing(null);
    setSystem("gcc");
    setOtherSystem("");
    setLabel("");
    setSecret("");
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage("");
    const body = editing
      ? { label, ...(secret ? { secret } : {}) }
      : { systemCode: system === "other" ? otherSystem : "gcc", label, secret };
    try {
      const response = await fetch(
        editing ? `/api/credentials/${editing}` : "/api/credentials",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const result = (await response.json()) as CredentialView & {
        error?: string;
      };
      if (!response.ok)
        setMessage(result.error ?? "Não foi possível salvar a chave.");
      else {
        setCredentials((items) =>
          editing
            ? items.map((item) => (item.id === editing ? result : item))
            : [result, ...items],
        );
        clear();
        setMessage("Chave salva. O segredo não será exibido novamente.");
      }
    } catch {
      setMessage("Não foi possível salvar a chave.");
    } finally {
      setSecret("");
      setBusy(false);
    }
  }
  async function toggle(item: CredentialView) {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/credentials/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !item.active }),
      });
      const result = (await response.json()) as CredentialView & {
        error?: string;
      };
      if (!response.ok)
        setMessage(result.error ?? "Não foi possível alterar a chave.");
      else {
        setCredentials((items) =>
          items.map((entry) => (entry.id === item.id ? result : entry)),
        );
        setMessage(
          result.active
            ? "Chave ativada."
            : "Chave desativada. Ela não poderá ser utilizada em novos envios.",
        );
      }
    } catch {
      setMessage("Não foi possível alterar a chave.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="shell">
      <InstitutionalHeader userName={userName} keysPage />
      <main id="importacao">
        <div className="page-heading">
          <div>
            <span className="eyebrow">CONFIGURAÇÕES DE INTEGRAÇÃO</span>
            <h1>Minhas chaves</h1>
            <p>
              Cadastre as chaves dos sistemas que você utiliza. Cada chave
              pertence somente à sua conta.
            </p>
          </div>
        </div>
        <div className="content-grid">
          <section className="panel">
            <h2>{editing ? "Editar chave" : "Cadastrar chave"}</h2>
            <form onSubmit={(event) => void save(event)}>
              <label htmlFor="credential-system">Sistema</label>
              <select
                id="credential-system"
                value={system}
                disabled={busy || !!editing}
                onChange={(event) => setSystem(event.target.value)}
              >
                <option value="gcc">Embras GCC</option>
                <option value="other">Outro sistema</option>
              </select>
              {system === "other" && (
                <>
                  <label htmlFor="credential-code">
                    Identificador do sistema
                  </label>
                  <input
                    id="credential-code"
                    value={otherSystem}
                    onChange={(event) => setOtherSystem(event.target.value)}
                    disabled={busy || !!editing}
                    required
                    pattern="[a-z][a-z0-9_-]{1,49}"
                    maxLength={50}
                    placeholder="Ex.: sistema-convenios"
                  />
                  <p className="field-help">
                    Use letras minúsculas, números, hífen ou sublinhado. Utilize
                    o mesmo identificador para chaves do mesmo sistema.
                  </p>
                </>
              )}
              <label htmlFor="credential-label">Nome da chave</label>
              <input
                id="credential-label"
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                required
                maxLength={100}
                disabled={busy}
                placeholder="Ex.: GCC — Entidade / unidade"
              />
              <label htmlFor="credential-secret">
                {editing
                  ? "Nova chave de acesso (opcional)"
                  : "Chave de acesso"}
              </label>
              <input
                id="credential-secret"
                type="password"
                autoComplete="new-password"
                value={secret}
                onChange={(event) => setSecret(event.target.value)}
                required={!editing}
                maxLength={16384}
                disabled={busy}
              />
              <p className="field-help">
                {editing
                  ? "Deixe em branco para manter o segredo atual."
                  : "Após salvar, o segredo não será exibido novamente."}
              </p>
              <div className="form-actions">
                <button className="button primary" disabled={busy}>
                  {busy ? "Salvando…" : "Salvar chave"}
                </button>
                {editing && (
                  <button
                    type="button"
                    className="button secondary"
                    disabled={busy}
                    onClick={clear}
                  >
                    Cancelar edição
                  </button>
                )}
              </div>
            </form>
          </section>
          <aside className="guide panel" id="guia">
            <span className="eyebrow">ACESSO PESSOAL</span>
            <h2>Várias chaves, uma conta.</h2>
            <p>
              Você pode cadastrar mais de uma chave GCC e escolher a chave
              correta para cada importação.
            </p>
            <p>
              As chaves ficam criptografadas no servidor. Outros usuários não
              podem consultar nem utilizar suas chaves.
            </p>
            <div className="guide-footer">
              Chaves de outros sistemas podem ser cadastradas aqui. O envio de
              planilhas está integrado somente ao GCC nesta etapa.
            </div>
          </aside>
        </div>
        {message && (
          <div className="notice" role="status">
            {message}
          </div>
        )}
        <section className="panel">
          <h2>Chaves cadastradas</h2>
          {!credentials.length ? (
            <p>Nenhuma chave cadastrada. Adicione a primeira chave acima.</p>
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Sistema</th>
                    <th>Situação</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {credentials.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <strong>{item.label}</strong>
                      </td>
                      <td>
                        {item.systemCode === "gcc"
                          ? "Embras GCC"
                          : item.systemCode}
                      </td>
                      <td>{item.active ? "Ativa" : "Desativada"}</td>
                      <td>
                        <div className="credential-actions">
                          <button
                            type="button"
                            className="text-button"
                            disabled={busy}
                            onClick={() => {
                              setEditing(item.id);
                              setSystem(
                                item.systemCode === "gcc" ? "gcc" : "other",
                              );
                              setOtherSystem(item.systemCode);
                              setLabel(item.label);
                              setSecret("");
                              setMessage("");
                            }}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            className="text-button"
                            disabled={busy}
                            onClick={() => void toggle(item)}
                          >
                            {item.active ? "Desativar" : "Ativar"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
      <InstitutionalFooter />
    </div>
  );
}
