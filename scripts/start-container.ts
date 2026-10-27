import { getRuntimeConfig } from "../src/shared/lib/env";
import { checkDatabase } from "./check-database";

try {
  const config = getRuntimeConfig(process.env);
  await checkDatabase(config.databaseUrl);
  console.info(
    `PostgreSQL disponível. Ambiente: ${config.appEnv}; banco ${config.externalDatabase ? "externo" : "local"}.`,
  );
  const child = Bun.spawn(
    [
      "bun",
      "run",
      config.appEnv === "development" ? "dev" : "start",
      "--hostname",
      "0.0.0.0",
    ],
    {
      stdin: "inherit",
      stdout: "inherit",
      stderr: "inherit",
    },
  );
  process.on("SIGTERM", () => child.kill("SIGTERM"));
  process.on("SIGINT", () => child.kill("SIGINT"));
  process.exit(await child.exited);
} catch (error) {
  console.error(
    error instanceof Error ? error.message : "Falha ao iniciar o container.",
  );
  process.exit(1);
}
