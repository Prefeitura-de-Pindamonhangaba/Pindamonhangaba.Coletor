import { describe, expect, test } from "bun:test";
import {
  readWorkbookFiles,
  prepareWorkbook,
  type InputTables,
} from "../src/modules/imports/services/workbook-service";
import {
  getWorkbookSheets,
  instruments,
} from "../src/modules/imports/models/workbook-catalog";
import { workbookController } from "../src/modules/imports/controllers/workbook-controller";

function table(rows: Record<string, string>[]) {
  return {
    headers: Object.keys(rows[0] ?? {}),
    rows: rows.map((values, index) => ({ line: index + 2, values })),
  };
}
function fixture(): InputTables {
  return {
    Ajuste: table([
      {
        versao_modelo: "1",
        tipo_instrumento: "termo_fomento",
        codigo_ajuste: "000123",
        ano: "2026",
      },
    ]),
    Contratos: table([
      {
        nr_contrato: "001/2026",
        dt_assinatura: "2026-01-01",
        dt_vigencia_inicial: "2026-01-01",
        dt_vigencia_final: "2026-12-31",
        objeto: "Serviço",
        tp_vigencia: "1",
        tp_criterio_selecao: "10",
        artigo_regulamento: "Art. 30",
        tp_valor: "1",
        vl_contrato: "1000,50",
        id_importacao: "1",
        "credor.nr_documento": "12345678000195",
        "credor.nome": "Credor de teste",
      },
    ]),
    Naturezas_Contrato: table([
      { id_contrato: "1", tp_natureza_contratacao: "1" },
      { id_contrato: "1", tp_natureza_contratacao: "2" },
    ]),
    Funcionarios: table([
      {
        cpf: "01234567890",
        nome: "Pessoa de teste",
        cbo: "212405",
        dt_admissao: "2026-01-01",
      },
    ]),
    Salarios: table([
      { cpf: "01234567890", dt_salario: "2026-01-01", vl_salario: "4500" },
    ]),
    Remuneracoes_Func: table([
      {
        cpf: "01234567890",
        ano: "2026",
        mes: "1",
        carga_horaria: "40",
        vl_remuneracao: "4500",
        id_importacao: "10",
      },
      {
        cpf: "01234567890",
        ano: "2026",
        mes: "2",
        carga_horaria: "40",
        vl_remuneracao: "4600",
        id_importacao: "11",
      },
    ]),
  };
}
describe("Planilhas por instrumento", () => {
  test("diferencia os instrumentos conforme os schemas AUDESP", () => {
    expect(
      getWorkbookSheets("termo_fomento").some(
        (sheet) => sheet.name === "Servidores_Cedidos",
      ),
    ).toBe(false);
    expect(
      getWorkbookSheets("termo_colaboracao").some(
        (sheet) => sheet.name === "Servidores_Cedidos",
      ),
    ).toBe(false);
    expect(
      getWorkbookSheets("convenio").some(
        (sheet) => sheet.name === "Servidores_Cedidos",
      ),
    ).toBe(true);
  });
  test("monta os arrays relacionados preservando zeros, números e ordem de envio", () => {
    const result = prepareWorkbook(fixture(), "termo_fomento");
    expect(result.preview.errors).toEqual([]);
    expect(result.preview.code).toBe("000123");
    expect(result.records.contratos?.[0]?.natureza_contratacao).toEqual([
      { tp_natureza_contratacao: 1 },
      { tp_natureza_contratacao: 2 },
    ]);
    expect(result.records.contratos?.[0]?.vl_contrato).toBe(1000.5);
    expect(result.records.funcionarios?.[0]?.cpf).toBe("01234567890");
    expect(result.records.funcionarios?.[0]?.remuneracoes).toHaveLength(2);
    expect(result.preview.batches.map((batch) => batch.kind)).toEqual([
      "contratos",
      "funcionarios",
    ]);
  });
  test("não perde colunas opcionais preenchidas somente em linhas posteriores", () => {
    const input = fixture();
    input.Contratos!.rows.push({
      line: 3,
      values: {
        ...input.Contratos!.rows[0]!.values,
        id_importacao: "2",
        ds_criterio_selecao: "Descrição adicional",
      },
    });
    input.Naturezas_Contrato!.rows.push({
      line: 4,
      values: { id_contrato: "2", tp_natureza_contratacao: "1" },
    });
    const result = prepareWorkbook(input, "termo_fomento");
    expect(result.records.contratos?.[1]?.ds_criterio_selecao).toBe(
      "Descrição adicional",
    );
  });
  test("bloqueia vínculos órfãos, CPF repetido e competências duplicadas", () => {
    const input = fixture();
    input.Naturezas_Contrato!.rows[0]!.values.id_contrato = "999";
    input.Funcionarios!.rows.push({
      line: 3,
      values: { ...input.Funcionarios!.rows[0]!.values },
    });
    input.Remuneracoes_Func!.rows[1]!.values.mes = "1";
    const errors = prepareWorkbook(input, "termo_fomento").preview.errors;
    expect(
      errors.some(
        (error) =>
          error.sheet === "Naturezas_Contrato" &&
          error.message.includes("não encontrado"),
      ),
    ).toBe(true);
    expect(
      errors.some(
        (error) => error.field === "cpf" && error.message.includes("repetida"),
      ),
    ).toBe(true);
    expect(
      errors.some(
        (error) =>
          error.sheet === "Remuneracoes_Func" &&
          error.message.includes("repetida"),
      ),
    ).toBe(true);
  });
  test("bloqueia mistura de instrumentos, tabelas extras e cabeçalhos repetidos", () => {
    const input = fixture();
    input.Ajuste!.rows[0]!.values.tipo_instrumento = "convenio";
    input.Servidores_Cedidos = table([{ cpf: "01234567890" }]);
    input.Contratos!.headers.push("nr_contrato");
    const errors = prepareWorkbook(input, "termo_fomento").preview.errors;
    expect(errors.some((error) => error.field === "tipo_instrumento")).toBe(
      true,
    );
    expect(errors.some((error) => error.sheet === "Servidores_Cedidos")).toBe(
      true,
    );
    expect(errors.some((error) => error.message.includes("repetido"))).toBe(
      true,
    );
  });
  test("rejeita CSV e múltiplos arquivos", async () => {
    await expect(
      readWorkbookFiles([new File(["a;b\n1;2"], "Ajuste.csv")]),
    ).rejects.toThrow("único arquivo XLSX");
    await expect(
      readWorkbookFiles([new File([""], "a.xlsx"), new File([""], "b.xlsx")]),
    ).rejects.toThrow("único arquivo XLSX");
  });
  test("valida os cinco modelos XLSX disponibilizados para download", async () => {
    for (const instrument of instruments) {
      const bytes = await Bun.file(
        `public/templates/${instrument.id}.xlsx`,
      ).arrayBuffer();
      const tables = await readWorkbookFiles([
        new File([bytes], "modelo.xlsx"),
      ]);
      expect(Object.keys(tables)).toEqual(
        getWorkbookSheets(instrument.id).map((sheet) => sheet.name),
      );
      expect(tables.Ajuste?.rows[0]?.values.tipo_instrumento).toBe(
        instrument.id,
      );
      expect(
        prepareWorkbook(tables, instrument.id).preview.errors.some(
          (error) => error.field === "codigo_ajuste",
        ),
      ).toBe(true);
    }
  });
  test("preview aceita modelo XLSX sem credenciais", async () => {
    const form = new FormData();
    form.set("instrument", "termo_fomento");
    form.append(
      "files",
      new File(
        [await Bun.file("public/templates/termo_fomento.xlsx").arrayBuffer()],
        "modelo.xlsx",
      ),
    );
    const result = await workbookController(
      new Request("http://localhost/api/workbooks", {
        method: "POST",
        body: form,
      }),
    );
    expect(result.status).toBe(200);
    expect((await result.json()).errors).toHaveLength(3);
  });
  test("rota rejeita carga CSV", async () => {
    const form = new FormData();
    form.set("instrument", "termo_fomento");
    form.append("files", new File(["a;b\n1;2"], "Ajuste.csv"));
    const result = await workbookController(
      new Request("http://localhost/api/workbooks", {
        method: "POST",
        body: form,
      }),
    );
    expect(result.status).toBe(400);
  });
  test("rota bloqueia origem externa", async () => {
    const result = await workbookController(
      new Request("http://localhost/api/workbooks?action=send", {
        method: "POST",
        headers: { Origin: "https://outro.example" },
      }),
    );
    expect(result.status).toBe(403);
  });
});
