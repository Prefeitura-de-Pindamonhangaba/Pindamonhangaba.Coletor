"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import {
  InstitutionalHeader,
  InstitutionalFooter,
} from "../../../shared/components/institutional-shell";
import {
  instruments,
  getWorkbookSheets,
  type WorkbookPreview,
} from "../models/workbook-catalog";
import type { ImportKind } from "../models/catalog";

function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}
export function WorkbookPage({
  userName,
  credentials,
}: {
  userName: string;
  credentials: { id: string; label: string }[];
}) {
  const [instrument, setInstrument] = useState(instruments[0]!.id);
  const [files, setFiles] = useState<File[]>([]);
  const [preview, setPreview] = useState<WorkbookPreview | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [credentialId, setCredentialId] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [results, setResults] = useState<
    Partial<Record<ImportKind, Record<string, unknown>>>
  >({});
  const [blocked, setBlocked] = useState(false);
  const lock = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const sheets = getWorkbookSheets(instrument);
  const current = instruments.find((item) => item.id === instrument)!;
  const next = preview?.batches.find((batch) => !results[batch.kind]);
  function reset() {
    setFiles([]);
    setPreview(null);
    setResults({});
    setMessage("");
    setConfirmed(false);
    setBlocked(false);
    if (input.current) input.current.value = "";
  }
  function formData(selected: File[]) {
    const form = new FormData();
    form.set("instrument", instrument);
    selected.forEach((file) => form.append("files", file));
    return form;
  }
  async function load(selected: File[]) {
    if (lock.current) return;
    reset();
    if (!selected.length) return;
    if (
      selected.some((file) => !file.name.toLowerCase().endsWith(".xlsx")) ||
      selected.length !== 1 ||
      selected.reduce((sum, file) => sum + file.size, 0) > 5_000_000
    ) {
      setMessage("Selecione um único arquivo XLSX de até 5 MB.");
      return;
    }
    lock.current = true;
    setBusy(true);
    setFiles(selected);
    try {
      const response = await fetch("/api/workbooks", {
        method: "POST",
        body: formData(selected),
      });
      const body = await response.json();
      if (!response.ok)
        setMessage(
          String(body.error ?? "Não foi possível validar os arquivos."),
        );
      else setPreview(body as WorkbookPreview);
    } catch {
      setMessage("Não foi possível validar os arquivos. Tente novamente.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function sendNext() {
    if (lock.current || !next || blocked) return;
    lock.current = true;
    setBusy(true);
    setMessage("");
    try {
      const form = formData(files);
      form.set("kind", next.kind);
      form.set("credentialId", credentialId);
      const response = await fetch("/api/workbooks?action=send", {
        method: "POST",
        body: form,
      });
      const body = (await response.json()) as Record<string, unknown>;
      if (!response.ok) {
        setBlocked(true);
        setMessage(
          String(
            body.error ?? "Falha no envio. Confira o GCC antes de repetir.",
          ),
        );
      } else {
        setResults((previous) => ({ ...previous, [next.kind]: body }));
        if (Number(body.erros) > 0) {
          setBlocked(true);
          setMessage(
            "O GCC retornou erros parciais. Confira o relatório e corrija somente os registros pendentes antes de um novo envio.",
          );
        }
      }
    } catch {
      setBlocked(true);
      setMessage(
        "Não foi possível confirmar a resposta. Confira no GCC antes de reenviar.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="shell">
      <InstitutionalHeader userName={userName} />
      <div className="workspace">
        <main id="importacao">
          <div className="breadcrumb">
            Integrações <span>/</span> Embras GCC <span>/</span> AUDESP Fase V
          </div>
          <div className="page-heading">
            <div>
              <span className="eyebrow">
                PRESTAÇÃO DE CONTAS DO TERCEIRO SETOR
              </span>
              <h1>Um ajuste, um conjunto de dados</h1>
              <p>
                Organize a coleta por instrumento em uma planilha Excel com
                várias abas.
              </p>
            </div>
            <span className="status">Coletor → Embras → AUDESP</span>
          </div>
          <div className="content-grid">
            <section className="panel">
              <div className="section-title">
                <span className="section-number">01</span>
                <div>
                  <h2>Prepare a planilha</h2>
                  <p>
                    Um instrumento, um código de ajuste e um exercício por
                    importação.
                  </p>
                </div>
              </div>
              <label htmlFor="instrument">Instrumento</label>
              <select
                id="instrument"
                value={instrument}
                disabled={busy}
                onChange={(event) => {
                  setInstrument(event.target.value);
                  reset();
                }}
              >
                {instruments.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
              <a
                className="button secondary workbook-template"
                href={`/templates/${instrument}.xlsx`}
                download
              >
                ↓ Baixar modelo de {current.name.toLowerCase()}
              </a>
              <div
                className="dropzone workbook-drop"
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  void load(Array.from(event.dataTransfer.files));
                }}
              >
                <span className="upload-icon">↥</span>
                <strong>
                  {files.length
                    ? files.map((file) => file.name).join(", ")
                    : "Arraste sua planilha com várias abas"}
                </strong>
                <p>
                  Preencha as abas do modelo e carregue o arquivo XLSX completo.
                </p>
                <label
                  className="button secondary file-button"
                  htmlFor="workbook-file"
                >
                  {files.length ? "Trocar arquivo" : "Selecionar arquivo"}
                </label>
                <input
                  id="workbook-file"
                  ref={input}
                  type="file"
                  accept=".xlsx"
                  disabled={busy}
                  onChange={(event) =>
                    void load(Array.from(event.target.files ?? []))
                  }
                />
                <small>
                  {busy
                    ? "Processando…"
                    : "Até 5 MB no total · 1.000 registros por tabela"}
                </small>
              </div>
              <p className="privacy-note">
                Os arquivos são processados em memória no coletor. O envio à
                Embras acontece somente após a confirmação de cada etapa.
              </p>
            </section>
            <aside className="guide panel" id="guia">
              <span className="eyebrow">PREENCHIMENTO DA PLANILHA</span>
              <h2>Dados relacionados, sem JSON nas células.</h2>
              <div className="guide-item">
                <b>1</b>
                <div>
                  <h3>Identifique o ajuste</h3>
                  <p>
                    Preencha a única linha de Ajuste com código e exercício. O
                    ajuste já deve existir na Embras.
                  </p>
                </div>
              </div>
              <div className="guide-item">
                <b>2</b>
                <div>
                  <h3>Vincule os detalhes</h3>
                  <p>
                    Naturezas usam o id_importacao do contrato. Salários e
                    remunerações usam o CPF do funcionário ou servidor.
                  </p>
                </div>
              </div>
              <div className="guide-item">
                <b>3</b>
                <div>
                  <h3>Envie na ordem indicada</h3>
                  <p>
                    Contratos, documentos fiscais, pessoal e pagamentos. Confira
                    cada retorno antes de seguir.
                  </p>
                </div>
              </div>
              <div className="guide-footer">
                Use datas AAAA-MM-DD, CPF/CNPJ como texto e valores sem
                separador de milhar. No Excel, cole valores em vez de fórmulas.
              </div>
            </aside>
          </div>
          <section className="panel">
            <h2>Abas e tabelas de {current.name.toLowerCase()}</h2>
            <p>As abas sem movimento podem ficar apenas com o cabeçalho.</p>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Tabela / aba</th>
                    <th>Como preencher</th>
                  </tr>
                </thead>
                <tbody>
                  {sheets.map((sheet) => (
                    <tr key={sheet.name}>
                      <td>
                        <strong>{sheet.name}</strong>
                      </td>
                      <td>{sheet.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <details className="column-guide">
              <summary>Consultar campos e formatos</summary>
              {sheets.map((sheet) => (
                <details key={sheet.name}>
                  <summary>{sheet.name}</summary>
                  <table>
                    <thead>
                      <tr>
                        <th>Coluna</th>
                        <th>Formato</th>
                        <th>Orientação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sheet.columns.map((column) => (
                        <tr key={column.key}>
                          <td>
                            <code>{column.key}</code>
                            {column.required ? " *" : ""}
                          </td>
                          <td>{column.schema.format ?? column.schema.type}</td>
                          <td>
                            {column.schema.description ??
                              "Conforme contrato Embras."}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </details>
              ))}
            </details>
          </section>
          <aside className="notice">
            <strong>Carga na Embras, com cobertura parcial da Fase V.</strong>{" "}
            Este modelo carrega contratos, documentos fiscais, pagamentos,
            funcionários
            {current.supportsAssignedStaff ? " e servidores cedidos" : ""}.
            Bens, receitas, repasses, pareceres e outros blocos da prestação
            completa continuam no GCC. O coletor não transmite documentos
            diretamente à AUDESP.{" "}
            <a
              href="https://www.tce.sp.gov.br/audesp/documentacao/audesp-repasses-ao-terceiro-setor-jsonschemas"
              target="_blank"
              rel="noreferrer"
            >
              Consultar schemas oficiais ↗
            </a>
          </aside>
          {message && (
            <div className="notice" role="status">
              {message}
            </div>
          )}
          {preview && (
            <section className="panel">
              <div className="section-title">
                <span className="section-number">02</span>
                <div>
                  <h2>Confira a importação</h2>
                  <p>
                    Ajuste {preview.code || "não informado"} · Exercício{" "}
                    {preview.year || "não informado"} · {preview.errors.length}{" "}
                    pendências
                  </p>
                </div>
              </div>
              {preview.errors.length ? (
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Aba</th>
                        <th>Linha</th>
                        <th>Campo</th>
                        <th>Pendência</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.errors.slice(0, 100).map((error, index) => (
                        <tr key={index}>
                          <td>{error.sheet}</td>
                          <td>{error.row}</td>
                          <td>{error.field}</td>
                          <td>{error.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p>
                    Exibindo até 100 pendências. Corrija os arquivos e
                    selecione-os novamente.
                  </p>
                </div>
              ) : (
                <>
                  <p>
                    Validação local concluída. As regras cadastrais e a
                    aceitação final são verificadas pela Embras.
                  </p>
                  <ol className="batch-list">
                    {preview.batches.map((batch) => (
                      <li key={batch.kind}>
                        <div>
                          <strong>{batch.name}</strong>
                          <span>
                            {batch.count} registros ·{" "}
                            {results[batch.kind]
                              ? `${String(results[batch.kind]!.importados)} importados / ${String(results[batch.kind]!.erros)} erros`
                              : "Aguardando envio"}
                          </span>
                        </div>
                        <details>
                          <summary>
                            Conferir {Math.min(3, batch.count)} registros
                          </summary>
                          <pre>{JSON.stringify(batch.sample, null, 2)}</pre>
                        </details>
                      </li>
                    ))}
                  </ol>
                  <div className="send-area">
                    <label htmlFor="gcc-credential">
                      Chave GCC para este envio
                    </label>
                    <select
                      id="gcc-credential"
                      value={credentialId}
                      disabled={
                        busy || blocked || Object.keys(results).length > 0
                      }
                      onChange={(event) => {
                        setCredentialId(event.target.value);
                        setConfirmed(false);
                      }}
                      required
                    >
                      <option value="">Selecione uma chave da sua conta</option>
                      {credentials.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                    <p className="field-help">
                      {credentials.length
                        ? "Confira se a chave corresponde à entidade do ajuste. A mesma chave será usada em todas as etapas."
                        : "Você ainda não tem chaves GCC ativas."}{" "}
                      <Link href="/settings/credentials">
                        Gerenciar minhas chaves
                      </Link>
                    </p>
                    <label className="checkbox">
                      <input
                        type="checkbox"
                        checked={confirmed}
                        disabled={
                          busy || blocked || Object.keys(results).length > 0
                        }
                        onChange={(event) => setConfirmed(event.target.checked)}
                      />
                      Conferi os arquivos e a chave selecionada e autorizo o
                      envio para o ajuste {preview.code} na Embras (produção).
                    </label>
                    <button
                      className="button primary"
                      disabled={
                        busy || !confirmed || !credentialId || !next || blocked
                      }
                      onClick={() => void sendNext()}
                    >
                      {busy
                        ? "Processando…"
                        : !next
                          ? "Todas as etapas foram processadas"
                          : `Enviar etapa: ${next.name}`}
                    </button>
                    <p className="field-help">
                      O envio é feito por etapa, sem reenvio automático. Em caso
                      de falha ou sucesso parcial, confira no GCC antes de
                      preparar outro arquivo. O exercício informado não modifica
                      o cadastro remoto do ajuste.
                    </p>
                  </div>
                </>
              )}
              {Object.keys(results).length > 0 && (
                <>
                  <pre className="result">
                    {JSON.stringify(results, null, 2)}
                  </pre>
                  <button
                    className="button secondary"
                    onClick={() =>
                      download(
                        "resultado-importacao.json",
                        JSON.stringify(
                          {
                            instrument,
                            code: preview.code,
                            year: preview.year,
                            results,
                          },
                          null,
                          2,
                        ),
                        "application/json",
                      )
                    }
                  >
                    ↓ Baixar relatório de envio
                  </button>
                </>
              )}
            </section>
          )}
        </main>
      </div>
      <InstitutionalFooter />
    </div>
  );
}
