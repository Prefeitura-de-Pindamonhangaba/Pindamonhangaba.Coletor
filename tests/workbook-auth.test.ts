import { expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import ExcelJS from "exceljs";
import { createWorkbookController } from "../src/modules/imports/controllers/workbook-controller";
import { CredentialError } from "../src/modules/credentials/services/credential-service";

async function request(credentialId: string) {
  // Fixture sintética em memória, sem dados de usuários nem chamadas ao GCC.
  const workbook = new ExcelJS.Workbook();
  workbook.addWorksheet("Ajuste").addRows([
    ["versao_modelo", "tipo_instrumento", "codigo_ajuste", "ano"],
    ["1", "termo_fomento", "000123", 2026],
  ]);
  workbook.addWorksheet("Pagamentos").addRows([
    [
      "folha_pagamento",
      "dt_pagamento",
      "cd_fonte_recurso",
      "tp_meio_pagamento",
      "vl_pagamento",
      "id_importacao",
    ],
    [true, "2026-01-03", "01", 2, 1250.5, 9],
  ]);
  const file = new File(
    [new Uint8Array(await workbook.xlsx.writeBuffer())],
    "modelo.xlsx",
  );
  const form = new FormData();
  form.set("instrument", "termo_fomento");
  form.set("kind", "pagamentos");
  form.set("credentialId", credentialId);
  form.append("files", file);
  const origin = process.env.APP_URL
    ? new URL(process.env.APP_URL).origin
    : "http://localhost";
  return new Request(`${origin}/api/workbooks?action=send`, {
    method: "POST",
    headers: { origin },
    body: form,
  });
}
test("envio busca a chave selecionada para o usuário da sessão", async () => {
  const owner = randomUUID(),
    selected = randomUUID();
  const calls: unknown[][] = [];
  const controller = createWorkbookController({
    getPrincipal: async () => ({ id: owner, name: "Usuário teste" }),
    getGccSecret: async (userId, id) => {
      calls.push([userId, id]);
      return "segredo-selecionado";
    },
    sendRecords: async (kind, code, records, key) => {
      calls.push([kind, code, records, key]);
      return { importados: 1, erros: 0, errors: [] };
    },
  });
  expect((await controller(await request(selected))).status).toBe(200);
  expect(calls[0]).toEqual([owner, selected]);
  expect(calls[1]?.[0]).toBe("pagamentos");
  expect(calls[1]?.[1]).toBe("000123");
  expect(calls[1]?.[3]).toBe("segredo-selecionado");
});
test("chave indisponível bloqueia o envio antes de chamar o GCC", async () => {
  let sent = false;
  const controller = createWorkbookController({
    getPrincipal: async () => ({ id: randomUUID(), name: "Usuário teste" }),
    getGccSecret: async () => {
      throw new CredentialError(
        "Selecione uma chave GCC ativa cadastrada na sua conta.",
      );
    },
    sendRecords: async () => {
      sent = true;
      return { importados: 1, erros: 0, errors: [] };
    },
  });
  expect((await controller(await request(randomUUID()))).status).toBe(404);
  expect(sent).toBe(false);
});
