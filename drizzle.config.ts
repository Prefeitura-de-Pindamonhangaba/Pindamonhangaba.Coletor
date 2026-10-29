import { defineConfig } from "drizzle-kit";
export default defineConfig({
  dialect: "postgresql",
  schema: [
    "./src/modules/auth/models/auth-schema.ts",
    "./src/modules/credentials/models/credential-schema.ts",
  ],
  out: "./drizzle",
  dbCredentials: {
    url:
      process.env.DATABASE_URL ||
      "postgresql://coletor:coletor_dev@localhost:5432/coletor",
  },
});
