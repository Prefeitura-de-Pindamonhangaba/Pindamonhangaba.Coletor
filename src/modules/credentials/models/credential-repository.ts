import { and, eq, desc } from "drizzle-orm";
import { integrationCredential, credentialEvent } from "./credential-schema";
import type { Database } from "../../../shared/lib/db/client";
const summary = {
  id: integrationCredential.id,
  systemCode: integrationCredential.systemCode,
  label: integrationCredential.label,
  active: integrationCredential.active,
  createdAt: integrationCredential.createdAt,
  updatedAt: integrationCredential.updatedAt,
};
export function createCredentialRepository(database: Database) {
  return {
    list: (userId: string) =>
      database
        .select(summary)
        .from(integrationCredential)
        .where(eq(integrationCredential.userId, userId))
        .orderBy(desc(integrationCredential.createdAt)),
    async create(record: typeof integrationCredential.$inferInsert) {
      return database.transaction(async (tx) => {
        const [result] = await tx
          .insert(integrationCredential)
          .values(record)
          .returning(summary);
        await tx.insert(credentialEvent).values({
          userId: record.userId,
          credentialId: result!.id,
          action: "created",
        });
        return result!;
      });
    },
    async update(
      userId: string,
      id: string,
      changes: { label?: string; encryptedSecret?: string; active?: boolean },
    ) {
      return database.transaction(async (tx) => {
        const [result] = await tx
          .update(integrationCredential)
          .set({ ...changes, updatedAt: new Date() })
          .where(
            and(
              eq(integrationCredential.userId, userId),
              eq(integrationCredential.id, id),
            ),
          )
          .returning(summary);
        if (result)
          await tx.insert(credentialEvent).values({
            userId,
            credentialId: id,
            action: changes.encryptedSecret ? "secret_replaced" : "updated",
          });
        return result;
      });
    },
    async findOwned(userId: string, id: string) {
      const [result] = await database
        .select()
        .from(integrationCredential)
        .where(
          and(
            eq(integrationCredential.userId, userId),
            eq(integrationCredential.id, id),
          ),
        )
        .limit(1);
      return result;
    },
    async recordUse(userId: string, id: string) {
      await database
        .insert(credentialEvent)
        .values({ userId, credentialId: id, action: "used" });
    },
  };
}
export type CredentialRepository = ReturnType<
  typeof createCredentialRepository
>;
