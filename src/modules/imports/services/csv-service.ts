import Papa from "papaparse";
import Ajv, { type ErrorObject } from "ajv";
import addFormats from "ajv-formats";
import {
  getColumns,
  integrations,
  schemas,
  type ImportKind,
} from "../models/catalog";

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);
ajv.addFormat("decimal", { type: "number", validate: Number.isFinite });
function normalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalize);
  if (!value || typeof value !== "object") return value;
  const object = Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, normalize(item)]),
  );
  if (object.nullable === true && !object.type) {
    delete object.nullable;
    return { anyOf: [object, { type: "null" }] };
  }
  return object;
}
ajv.addSchema({ $id: "gcc", components: { schemas: normalize(schemas) } });
const validators = Object.fromEntries(
  integrations.map((item) => [
    item.id,
    ajv.compile({ $ref: `gcc#/components/schemas/${item.schema}` }),
  ]),
);
function validationMessage(error: ErrorObject): string {
  if (error.keyword === "required")
    return `Campo obrigatório: ${String(error.params.missingProperty)}.`;
  if (error.keyword === "type")
    return `Formato inválido. Esperado: ${String(error.params.type)}.`;
  if (error.keyword === "format")
    return error.params.format === "date"
      ? "Data inválida. Use AAAA-MM-DD."
      : "Formato inválido.";
  if (error.keyword === "minItems")
    return "A lista precisa conter pelo menos um item.";
  if (error.keyword === "enum")
    return "Utilize um dos códigos permitidos pela API.";
  if (error.keyword === "pattern")
    return "O valor não corresponde ao formato exigido pela API.";
  if (error.keyword === "minimum" || error.keyword === "maximum")
    return `Valor fora do limite permitido: ${String(error.params.limit)}.`;
  if (error.keyword === "minLength" || error.keyword === "maxLength")
    return `Confira a quantidade de caracteres. Limite: ${String(error.params.limit)}.`;
  return "Valor inválido conforme o contrato da API.";
}
export type Preview = {
  records: Record<string, unknown>[];
  errors: { row: number; field: string; message: string }[];
  headers: string[];
};

export function parseCsv(text: string, kind: ImportKind): Preview {
  const parsed = Papa.parse<Record<string, string>>(
    text.replace(/^\uFEFF/, ""),
    {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (header) => header.trim(),
    },
  );
  const errors: Preview["errors"] = parsed.errors.map((error) => ({
    row: (error.row ?? 0) + 2,
    field: "CSV",
    message:
      error.code === "TooManyFields" || error.code === "TooFewFields"
        ? "Quantidade de células diferente do cabeçalho."
        : "Estrutura CSV inválida. Confira separadores e aspas.",
  }));
  const headers = parsed.meta.fields ?? [];
  const columns = getColumns(kind);
  for (const header of headers)
    if (!columns.some((column) => column.key === header))
      errors.push({
        row: 1,
        field: header,
        message: "Coluna desconhecida. Utilize o modelo desta integração.",
      });
  if (!parsed.data.length)
    errors.push({
      row: 1,
      field: "CSV",
      message: "O arquivo não contém registros.",
    });
  if (parsed.data.length > 1000)
    errors.push({
      row: 1,
      field: "CSV",
      message: "O limite é de 1.000 registros por arquivo.",
    });
  const records = parsed.data.slice(0, 1000).map((row, index) => {
    const record: Record<string, unknown> = {};
    for (const column of columns) {
      const raw = row[column.key]?.trim();
      if (!raw) continue;
      try {
        let value: unknown = raw;
        if (
          column.schema.type === "number" ||
          column.schema.type === "integer"
        ) {
          if (!/^-?\d+(?:[.,]\d+)?$/.test(raw))
            throw new Error("Use números sem separador de milhar.");
          value = Number(raw.replace(",", "."));
        } else if (column.schema.type === "boolean") {
          if (!["true", "false"].includes(raw))
            throw new Error("Use true ou false.");
          value = raw === "true";
        } else if (column.schema.type === "array") value = JSON.parse(raw);
        const keys = column.key.split(".");
        let target = record;
        keys.slice(0, -1).forEach((key) => {
          target[key] ??= {};
          target = target[key] as Record<string, unknown>;
        });
        target[keys.at(-1)!] = value;
      } catch (error) {
        errors.push({
          row: index + 2,
          field: column.key,
          message:
            column.schema.type === "array"
              ? "Lista JSON inválida. Confira colchetes, aspas e valores."
              : error instanceof Error
                ? error.message
                : "Valor inválido.",
        });
      }
    }
    const validate = validators[kind]!;
    if (!validate(record))
      for (const error of validate.errors ?? [])
        errors.push({
          row: index + 2,
          field:
            error.instancePath ||
            String(error.params.missingProperty ?? "registro"),
          message: validationMessage(error),
        });
    if (
      kind === "contratos" &&
      record.tp_vigencia === 1 &&
      !record.dt_vigencia_final
    )
      errors.push({
        row: index + 2,
        field: "dt_vigencia_final",
        message: "Obrigatória para vigência pré-estabelecida.",
      });
    if (kind === "pagamentos") {
      if (record.folha_pagamento === false && !record.documento_fiscal)
        errors.push({
          row: index + 2,
          field: "documento_fiscal",
          message: "Obrigatório quando não é folha de pagamento.",
        });
      if (record.tp_meio_pagamento === 1 && !record.conta_bancaria)
        errors.push({
          row: index + 2,
          field: "conta_bancaria",
          message: "Obrigatória para transferência bancária.",
        });
    }
    if (
      kind === "documentos_fiscais" &&
      record.proveniente_rateio === true &&
      !(Number(record.vl_rateio_percentual) > 0)
    )
      errors.push({
        row: index + 2,
        field: "vl_rateio_percentual",
        message: "Informe um percentual maior que zero para rateio.",
      });
    for (const key of ["vl_contrato", "vl_bruto", "vl_pagamento"])
      if (key in record && !(Number(record[key]) > 0))
        errors.push({
          row: index + 2,
          field: key,
          message: "O valor deve ser maior que zero.",
        });
    return record;
  });
  const ids = new Set<unknown>();
  records.forEach((record, index) => {
    if (record.id_importacao !== undefined) {
      if (ids.has(record.id_importacao))
        errors.push({
          row: index + 2,
          field: "id_importacao",
          message: "Identificador repetido no arquivo.",
        });
      ids.add(record.id_importacao);
    }
  });
  return { records, errors, headers };
}

export function createTemplate(kind: ImportKind) {
  return (
    "\uFEFF" +
    Papa.unparse(
      { fields: getColumns(kind).map((column) => column.key), data: [] },
      { delimiter: ";" },
    ) +
    "\r\n"
  );
}
