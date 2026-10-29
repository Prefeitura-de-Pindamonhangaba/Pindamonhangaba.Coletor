import { z } from "zod";
export const createCredentialSchema = z
  .object({
    systemCode: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z][a-z0-9_-]{1,49}$/),
    label: z.string().trim().min(1).max(100),
    secret: z.string().trim().min(1).max(16384),
  })
  .strict();
export const updateCredentialSchema = z
  .object({
    label: z.string().trim().min(1).max(100).optional(),
    secret: z.string().trim().min(1).max(16384).optional(),
    active: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0);
export const credentialIdSchema = z.uuid();
