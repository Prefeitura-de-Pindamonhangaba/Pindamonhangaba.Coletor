import { z } from "zod";
import type { ImportKind } from "../models/catalog";

export class IntegrationError extends Error {}
const resultSchema = z
  .object({
    importados: z.number().int().nonnegative(),
    erros: z.number().int().nonnegative(),
    errors: z.array(z.object({ error: z.string() }).passthrough()).default([]),
  })
  .passthrough();
export async function sendRecords(
  kind: ImportKind,
  code: string,
  records: Record<string, unknown>[],
  gccKey: string,
) {
  if (!z.string().min(1).safeParse(gccKey).success)
    throw new IntegrationError("Selecione uma chave GCC válida para enviar.");
  const base =
    "https://siapegov.pindamonhangaba.sp.gov.br/gcc-web/api/integracoes";
  async function request(path: string, body: unknown, token?: string) {
    let response: Response;
    try {
      response = await fetch(base + path, {
        method: "POST",
        redirect: "error",
        signal: AbortSignal.timeout(30000),
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
        cache: "no-store",
      });
    } catch {
      throw new IntegrationError(
        "Não foi possível confirmar a resposta da API. Confira no GCC antes de repetir o envio.",
      );
    }
    if (!response.ok)
      throw new IntegrationError(
        response.status === 401 ||
          (response.status === 422 && path === "/login")
          ? "A API recusou a autenticação. Verifique a chave no servidor."
          : `A API recusou a requisição (HTTP ${response.status}). Confira os dados e consulte o GCC antes de reenviar.`,
      );
    try {
      return (await response.json()) as unknown;
    } catch {
      throw new IntegrationError(
        "Resposta inválida da API. Confira no GCC antes de reenviar.",
      );
    }
  }
  const login = z
    .object({ token: z.string().min(1) })
    .safeParse(await request("/login", { gcc_key: gccKey }));
  if (!login.success)
    throw new IntegrationError(
      "A autenticação retornou uma resposta inválida.",
    );
  const result = resultSchema.safeParse(
    await request(
      `/pc3s/${kind}`,
      { codigo_ajuste: code, [kind]: records },
      login.data.token,
    ),
  );
  if (!result.success)
    throw new IntegrationError(
      "Resultado fora do contrato. Confira no GCC antes de reenviar.",
    );
  return result.data;
}
