import { and, eq, sql } from "drizzle-orm";
import type { Database } from "../../../shared/lib/db/client";
import { user, account, session } from "./auth-schema";
import type { KeycloakIdentity } from "./keycloak-identity";
export function createKeycloakIdentityRepository(database: Database) {
  return {
    async synchronize(identity: KeycloakIdentity) {
      return database.transaction(async (tx) => {
        await tx.execute(
          sql`select pg_advisory_xact_lock(hashtextextended(${identity.accountId}, 19))`,
        );
        const [existing] = await tx
          .select({
            id: user.id,
            name: user.name,
            email: user.email,
            emailVerified: user.emailVerified,
          })
          .from(account)
          .innerJoin(user, eq(account.userId, user.id))
          .where(
            and(
              eq(account.providerId, "keycloak"),
              eq(account.accountId, identity.accountId),
            ),
          );
        if (!existing) {
          const [created] = await tx
            .insert(user)
            .values({
              name: identity.name,
              email: identity.technicalEmail,
              role: identity.role,
              enabled: true,
            })
            .returning();
          if (!created)
            throw new Error("Falha ao criar identidade institucional.");
          await tx.insert(account).values({
            providerId: "keycloak",
            accountId: identity.accountId,
            userId: created.id,
          });
          return created;
        }
        await tx
          .update(user)
          .set({
            name: identity.name,
            role: identity.role,
            enabled: true,
            updatedAt: new Date(),
          })
          .where(eq(user.id, existing.id));
        return {
          ...existing,
          name: identity.name,
          role: identity.role,
          enabled: true,
        };
      });
    },
    async principal(userId: string) {
      const [result] = await database
        .select({
          id: user.id,
          accountId: account.id,
          identityKey: account.accountId,
        })
        .from(user)
        .innerJoin(account, eq(account.userId, user.id))
        .where(and(eq(user.id, userId), eq(account.providerId, "keycloak")));
      return result ?? null;
    },
    async revoke(userId: string) {
      await database.delete(session).where(eq(session.userId, userId));
    },
  };
}
