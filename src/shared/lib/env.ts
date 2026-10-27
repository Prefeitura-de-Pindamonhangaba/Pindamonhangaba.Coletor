import { z } from "zod";

const databaseUrl = z
  .string()
  .trim()
  .min(1)
  .superRefine((value, context) => {
    try {
      const url = new URL(value);
      if (
        !["postgres:", "postgresql:"].includes(url.protocol) ||
        !url.hostname ||
        !url.pathname.slice(1)
      ) {
        context.addIssue({
          code: "custom",
          message: "Informe uma URL PostgreSQL com servidor e nome do banco.",
        });
      }
    } catch {
      context.addIssue({
        code: "custom",
        message: "Informe uma URL PostgreSQL válida.",
      });
    }
  });

const runtimeSchema = z
  .object({
    APP_ENV: z.enum(["development", "production"]).default("development"),
    DATABASE_EXTERNAL: z.enum(["true", "false"]).default("false"),
    DATABASE_URL: databaseUrl,
  })
  .superRefine((value, context) => {
    if (value.APP_ENV === "production" && value.DATABASE_EXTERNAL !== "true") {
      context.addIssue({
        code: "custom",
        path: ["DATABASE_EXTERNAL"],
        message: "Produção exige DATABASE_EXTERNAL=true e um banco separado.",
      });
    }
  });

export function getRuntimeConfig(
  environment: Record<string, string | undefined>,
) {
  const result = runtimeSchema.safeParse(environment);
  if (!result.success) {
    // Não incluir valores recebidos: DATABASE_URL pode conter credenciais.
    throw new Error(
      `Configuração inválida: ${result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join(" ")}`,
    );
  }
  return {
    appEnv: result.data.APP_ENV,
    externalDatabase: result.data.DATABASE_EXTERNAL === "true",
    databaseUrl: result.data.DATABASE_URL,
  };
}
