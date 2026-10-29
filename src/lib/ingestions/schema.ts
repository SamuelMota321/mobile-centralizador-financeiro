import { z } from "zod";
import { isRealCivilDate } from "../civil-date";
import { AMOUNT } from "../transactions/schema";
import { MOVEMENT_TYPES } from "../transactions/types";
import { IMPORT_RUN_STATUSES, INGESTION_ITEM_STATUSES, OFX_VARIANTS } from "./types";

// Validacao de borda espelhando o OpenAPI (@ backend 2c416cd). Contagens sao inteiros;
// valores seguem como string decimal, igual a TransactionView.

const countSchema = z.number().int().nonnegative();
const timestampSchema = z.iso.datetime({ offset: true });

export const ingestionItemSchema = z.object({
  ordinal: z.number().int().positive(),
  externalId: z.string().nullable(),
  type: z.enum(MOVEMENT_TYPES),
  amount: z.string().regex(AMOUNT),
  occurredOn: z.string().refine(isRealCivilDate),
  description: z.string().nullable(),
  status: z.enum(INGESTION_ITEM_STATUSES),
  isDuplicate: z.boolean(),
  warnings: z.array(z.string()),
  errorCode: z.string().nullable(),
});

export const importRunSchema = z.object({
  id: z.string(),
  status: z.enum(IMPORT_RUN_STATUSES),
  destinationAccountId: z.string(),
  variant: z.enum(OFX_VARIANTS),
  fileSizeBytes: z.number().int().positive(),
  totalItems: countSchema,
  importedItems: countSchema,
  ignoredItems: countSchema,
  failedItems: countSchema,
  terminalAt: timestampSchema.nullable(),
  retentionExpiresAt: timestampSchema.nullable(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
  items: z.array(ingestionItemSchema),
});

export const confirmImportInputSchema = z
  .object({ destinationAccountId: z.uuid("Escolha a conta de destino") })
  .strict();
