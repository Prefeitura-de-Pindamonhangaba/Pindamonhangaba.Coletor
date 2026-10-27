import audesp from "../../../../docs/audesp-instruments.json";
import {
  getColumns,
  schemas,
  resolveSchema,
  type ImportKind,
  type Schema,
} from "./catalog";

export const instruments = audesp.instruments;
export const MODEL_VERSION = "1";
export type WorkbookColumn = { key: string; required: boolean; schema: Schema };
export type SheetDefinition = {
  name: string;
  description: string;
  kind?: ImportKind;
  columns: WorkbookColumn[];
  parent?: ImportKind;
  array?: string;
  foreignKey?: string;
};
const text = (
  key: string,
  description: string,
  required = true,
): WorkbookColumn => ({
  key,
  required,
  schema: { type: "string", description },
});
const baseSheets: SheetDefinition[] = [
  {
    name: "Ajuste",
    description:
      "Um arquivo por instrumento, ajuste e exercício. Preencha uma única linha.",
    columns: [
      text("versao_modelo", "Preserve a versão do modelo."),
      text("tipo_instrumento", "Preserve o tipo do instrumento."),
      text(
        "codigo_ajuste",
        "Código do repasse existente na Embras, preservando zeros.",
      ),
      {
        key: "ano",
        required: true,
        schema: {
          type: "integer",
          description:
            "Exercício da prestação, a partir de 2024. Contexto local; não altera o cadastro do GCC.",
        },
      },
    ],
  },
  ...(
    [
      "contratos",
      "documentos_fiscais",
      "pagamentos",
      "funcionarios",
      "servidores_cedidos",
    ] as ImportKind[]
  ).map((kind) => ({
    name: {
      contratos: "Contratos",
      documentos_fiscais: "Documentos_Fiscais",
      pagamentos: "Pagamentos",
      funcionarios: "Funcionarios",
      servidores_cedidos: "Servidores_Cedidos",
    }[kind],
    kind,
    description:
      "Uma linha por registro. Deixe apenas o cabeçalho quando não houver dados.",
    columns: getColumns(kind).filter(
      (column) => column.schema.type !== "array",
    ),
  })),
];
function childSheet(
  name: string,
  parent: ImportKind,
  parentSchema: string,
  array: string,
  foreignKey: string,
  description: string,
): SheetDefinition {
  const item = resolveSchema(
    resolveSchema(schemas[parentSchema]!).properties![array]!.items!,
  );
  return {
    name,
    parent,
    array,
    foreignKey,
    description,
    columns: [
      text(
        foreignKey,
        foreignKey === "cpf"
          ? "CPF do registro na aba principal, com 11 dígitos."
          : "id_importacao do contrato na aba Contratos.",
      ),
      ...Object.entries(item.properties ?? {}).map(([key, schema]) => ({
        key,
        schema: resolveSchema(schema),
        required: (item.required ?? []).includes(key),
      })),
    ],
  };
}
const children = [
  childSheet(
    "Naturezas_Contrato",
    "contratos",
    "Contrato",
    "natureza_contratacao",
    "id_contrato",
    "Uma ou mais naturezas por contrato. Vincule pelo id_importacao do contrato.",
  ),
  childSheet(
    "Salarios",
    "funcionarios",
    "Funcionario",
    "salario_contratual",
    "cpf",
    "Histórico salarial: uma linha por CPF e data de início.",
  ),
  childSheet(
    "Remuneracoes_Func",
    "funcionarios",
    "Funcionario",
    "remuneracoes",
    "cpf",
    "Uma linha por funcionário e competência, com identificador de origem.",
  ),
  childSheet(
    "Remuneracoes_Cedidos",
    "servidores_cedidos",
    "ServidorCedido",
    "remuneracoes",
    "cpf",
    "Uma linha por servidor cedido e competência.",
  ),
];
export function getWorkbookSheets(instrument: string): SheetDefinition[] {
  const definition = instruments.find((item) => item.id === instrument);
  if (!definition) throw new Error("Instrumento inválido.");
  const byName = new Map(
    [...baseSheets, ...children].map((sheet) => [sheet.name, sheet]),
  );
  return [
    "Ajuste",
    "Contratos",
    "Naturezas_Contrato",
    "Documentos_Fiscais",
    "Pagamentos",
    "Funcionarios",
    "Salarios",
    "Remuneracoes_Func",
    ...(definition.supportsAssignedStaff
      ? ["Servidores_Cedidos", "Remuneracoes_Cedidos"]
      : []),
  ].map((name) => byName.get(name)!);
}
export const submissionOrder: ImportKind[] = [
  "contratos",
  "documentos_fiscais",
  "funcionarios",
  "servidores_cedidos",
  "pagamentos",
];
export type WorkbookIssue = {
  sheet: string;
  row: number;
  field: string;
  message: string;
};
export type WorkbookPreview = {
  instrument: string;
  code: string;
  year: string;
  errors: WorkbookIssue[];
  batches: {
    kind: ImportKind;
    name: string;
    count: number;
    sample: Record<string, unknown>[];
  }[];
  sheets: { name: string; count: number }[];
};
