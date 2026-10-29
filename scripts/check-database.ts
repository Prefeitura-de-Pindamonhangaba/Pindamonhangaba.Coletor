import { SQL } from "bun";

export async function checkDatabase(url: string, requireSchema = false) {
  let database: SQL | undefined;
  try {
    database = new SQL(url, {
      max: 1,
      connectionTimeout: 5,
      idleTimeout: 1,
    });
    await database`SELECT 1`;
    if (requireSchema) {
      const result =
        await database`SELECT to_regclass('public.users') IS NOT NULL AND to_regclass('public.integration_credentials') IS NOT NULL AND to_regclass('public.credential_events') IS NOT NULL AS ready`;
      if (!result[0]?.ready) throw new Error("Migrações pendentes.");
    }
  } catch {
    throw new Error(
      requireSchema
        ? "Banco indisponível ou migrações pendentes. Confira DATABASE_URL e execute bun run db:migrate."
        : "Não foi possível conectar ao PostgreSQL. Verifique DATABASE_URL, credenciais e acesso de rede.",
    );
  } finally {
    await database?.close({ timeout: 0 });
  }
}
