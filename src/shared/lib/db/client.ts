import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { z } from "zod";
import * as authSchema from "../../../modules/auth/models/auth-schema";
import * as credentialSchema from "../../../modules/credentials/models/credential-schema";
export function createDatabase(url: string) {
  const client = postgres(url, {
    max: 5,
    connect_timeout: 5,
    idle_timeout: 20,
    onnotice: () => {},
  });
  return {
    client,
    database: drizzle(client, {
      schema: { ...authSchema, ...credentialSchema },
    }),
  };
}
export type Database = ReturnType<typeof createDatabase>["database"];
let instance: ReturnType<typeof createDatabase> | undefined;
export function getDatabase() {
  const url = z.string().min(1).safeParse(process.env.DATABASE_URL);
  if (!url.success) throw new Error("Configure DATABASE_URL no servidor.");
  instance ??= createDatabase(url.data);
  return instance.database;
}
