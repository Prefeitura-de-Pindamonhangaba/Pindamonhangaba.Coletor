import { describe, expect, test } from "bun:test";
import {
  createTemplate,
  parseCsv,
} from "../src/modules/imports/services/csv-service";
import { importController } from "../src/modules/imports/controllers/import-controller";
import Papa from "papaparse";

const row = {
  folha_pagamento: "true",
  dt_pagamento: "2025-03-05",
  cd_fonte_recurso: "01",
  tp_meio_pagamento: "2",
  vl_pagamento: "1250,50",
  id_importacao: "1",
};
const csv = (rows: Record<string, string>[]) =>
  Papa.unparse(rows, { delimiter: ";" });
describe("Importação CSV", () => {
  test("preserva zeros e converte decimal brasileiro", () => {
    const result = parseCsv("\uFEFF" + csv([row]), "pagamentos");
    expect(result.errors).toEqual([]);
    expect(result.records[0]).toMatchObject({
      cd_fonte_recurso: "01",
      vl_pagamento: 1250.5,
      folha_pagamento: true,
    });
  });
  test("exige documento quando não é folha e conta para transferência", () => {
    const result = parseCsv(
      csv([{ ...row, folha_pagamento: "false", tp_meio_pagamento: "1" }]),
      "pagamentos",
    );
    expect(result.errors.map((item) => item.field)).toContain(
      "documento_fiscal",
    );
    expect(result.errors.map((item) => item.field)).toContain("conta_bancaria");
  });
  test("rejeita data inválida, valor negativo e id duplicado", () => {
    const result = parseCsv(
      csv([{ ...row, dt_pagamento: "2025-02-30", vl_pagamento: "-1" }, row]),
      "pagamentos",
    );
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
  });
  test("rejeita arquivos vazios e colunas desconhecidas", () => {
    expect(
      parseCsv(createTemplate("contratos"), "contratos").errors.length,
    ).toBeGreaterThan(0);
    expect(
      parseCsv(csv([{ ...row, extra: "x" }]), "pagamentos").errors[0]?.field,
    ).toBe("extra");
  });
  test("rejeita listas JSON inválidas", () => {
    const result = parseCsv(
      "cpf;nome;remuneracoes\n12345678901;Teste;invalido",
      "funcionarios",
    );
    expect(result.errors.some((error) => error.field === "remuneracoes")).toBe(
      true,
    );
  });
  test("bloqueia origem externa antes de chamar a integração", async () => {
    const response = await importController(
      new Request("http://localhost/api/imports", {
        method: "POST",
        headers: { origin: "https://externo.example" },
        body: "{}",
      }),
    );
    expect(response.status).toBe(403);
  });
});
