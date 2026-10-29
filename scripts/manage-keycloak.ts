import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { createDatabase } from "../src/shared/lib/db/client";
import { user, account, session } from "../src/modules/auth/models/auth-schema";
import {
  parseAuthEnvironment,
  keycloakAccountId,
} from "../src/modules/auth/services/keycloak-config";
const inputSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    email: z.email().transform((value) => value.toLowerCase()),
    subject: z.string().min(1).max(255),
    enabled: z.boolean().default(true),
  })
  .strict();
let close: (() => Promise<void>) | undefined;
try {
  const env = parseAuthEnvironment(process.env);
  if (!env.keycloak.enabled || !process.env.DATABASE_URL) throw new Error();
  const input = inputSchema.parse(JSON.parse(await Bun.stdin.text()));
  const identity = keycloakAccountId(env.keycloak.issuer, input.subject);
  const { database, client } = createDatabase(process.env.DATABASE_URL);
  close = () => client.end();
  await database.transaction(async (tx) => {
    const [bound] = await tx
      .select({ userId: account.userId })
      .from(account)
      .where(
        and(
          eq(account.providerId, "keycloak"),
          eq(account.accountId, identity),
        ),
      )
      .limit(1);
    if (bound) {
      await tx
        .update(user)
        .set({
          name: input.name,
          email: input.email,
          enabled: input.enabled,
          updatedAt: new Date(),
        })
        .where(eq(user.id, bound.userId));
      await tx.delete(session).where(eq(session.userId, bound.userId));
    } else {
      const id = randomUUID();
      await tx.insert(user).values({
        id,
        name: input.name,
        email: input.email,
        emailVerified: true,
        enabled: input.enabled,
      });
      await tx
        .insert(account)
        .values({ userId: id, providerId: "keycloak", accountId: identity });
    }
  });
  console.info(
    "Usuário institucional vinculado/atualizado. Sessões anteriores revogadas.",
  );
} catch {
  console.error(
    "Não foi possível vincular o usuário. Confira configuração, subject, e-mail único e migrações. Não é permitido vincular duas identidades ao mesmo e-mail automaticamente.",
  );
  process.exitCode = 1;
} finally {
  await close?.();
}
