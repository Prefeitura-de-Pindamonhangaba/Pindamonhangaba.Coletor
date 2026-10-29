import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { createDatabase } from "../src/shared/lib/db/client";
import { user } from "../src/modules/auth/models/auth-schema";
import {
  integrationCredential,
  credentialEvent,
} from "../src/modules/credentials/models/credential-schema";
import { createCredentialRepository } from "../src/modules/credentials/models/credential-repository";
import { createCredentialService } from "../src/modules/credentials/services/credential-service";

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  "Isolamento de credenciais com PostgreSQL de teste",
  () => {
    const ownerA = randomUUID(),
      ownerB = randomUUID();
    const previousKey = process.env.INTEGRATION_KEYS_ENCRYPTION_KEY;
    let connection: ReturnType<typeof createDatabase>;
    let service: ReturnType<typeof createCredentialService>;
    beforeAll(async () => {
      // Somente conexão explicitamente fornecida para teste, nunca DATABASE_URL.
      connection = createDatabase(process.env.TEST_DATABASE_URL!);
      await migrate(connection.database, { migrationsFolder: "drizzle" });
      process.env.INTEGRATION_KEYS_ENCRYPTION_KEY = "ab".repeat(32);
      await connection.database.insert(user).values([
        { id: ownerA, name: "Usuário A", email: `${ownerA}@test.invalid` },
        { id: ownerB, name: "Usuário B", email: `${ownerB}@test.invalid` },
      ]);
      service = createCredentialService(
        createCredentialRepository(connection.database),
      );
    });
    afterAll(async () => {
      if (previousKey === undefined)
        delete process.env.INTEGRATION_KEYS_ENCRYPTION_KEY;
      else process.env.INTEGRATION_KEYS_ENCRYPTION_KEY = previousKey;
      await connection?.client.end();
    });
    test("permite várias chaves pessoais, criptografa e não retorna o segredo", async () => {
      const first = await service.create(ownerA, {
        systemCode: "gcc",
        label: "Entidade 1",
        secret: "segredo-a",
      });
      await service.create(ownerA, {
        systemCode: "gcc",
        label: "Entidade 2",
        secret: "segredo-b",
      });
      await service.create(ownerA, {
        systemCode: "outro-sistema",
        label: "Outra API",
        secret: "segredo-c",
      });
      await service.create(ownerB, {
        systemCode: "gcc",
        label: "Entidade 1",
        secret: "segredo-outro",
      });
      const listed = await service.list(ownerA);
      expect(listed).toHaveLength(3);
      expect(JSON.stringify(listed)).not.toContain("segredo");
      expect("encryptedSecret" in first).toBe(false);
      const [stored] = await connection.database
        .select()
        .from(integrationCredential)
        .where(eq(integrationCredential.id, first.id));
      expect(stored?.encryptedSecret).not.toContain("segredo-a");
      expect(await service.getGccSecret(ownerA, first.id)).toBe("segredo-a");
      await expect(service.getGccSecret(ownerB, first.id)).rejects.toThrow(
        "Selecione",
      );
      await expect(
        service.update(ownerB, first.id, { secret: "invasao" }),
      ).rejects.toThrow("não encontrada");
      expect(await service.getGccSecret(ownerA, first.id)).toBe("segredo-a");
      await service.update(ownerA, first.id, { secret: "segredo-novo" });
      expect(await service.getGccSecret(ownerA, first.id)).toBe("segredo-novo");
      await service.update(ownerA, first.id, { active: false });
      await expect(service.getGccSecret(ownerA, first.id)).rejects.toThrow(
        "ativa",
      );
      await service.update(ownerA, first.id, { active: true });
      expect(await service.getGccSecret(ownerA, first.id)).toBe("segredo-novo");
      const other = listed.find((item) => item.systemCode !== "gcc")!;
      await expect(service.getGccSecret(ownerA, other.id)).rejects.toThrow(
        "GCC",
      );
      const events = await connection.database
        .select()
        .from(credentialEvent)
        .where(eq(credentialEvent.userId, ownerA));
      expect(events.some((event) => event.action === "secret_replaced")).toBe(
        true,
      );
      expect(JSON.stringify(events)).not.toContain("segredo");
    });
  },
);
