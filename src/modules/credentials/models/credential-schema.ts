import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { user } from "../../auth/models/auth-schema";
export const integrationCredential = pgTable(
  "integration_credentials",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    systemCode: text("system_code").notNull(),
    label: text("label").notNull(),
    encryptedSecret: text("encrypted_secret").notNull(),
    active: boolean("active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("credentials_owner_system_idx").on(table.userId, table.systemCode),
    uniqueIndex("credentials_owner_system_label_idx").on(
      table.userId,
      table.systemCode,
      table.label,
    ),
  ],
);
export const credentialEvent = pgTable(
  "credential_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    credentialId: uuid("credential_id")
      .notNull()
      .references(() => integrationCredential.id),
    action: text("action").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("credential_events_owner_date_idx").on(table.userId, table.createdAt),
  ],
);
export type CredentialSummary = Pick<
  typeof integrationCredential.$inferSelect,
  "id" | "systemCode" | "label" | "active" | "createdAt" | "updatedAt"
>;
