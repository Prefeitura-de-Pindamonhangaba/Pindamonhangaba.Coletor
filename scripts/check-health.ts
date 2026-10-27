import { getRuntimeConfig } from "../src/shared/lib/env";
import { checkDatabase } from "./check-database";

try {
  const config = getRuntimeConfig(process.env);
  const response = await fetch("http://127.0.0.1:3000", {
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) process.exit(1);
  await checkDatabase(config.databaseUrl);
} catch {
  process.exit(1);
}
