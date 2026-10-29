import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { z } from "zod";
const keySchema = z.string().regex(/^[a-fA-F0-9]{64}$/);
export function getCredentialEncryptionKey(
  env: Record<string, string | undefined> = process.env,
) {
  const key = keySchema.safeParse(env.INTEGRATION_KEYS_ENCRYPTION_KEY);
  if (!key.success)
    throw new Error(
      "Configure INTEGRATION_KEYS_ENCRYPTION_KEY com 64 caracteres hexadecimais.",
    );
  return Buffer.from(key.data, "hex");
}
export type CredentialContext = {
  id: string;
  userId: string;
  systemCode: string;
};
const aad = (context: CredentialContext) =>
  Buffer.from(JSON.stringify([context.id, context.userId, context.systemCode]));
export function encryptCredential(
  secret: string,
  context: CredentialContext,
  key = getCredentialEncryptionKey(),
) {
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  cipher.setAAD(aad(context));
  const encrypted = Buffer.concat([
    cipher.update(secret, "utf8"),
    cipher.final(),
  ]);
  return [
    "v1",
    nonce.toString("base64"),
    cipher.getAuthTag().toString("base64"),
    encrypted.toString("base64"),
  ].join(".");
}
export function decryptCredential(
  value: string,
  context: CredentialContext,
  key = getCredentialEncryptionKey(),
) {
  try {
    const [version, nonce, tag, ciphertext, extra] = value.split(".");
    if (
      version !== "v1" ||
      !nonce ||
      !tag ||
      !ciphertext ||
      extra !== undefined
    )
      throw new Error();
    const cipher = createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(nonce, "base64"),
    );
    cipher.setAAD(aad(context));
    cipher.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([
      cipher.update(Buffer.from(ciphertext, "base64")),
      cipher.final(),
    ]).toString("utf8");
  } catch {
    throw new Error(
      "Não foi possível acessar a chave de integração. Confira a configuração do servidor.",
    );
  }
}
