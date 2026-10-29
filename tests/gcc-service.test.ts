import { afterEach, expect, test, spyOn } from "bun:test";
import { sendRecords } from "../src/modules/imports/services/gcc-service";

let fetchSpy: ReturnType<typeof spyOn> | undefined;
afterEach(() => {
  fetchSpy?.mockRestore();
});
test("autentica no backend e preserva resultado parcial sem repetir envio", async () => {
  const calls: { url: string; body: unknown; authorization: string | null }[] =
    [];
  fetchSpy = spyOn(globalThis, "fetch").mockImplementation(
    Object.assign(
      async (url: Parameters<typeof fetch>[0], init?: RequestInit) => {
        calls.push({
          url: String(url),
          body: JSON.parse(String(init?.body)),
          authorization: new Headers(init?.headers).get("authorization"),
        });
        return Response.json(
          calls.length === 1
            ? { token: "mock-jwt" }
            : {
                importados: 1,
                erros: 1,
                errors: [{ id_importacao: 2, error: "Registro duplicado" }],
              },
        );
      },
      { preconnect: fetch.preconnect },
    ),
  );
  const result = await sendRecords(
    "contratos",
    "001",
    [{ id_importacao: 1 }, { id_importacao: 2 }],
    "mock-key",
  );
  expect(calls.length).toBe(2);
  expect(calls[0]?.body).toEqual({ gcc_key: "mock-key" });
  expect(calls[1]?.authorization).toBe("Bearer mock-jwt");
  expect(calls[1]?.body).toMatchObject({ codigo_ajuste: "001" });
  expect(result.erros).toBe(1);
});
test("não repete requisições após falha de transporte", async () => {
  fetchSpy = spyOn(globalThis, "fetch").mockRejectedValue(new Error("timeout"));
  await expect(
    sendRecords("pagamentos", "001", [], "mock-key"),
  ).rejects.toThrow("Confira no GCC");
  expect(fetchSpy).toHaveBeenCalledTimes(1);
});
