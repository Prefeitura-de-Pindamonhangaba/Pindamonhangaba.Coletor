import { migrate } from "drizzle-orm/postgres-js/migrator";
import { createDatabase } from "../src/shared/lib/db/client";
export async function migrateDatabase() {
  if (!process.env.DATABASE_URL)
    throw new Error("Configure DATABASE_URL antes de executar as migrações.");
  const { database, client } = createDatabase(process.env.DATABASE_URL);
  try {
    await migrate(database, { migrationsFolder: "drizzle" });
  } finally {
    await client.end();
  }
}
if (import.meta.main) {
  try {
    await migrateDatabase();
    console.info("Migrações aplicadas.");
  } catch {
    console.error(
      "Não foi possível aplicar as migrações. Confira DATABASE_URL, permissões e backup do banco.",
    );
    process.exit(1);
  }
}
