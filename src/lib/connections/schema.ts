import { z } from "zod";
import { CONNECTION_STATUSES, CONSENT_STATUSES } from "./types";

// Validacao de borda espelhando o OpenAPI (@ backend 605cb07).

const timestampSchema = z.iso.datetime({ offset: true });

export const consentSchema = z.object({
  id: z.string().nullable(),
  status: z.enum(CONSENT_STATUSES).nullable(),
  products: z.array(z.string()),
  openFinancePermissionsGranted: z.array(z.string()),
  grantedAt: timestampSchema.nullable(),
  expiresAt: timestampSchema.nullable(),
  revokedAt: timestampSchema.nullable(),
});

export const connectionSchema = z.object({
  id: z.string(),
  provider: z.literal("pluggy"),
  status: z.enum(CONNECTION_STATUSES),
  consent: consentSchema,
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

export const pluggySessionSchema = z.object({
  connection: connectionSchema,
  connectToken: z.string().min(1),
  expiresAt: timestampSchema,
});

/** Corpo de POST /connections/pluggy/completions: o id do item criado pelo widget. */
export const completeConnectionInputSchema = z.object({ itemId: z.uuid() }).strict();
