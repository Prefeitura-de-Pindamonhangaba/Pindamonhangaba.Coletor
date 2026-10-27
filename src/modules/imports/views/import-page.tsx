"use client";
import { useRef, useState } from "react";
import {
  InstitutionalHeader,
  InstitutionalFooter,
} from "../../../shared/components/institutional-shell";
import { getColumns, integrations, type ImportKind } from "../models/catalog";
import {
  createTemplate,
  parseCsv,
  type Preview,
} from "../services/csv-service";

function download(name: string, data: string, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}
export function ImportPage() {
  const [kind, setKind] = useState<ImportKind>("contratos");
  const [code, setCode] = useState("");
  const [access, setAccess] = useState("");
  const [csv, setCsv] = useState("");
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const integration = integrations.find((item) => item.id === kind)!;
  function reset() {
    setCsv("");
    setFileName("");
    setPreview(null);
    setResult(null);
    setMessage("");
    setConfirmed(false);
    setAttempted(false);
    if (input.current) input.current.value = "";
  }
  async function load(file?: File) {
    if (!file) return;
    reset();
    if (!file.name.toLowerCase().endsWith(".csv") || file.size > 2_000_000) {
      setMessage("Selecione um arquivo .csv de até 2 MB.");
      return;
    }
    try {
      const text = new TextDecoder("utf-8", { fatal: true }).decode(
        await file.arrayBuffer(),
      );
      setCsv(text);
      setFileName(file.name);
      setPreview(parseCsv(text, kind));
    } catch {
      setMessage(
        "Não foi possível ler o arquivo. Salve a planilha como CSV UTF-8.",
      );
    }
  }
  async function submit() {
    setBusy(true);
    setMessage("");
    setAttempted(true);
    try {
      const response = await fetch("/api/imports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${access}`,
        },
        body: JSON.stringify({ kind, code, csv }),
      });
      const body = (await response.json()) as Record<string, unknown>;
      if (!response.ok) setMessage(String(body.error ?? "Falha no envio."));
      else {
        setResult(body);
        setMessage(
          "Processamento concluído. Confira o resultado antes de qualquer novo envio.",
        );
      }
    } catch {
      setMessage(
        "Não foi possível confirmar o resultado. Consulte o GCC antes de reenviar.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="shell">
      <InstitutionalHeader csv />
      <div className="workspace">
        <main id="importacao">
          <div className="breadcrumb">
            Integrações <span>/</span> GCC — Terceiro setor
          </div>
          <div className="page-heading">
            <div>
              <p className="eyebrow">COLETA E INTEGRAÇÃO DE DADOS</p>
              <h1>Importar planilha</h1>
              <p>Do seu CSV à prestação de contas, em um só lugar.</p>
            </div>
            <a
              className="button secondary"
              href="https://siapegov.pindamonhangaba.sp.gov.br/gcc-web/api-pc3s-swagger"
              target="_blank"
              rel="noreferrer"
            >
              Documentação da API ↗
            </a>
          </div>
          <ol className="steps">
            <li className="current">
              <b>01</b>
              <span>
                Preparar arquivo<small>Escolha a integração e o CSV</small>
              </span>
            </li>
            <li className={preview ? "current" : ""}>
              <b>02</b>
              <span>
                Conferir dados<small>Revise a validação da planilha</small>
              </span>
            </li>
            <li className={result ? "current" : ""}>
              <b>03</b>
              <span>
                Enviar para o GCC<small>Acompanhe o resultado</small>
              </span>
            </li>
          </ol>
          <div className="content-grid">
            <section className="panel">
              <div className="section-title">
                <span className="section-number">01</span>
                <div>
                  <h2>Prepare a importação</h2>
                  <p>Selecione os dados que deseja enviar.</p>
                </div>
              </div>
              <label htmlFor="kind">Tipo de importação</label>
              <select
                id="kind"
                disabled={busy}
                value={kind}
                onChange={(event) => {
                  setKind(event.target.value as ImportKind);
                  reset();
                }}
              >
                {integrations.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
              <p className="field-help">{integration.description}</p>
              <label htmlFor="code">
                Código do ajuste <span>*</span>
              </label>
              <input
                id="code"
                value={code}
                disabled={busy || attempted}
                onChange={(event) => {
                  setCode(event.target.value);
                  setConfirmed(false);
                }}
                placeholder="Informe o código do repasse"
                autoComplete="off"
              />
              <p className="field-help">
                Identificador do repasse no GCC (nr_ato_juridico_tce).
              </p>
              <div className="file-heading">
                <label htmlFor="file">Planilha CSV</label>
                <button
                  className="text-button"
                  disabled={busy}
                  onClick={() =>
                    download(
                      `modelo-${kind}.csv`,
                      createTemplate(kind),
                      "text/csv;charset=utf-8",
                    )
                  }
                >
                  ↓ Baixar modelo
                </button>
              </div>
              <div
                className="dropzone"
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  if (!busy) void load(event.dataTransfer.files[0]);
                }}
              >
                <span className="upload-icon">↥</span>
                <strong>{fileName || "Arraste sua planilha até aqui"}</strong>
                <p>ou selecione um arquivo do seu computador</p>
                <label className="button secondary file-button" htmlFor="file">
                  {fileName ? "Trocar arquivo" : "Selecionar arquivo"}
                </label>
                <input
                  ref={input}
                  id="file"
                  type="file"
                  accept=".csv,text/csv"
                  disabled={busy}
                  onChange={(event) => void load(event.target.files?.[0])}
                />
                <small>CSV em UTF-8 · Até 2 MB · Até 1.000 registros</small>
              </div>
              <div className="privacy-note">
                ◈{" "}
                <span>
                  A validação acontece no seu navegador. Os dados são enviados
                  somente após sua confirmação.
                </span>
              </div>
            </section>
            <aside className="guide panel" id="guia">
              <p className="eyebrow">ANTES DE COMEÇAR</p>
              <h2>
                Uma planilha bem
                <br />
                preparada faz a diferença.
              </h2>
              <div className="guide-item">
                <b>1</b>
                <div>
                  <h3>Use o modelo da integração</h3>
                  <p>
                    Preserve os nomes das colunas. Campos com ponto representam
                    dados vinculados.
                  </p>
                </div>
              </div>
              <div className="guide-item">
                <b>2</b>
                <div>
                  <h3>Confira os formatos</h3>
                  <p>
                    Datas: AAAA-MM-DD. Valores: 1250.50 ou 1250,50, sem
                    separador de milhar. Booleanos: true ou false.
                  </p>
                </div>
              </div>
              <div className="guide-item">
                <b>3</b>
                <div>
                  <h3>Atenção às listas</h3>
                  <p>
                    Naturezas, salários e remunerações devem ser listas JSON
                    dentro da célula. Exporte pelo editor de planilhas para
                    preservar as aspas.
                  </p>
                </div>
              </div>
              <div className="guide-footer">
                O envio utiliza o ambiente de produção.
                <br />
                Revise o ajuste e todos os registros.
              </div>
            </aside>
          </div>
          <details className="panel dictionary">
            <summary>
              Consultar colunas de {integration.name.toLowerCase()}{" "}
              <span>{getColumns(kind).length} campos</span>
            </summary>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Coluna</th>
                    <th>Formato</th>
                    <th>Orientação</th>
                  </tr>
                </thead>
                <tbody>
                  {getColumns(kind).map((column) => (
                    <tr key={column.key}>
                      <td>
                        <code>{column.key}</code>
                        {column.required && " *"}
                      </td>
                      <td>
                        {column.schema.type === "array"
                          ? "Lista JSON"
                          : (column.schema.format ?? column.schema.type)}
                      </td>
                      <td>
                        {column.schema.description ??
                          "Conforme documentação da API."}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="field-help">
              * Obrigatório. Outros campos podem ser exigidos conforme os dados
              e as tabelas de referência do GCC.
            </p>
          </details>
          {preview && (
            <section className="panel preview">
              <div className="section-title">
                <span className="section-number">02</span>
                <div>
                  <h2>Confira os dados</h2>
                  <p>
                    {preview.records.length} registros ·{" "}
                    {preview.headers.length} colunas · {preview.errors.length}{" "}
                    pendências
                  </p>
                </div>
                <span
                  className={`status ${preview.errors.length ? "invalid" : ""}`}
                >
                  {preview.errors.length
                    ? "Revisão necessária"
                    : "Validação local concluída"}
                </span>
              </div>
              {preview.errors.length > 0 ? (
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Linha</th>
                        <th>Campo</th>
                        <th>Pendência</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.errors.slice(0, 100).map((error, index) => (
                        <tr key={index}>
                          <td>{error.row}</td>
                          <td>{error.field}</td>
                          <td>{error.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p>
                    Exibindo até 100 pendências. Corrija e selecione o arquivo
                    novamente.
                  </p>
                </div>
              ) : (
                <>
                  <p>
                    Prévia dos primeiros 5 registros. Listas e vínculos aparecem
                    em formato JSON.
                  </p>
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Registro</th>
                          <th>Dados que serão enviados</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.records.slice(0, 5).map((record, index) => (
                          <tr key={index}>
                            <td>{index + 1}</td>
                            <td>
                              <pre>{JSON.stringify(record, null, 2)}</pre>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="send-area">
                    <label htmlFor="access">Código de acesso ao coletor</label>
                    <input
                      id="access"
                      type="password"
                      autoComplete="off"
                      value={access}
                      disabled={busy}
                      onChange={(event) => setAccess(event.target.value)}
                      placeholder="Fornecido pelo administrador"
                    />
                    <p className="field-help">
                      A chave da API GCC é mantida exclusivamente no servidor.
                    </p>
                    <label className="checkbox">
                      <input
                        type="checkbox"
                        checked={confirmed}
                        disabled={busy || attempted}
                        onChange={(event) => setConfirmed(event.target.checked)}
                      />
                      Revisei os registros e confirmo o envio ao ajuste{" "}
                      {code || "(informe o código)"} no GCC.
                    </label>
                    <button
                      className="button primary"
                      disabled={
                        busy ||
                        attempted ||
                        !confirmed ||
                        !code.trim() ||
                        !access
                      }
                      onClick={() => void submit()}
                    >
                      {busy ? "Enviando…" : "Confirmar e enviar ao GCC →"}
                    </button>
                    {attempted && (
                      <p className="field-help">
                        Para outro envio, selecione um arquivo novamente.
                        Confira antes o resultado no GCC para evitar
                        duplicidades.
                      </p>
                    )}
                  </div>
                </>
              )}
            </section>
          )}
          {message && (
            <div className="notice" role="status">
              {message}
            </div>
          )}
          {result && (
            <section className="panel">
              <h2>Resultado da importação</h2>
              <p>
                {String(result.importados)} importados · {String(result.erros)}{" "}
                erros
              </p>
              <pre className="result">{JSON.stringify(result, null, 2)}</pre>
              <button
                className="button secondary"
                onClick={() =>
                  download(
                    "resultado-importacao.json",
                    JSON.stringify(result, null, 2),
                    "application/json",
                  )
                }
              >
                ↓ Baixar relatório
              </button>
            </section>
          )}
        </main>
      </div>
      <InstitutionalFooter />
    </div>
  );
}
