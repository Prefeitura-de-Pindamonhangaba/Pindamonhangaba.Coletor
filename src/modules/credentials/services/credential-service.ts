import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { CredentialRepository } from "../models/credential-repository";
import {
  encryptCredential,
  decryptCredential,
} from "../../../shared/lib/security/credential-cipher";
import {
  createCredentialSchema,
  updateCredentialSchema,
} from "../schemas/credential-input";
export class CredentialError extends Error {}
export function createCredentialService(repository: CredentialRepository) {
  return {
    list: (ownerId: string) => repository.list(ownerId),
    async create(
      ownerId: string,
      input: z.infer<typeof createCredentialSchema>,
    ) {
      const id = randomUUID();
      return repository.create({
        id,
        userId: ownerId,
        systemCode: input.systemCode,
        label: input.label,
        encryptedSecret: encryptCredential(input.secret, {
          id,
          userId: ownerId,
          systemCode: input.systemCode,
        }),
      });
    },
    async update(
      ownerId: string,
      id: string,
      input: z.infer<typeof updateCredentialSchema>,
    ) {
      const owned = await repository.findOwned(ownerId, id);
      if (!owned || owned.userId !== ownerId)
        throw new CredentialError("Chave não encontrada.");
      const encryptedSecret = input.secret
        ? encryptCredential(input.secret, owned)
        : undefined;
      const result = await repository.update(ownerId, id, {
        ...(input.label !== undefined ? { label: input.label } : {}),
        ...(input.active !== undefined ? { active: input.active } : {}),
        ...(encryptedSecret ? { encryptedSecret } : {}),
      });
      if (!result) throw new CredentialError("Chave não encontrada.");
      return result;
    },
    async getGccSecret(ownerId: string, id: string) {
      const owned = await repository.findOwned(ownerId, id);
      if (
        !owned ||
        owned.userId !== ownerId ||
        !owned.active ||
        owned.systemCode !== "gcc"
      )
        throw new CredentialError(
          "Selecione uma chave GCC ativa cadastrada na sua conta.",
        );
      const secret = decryptCredential(owned.encryptedSecret, owned);
      await repository.recordUse(ownerId, id);
      return secret;
    },
  };
}
