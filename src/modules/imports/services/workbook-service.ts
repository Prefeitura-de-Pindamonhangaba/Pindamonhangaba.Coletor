import ExcelJS from "exceljs";
import { Open } from "unzipper";
import Papa from "papaparse";
import JSZip from "jszip";
import {
  getWorkbookSheets,
  instruments,
  MODEL_VERSION,
  submissionOrder,
  type WorkbookIssue,
  type WorkbookPreview,
} from "../models/workbook-catalog";
import { integrations, type ImportKind } from "../models/catalog";
import { parseCsv } from "./csv-service";

export type InputRow = { line: number; values: Record<string, string> };
export type InputTable = { headers: string[]; rows: InputRow[] };
export type InputTables = Record<string, InputTable>;
export class WorkbookError extends Error {}
const MAX_FILE_SIZE = 5_000_000;
const MAX_EXPANDED_SIZE = 25_000_000;

export async function readWorkbookFiles(files: File[]): Promise<InputTables> {
  if (
    !files.length ||
    files.length > 12 ||
    files.reduce((sum, file) => sum + file.size, 0) > MAX_FILE_SIZE
  )
    throw new WorkbookError(
      "Selecione um XLSX ou os CSVs do ajuste, com até 5 MB no total.",
    );
  const isExcel = files.some((file) =>
    file.name.toLowerCase().endsWith(".xlsx"),
  );
  if (
    isExcel &&
    (files.length !== 1 || !files[0]!.name.toLowerCase().endsWith(".xlsx"))
  )
    throw new WorkbookError(
      "Envie um único XLSX ou vários CSVs, sem misturar os formatos.",
    );
  const tables: InputTables = {};
  if (isExcel) {
    const bytes = Buffer.from(await files[0]!.arrayBuffer());
    try {
      const directory = await Open.buffer(bytes);
      if (
        directory.files.length > 500 ||
        directory.files.reduce((sum, item) => sum + item.uncompressedSize, 0) >
          MAX_EXPANDED_SIZE ||
        directory.files.some((item) =>
          /vbaProject|externalLinks/i.test(item.path),
        )
      )
        throw new WorkbookError(
          "Arquivo expandido muito grande ou com vínculos externos/macros. Utilize o modelo.",
        );
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(await normalizeSpreadsheetNamespace(bytes));
      if (workbook.worksheets.length > 12)
        throw new WorkbookError("O arquivo excede o número de abas permitido.");
      for (const sheet of workbook.worksheets) {
        if (["Orientacoes", "Dicionario"].includes(sheet.name)) continue;
        if (sheet.rowCount > 1001 || sheet.columnCount > 40)
          throw new WorkbookError(
            `Aba ${sheet.name}: limite de 1.000 linhas e 40 colunas.`,
          );
        const headers: string[] = [];
        sheet
          .getRow(1)
          .eachCell({ includeEmpty: true }, (cell) =>
            headers.push(cellString(cell.value).trim()),
          );
        const rows: InputRow[] = [];
        sheet.eachRow((row, line) => {
          if (line === 1) return;
          const values: Record<string, string> = {};
          row.eachCell({ includeEmpty: true }, (cell, index) => {
            const value = cellString(cell.value).trim();
            if (value && !headers[index - 1])
              throw new WorkbookError(
                `Aba ${sheet.name}, linha ${line}: célula preenchida sem cabeçalho.`,
              );
            if (headers[index - 1]) values[headers[index - 1]!] = value;
          });
          if (Object.values(values).some(Boolean)) rows.push({ line, values });
        });
        tables[sheet.name] = { headers, rows };
      }
    } catch (error) {
      throw error instanceof WorkbookError
        ? error
        : new WorkbookError(
            "XLSX inválido, protegido ou incompatível. Utilize o modelo disponível.",
          );
    }
  } else {
    for (const file of files) {
      if (!file.name.toLowerCase().endsWith(".csv"))
        throw new WorkbookError(
          "Formato não permitido. Utilize XLSX ou CSV UTF-8.",
        );
      const name = file.name.replace(/\.csv$/i, "");
      if (
        Object.keys(tables).some(
          (key) => key.toLowerCase() === name.toLowerCase(),
        )
      )
        throw new WorkbookError(
          "Há arquivos CSV repetidos para a mesma tabela.",
        );
      let text: string;
      try {
        text = new TextDecoder("utf-8", { fatal: true }).decode(
          await file.arrayBuffer(),
        );
      } catch {
        throw new WorkbookError("Salve os arquivos CSV em UTF-8.");
      }
      const result = Papa.parse<string[]>(text.replace(/^\uFEFF/, ""), {
        skipEmptyLines: false,
      });
      if (result.errors.some((error) => error.code !== "UndetectableDelimiter"))
        throw new WorkbookError(
          `CSV ${file.name}: confira aspas e separadores.`,
        );
      const headers = (result.data[0] ?? []).map((value) => value.trim());
      if (headers.length > 40)
        throw new WorkbookError(`CSV ${file.name}: limite de 40 colunas.`);
      const rows: InputRow[] = [];
      result.data.slice(1).forEach((row, index) => {
        if (!row.some((cell) => cell.trim())) return;
        if (row.length !== headers.length)
          throw new WorkbookError(
            `CSV ${file.name}, linha ${index + 2}: número de células diferente do cabeçalho.`,
          );
        if (row.some((value) => value.length > 10000))
          throw new WorkbookError(
            `CSV ${file.name}: célula acima de 10.000 caracteres.`,
          );
        rows.push({
          line: index + 2,
          values: Object.fromEntries(
            headers.map((header, col) => [header, row[col]?.trim() ?? ""]),
          ),
        });
      });
      if (rows.length > 1000)
        throw new WorkbookError(`CSV ${file.name}: limite de 1.000 registros.`);
      tables[name] = { headers, rows };
    }
  }
  return tables;
}

async function normalizeSpreadsheetNamespace(
  bytes: Buffer,
): Promise<ArrayBuffer> {
  // ExcelJS 4.4 não reconhece o prefixo válido x: emitido no OpenXML pelo gerador.
  // Normaliza somente esse namespace para a forma padrão, sem alterar valores.
  const zip = await JSZip.loadAsync(bytes);
  let changed = false;
  for (const entry of Object.values(zip.files)) {
    if (!entry.name.endsWith(".xml")) continue;
    const xml = await entry.async("string");
    if (
      !xml.includes(
        'xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main"',
      )
    )
      continue;
    zip.file(
      entry.name,
      xml
        .replaceAll(
          'xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main"',
          'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"',
        )
        .replaceAll("<x:", "<")
        .replaceAll("</x:", "</"),
    );
    changed = true;
  }
  return changed
    ? await zip.generateAsync({ type: "arraybuffer" })
    : new Uint8Array(bytes).buffer;
}

function cellString(value: ExcelJS.CellValue): string {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object")
    throw new WorkbookError(
      "Fórmulas, hiperlinks e células compostas não são aceitos nas abas de dados. Cole apenas os valores.",
    );
  const text = String(value);
  if (text.length > 10000)
    throw new WorkbookError("Célula muito longa. Limite de 10.000 caracteres.");
  return text;
}

export function prepareWorkbook(
  input: InputTables,
  selectedInstrument: string,
) {
  if (!instruments.some((item) => item.id === selectedInstrument))
    throw new WorkbookError("Instrumento inválido.");
  const definitions = getWorkbookSheets(selectedInstrument);
  const tables: InputTables = {};
  const errors: WorkbookIssue[] = [];
  const issue = (sheet: string, row: number, field: string, message: string) =>
    errors.push({ sheet, row, field, message });
  for (const [name, table] of Object.entries(input)) {
    const definition = definitions.find(
      (item) => item.name.toLowerCase() === name.toLowerCase(),
    );
    if (!definition) {
      issue(
        name,
        1,
        "aba",
        "Tabela não prevista para este instrumento. Nenhum dado será ignorado no envio.",
      );
      continue;
    }
    if (tables[definition.name]) {
      issue(name, 1, "aba", "Tabela duplicada.");
      continue;
    }
    tables[definition.name] = table;
    const seen = new Set<string>();
    for (const header of table.headers) {
      if (!header || seen.has(header))
        issue(name, 1, header, "Cabeçalho vazio ou repetido.");
      seen.add(header);
      if (!definition.columns.some((col) => col.key === header))
        issue(
          name,
          1,
          header,
          "Coluna desconhecida. Preserve os cabeçalhos do modelo.",
        );
    }
    if (table.rows.length)
      for (const column of definition.columns)
        if (column.required && !seen.has(column.key))
          issue(name, 1, column.key, "Coluna obrigatória ausente.");
  }
  const metadata = tables.Ajuste?.rows ?? [];
  if (metadata.length !== 1)
    issue(
      "Ajuste",
      2,
      "codigo_ajuste",
      "Preencha exatamente uma linha de identificação do ajuste.",
    );
  const values = metadata[0]?.values ?? {};
  if (values.versao_modelo !== MODEL_VERSION)
    issue(
      "Ajuste",
      2,
      "versao_modelo",
      "Versão de modelo inválida. Baixe o modelo atualizado.",
    );
  if (values.tipo_instrumento !== selectedInstrument)
    issue(
      "Ajuste",
      2,
      "tipo_instrumento",
      "O instrumento do arquivo difere do selecionado.",
    );
  if (!values.codigo_ajuste || values.codigo_ajuste.length > 100)
    issue(
      "Ajuste",
      2,
      "codigo_ajuste",
      "Informe o código do ajuste com até 100 caracteres.",
    );
  if (!/^\d{4}$/.test(values.ano ?? "") || Number(values.ano) < 2024)
    issue(
      "Ajuste",
      2,
      "ano",
      "Informe o exercício com quatro dígitos, a partir de 2024.",
    );

  const records: Partial<Record<ImportKind, Record<string, unknown>[]>> = {};
  for (const definition of definitions.filter((item) => item.kind)) {
    const kind = definition.kind!;
    const rows = tables[definition.name]?.rows ?? [];
    if (!rows.length) continue;
    const prepared = rows.map((row) => ({ ...row.values }));
    const keyField = kind === "contratos" ? "id_importacao" : "cpf";
    const keyOf = (value: string | undefined) =>
      keyField === "id_importacao" ? String(Number(value)) : value;
    const parentKeys = new Set<string | undefined>();
    rows.forEach((row) => {
      const key = keyOf(row.values[keyField]);
      if (
        parentKeys.has(key) &&
        kind !== "documentos_fiscais" &&
        kind !== "pagamentos"
      )
        issue(
          definition.name,
          row.line,
          keyField,
          "Chave repetida na tabela principal.",
        );
      parentKeys.add(key);
    });
    for (const child of definitions.filter((item) => item.parent === kind)) {
      const childRows = tables[child.name]?.rows ?? [];
      for (const row of childRows)
        if (!parentKeys.has(keyOf(row.values[child.foreignKey!])))
          issue(
            child.name,
            row.line,
            child.foreignKey!,
            "Registro principal não encontrado neste arquivo.",
          );
      rows.forEach((row, index) => {
        const matches = childRows.filter(
          (item) =>
            keyOf(item.values[child.foreignKey!]) ===
            keyOf(row.values[keyField]),
        );
        const used = new Set<string>();
        const items = matches.map((item) => {
          const record: Record<string, unknown> = {};
          if (
            child.array === "remuneracoes" &&
            item.values.ano &&
            item.values.ano !== values.ano
          )
            issue(
              child.name,
              item.line,
              "ano",
              "A competência deve pertencer ao exercício informado na aba Ajuste.",
            );
          for (const column of child.columns.filter(
            (col) => col.key !== child.foreignKey,
          )) {
            const raw = item.values[column.key];
            if (!raw) continue;
            if (
              ["integer", "number"].includes(column.schema.type ?? "") &&
              /^-?\d+(?:[.,]\d+)?$/.test(raw)
            )
              record[column.key] = Number(raw.replace(",", "."));
            else record[column.key] = raw;
          }
          const unique =
            child.array === "salario_contratual"
              ? String(record.dt_salario)
              : child.array === "remuneracoes"
                ? `${record.ano}/${record.mes}`
                : String(record.tp_natureza_contratacao);
          if (used.has(unique))
            issue(
              child.name,
              item.line,
              "registro",
              "Competência, data salarial ou natureza repetida para o mesmo registro.",
            );
          used.add(unique);
          return record;
        });
        prepared[index]![child.array!] = JSON.stringify(items);
      });
    }
    const fields = [
      ...definition.columns.map((column) => column.key),
      ...definitions
        .filter((item) => item.parent === kind)
        .map((item) => item.array!),
    ];
    const preview = parseCsv(
      Papa.unparse({
        fields,
        data: prepared.map((row) => fields.map((field) => row[field] ?? "")),
      }),
      kind,
    );
    preview.errors.forEach((error) =>
      issue(
        definition.name,
        rows[error.row - 2]?.line ?? error.row,
        error.field,
        error.message,
      ),
    );
    records[kind] = preview.records;
  }
  for (const child of definitions.filter((item) => item.parent))
    if (
      (tables[child.name]?.rows.length ?? 0) &&
      !records[child.parent!]?.length
    )
      issue(
        child.name,
        2,
        child.foreignKey!,
        "A tabela principal está vazia ou ausente.",
      );
  if (!Object.values(records).some((items) => items?.length))
    issue("Ajuste", 2, "dados", "Preencha ao menos uma tabela de dados.");
  const batches = submissionOrder
    .filter((kind) => records[kind]?.length)
    .map((kind) => ({
      kind,
      name: integrations.find((item) => item.id === kind)!.name,
      count: records[kind]!.length,
      sample: records[kind]!.slice(0, 3),
    }));
  const preview: WorkbookPreview = {
    instrument: selectedInstrument,
    code: values.codigo_ajuste ?? "",
    year: values.ano ?? "",
    errors,
    batches,
    sheets: definitions.map((item) => ({
      name: item.name,
      count: tables[item.name]?.rows.length ?? 0,
    })),
  };
  return { preview, records };
}
