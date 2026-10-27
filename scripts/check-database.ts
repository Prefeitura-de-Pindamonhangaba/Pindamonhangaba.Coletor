import { SQL } from "bun";

export async function checkDatabase(url: string) {
  let database: SQL | undefined;
  try {
    database = new SQL(url, {
      max: 1,
      connectionTimeout: 5,
      idleTimeout: 1,
    });
    await database`SELECT 1`;
  } catch {
    throw new Error(
      "Não foi possível conectar ao PostgreSQL. Verifique DATABASE_URL, credenciais e acesso de rede.",
    );
  } finally {
    await database?.close({ timeout: 0 });
  }
}
