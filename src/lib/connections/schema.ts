import { z } from "zod";
import { CONNECTION_STATUSES, CONSENT_STATUSES } from "./types";

// Validação de borda espelhando o OpenAPI atual do backend.

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

const countSchema = z.number().int().nonnegative();
const availabilitySchema = z.object({
  status: z.enum(["pending", "available", "unavailable", "failed"]),
  errorCode: z.string().nullable(),
});

export const initialImportSchema = z.object({
  id: z.uuid(),
  status: z.enum(["queued", "processing", "awaiting_account_mapping", "completed", "completed_with_errors", "failed"]),
  availability: z.object({ accounts: availabilitySchema, transactions: availabilitySchema }),
  accountMapping: z.object({
    total: countSchema,
    mapped: countSchema,
    accounts: z.array(z.object({
      providerAccountId: z.uuid(),
      name: z.string(),
      accountType: z.enum(["checking", "savings", "credit_card"]).nullable(),
      currencyCode: z.string().length(3),
      mappingStatus: z.enum(["pending", "mapped", "unsupported"]),
      errorCode: z.string().nullable(),
      mappedAccountId: z.uuid().nullable(),
    })),
  }),
  transactions: z.object({ total: countSchema, imported: countSchema, ignored: countSchema, failed: countSchema }),
  terminalAt: timestampSchema.nullable(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

export type InitialImport = z.infer<typeof initialImportSchema>;
export const completionAcceptedSchema = z.object({ connection: connectionSchema, initialImport: initialImportSchema });
export const connectionDetailSchema = connectionSchema.extend({ initialImport: initialImportSchema.nullable() });
