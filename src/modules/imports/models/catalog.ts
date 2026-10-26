import spec from "../../../../docs/siape-openapi.json";

export type Schema = {
  type?: string;
  format?: string;
  description?: string;
  nullable?: boolean;
  $ref?: string;
  properties?: Record<string, Schema>;
  required?: string[];
  items?: Schema;
  allOf?: Schema[];
  example?: unknown;
};
export const schemas = spec.components.schemas as Record<string, Schema>;
export const integrations = [
  {
    id: "contratos",
    name: "Contratos",
    schema: "Contrato",
    description: "Contratos, credores e naturezas de contratação",
  },
  {
    id: "documentos_fiscais",
    name: "Documentos fiscais",
    schema: "DocumentoFiscal",
    description: "Notas fiscais, despesas e vínculos contratuais",
  },
  {
    id: "pagamentos",
    name: "Pagamentos",
    schema: "Pagamento",
    description: "Pagamentos, fontes de recurso e contas bancárias",
  },
  {
    id: "funcionarios",
    name: "Funcionários",
    schema: "Funcionario",
    description: "Cadastro, salários e remunerações",
  },
  {
    id: "servidores_cedidos",
    name: "Servidores cedidos",
    schema: "ServidorCedido",
    description: "Cessões e remunerações de servidores",
  },
] as const;
export type ImportKind = (typeof integrations)[number]["id"];
export function resolveSchema(schema: Schema): Schema {
  if (schema.$ref)
    return resolveSchema(schemas[schema.$ref.split("/").pop()!]!);
  if (schema.allOf)
    return { ...resolveSchema(schema.allOf[0]!), nullable: schema.nullable };
  return schema;
}
export function getColumns(kind: ImportKind) {
  const integration = integrations.find((item) => item.id === kind)!;
  const columns: { key: string; required: boolean; schema: Schema }[] = [];
  function visit(input: Schema, prefix = "", parentRequired = true) {
    const schema = resolveSchema(input);
    for (const [key, value] of Object.entries(schema.properties ?? {})) {
      const field = resolveSchema(value);
      const path = prefix ? `${prefix}.${key}` : key;
      const required = parentRequired && (schema.required ?? []).includes(key);
      if (field.type === "object") visit(field, path, required);
      else columns.push({ key: path, required, schema: field });
    }
  }
  visit(schemas[integration.schema]!);
  return columns;
}
