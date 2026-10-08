import { z } from "zod";
import { isRealCivilDate } from "../civil-date";
import { AMOUNT } from "../transactions/schema";
import { MOVEMENT_TYPES } from "../transactions/types";
import { IMPORT_RUN_STATUSES, INGESTION_ITEM_STATUSES, OFX_WARNINGS } from "./types";

// Validacao de borda do ImportRun (Proposed, ver types.ts). Contagens sao inteiros; valores
// seguem como string decimal, igual a TransactionView.

const countSchema = z.number().int().nonnegative();

export const ingestionItemSchema = z.object({
  ordinal: countSchema,
  externalId: z.string().nullable(),
  type: z.enum(MOVEMENT_TYPES),
  amount: z.string().regex(AMOUNT),
  occurredOn: z.string().refine(isRealCivilDate),
  description: z.string().nullable(),
  status: z.enum(INGESTION_ITEM_STATUSES),
  warnings: z.array(z.enum(OFX_WARNINGS)),
  errorCode: z.string().nullable(),
});

export const importRunSchema = z.object({
  id: z.string(),
  status: z.enum(IMPORT_RUN_STATUSES),
  destinationAccountId: z.string().nullable(),
  totalItems: countSchema,
  importedItems: countSchema,
  ignoredItems: countSchema,
  failedItems: countSchema,
  items: z.array(ingestionItemSchema),
});

export const confirmImportInputSchema = z
  .object({ destinationAccountId: z.uuid("Escolha a conta de destino") })
  .strict();
