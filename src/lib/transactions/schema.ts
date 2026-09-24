import { z } from "zod";
import { isRealCivilDate } from "../civil-date";
import {
  CATEGORIZATION_STATUSES,
  MOVEMENT_TYPES,
  UNCERTAIN_STATUSES,
} from "./types";

// Validacao de borda espelhando o OpenAPI (@ backend fa9b62a). O backend reaplica
// as regras de dominio (data real, valor dentro de numeric(19,2), conta ativa).

/** Valor positivo com exatamente duas casas, igual ao pattern do contrato. */
const AMOUNT = /^(?:0\.(?:0[1-9]|[1-9]\d)|[1-9]\d*\.\d{2})$/;

const amountSchema = z.string().regex(AMOUNT, "Informe um valor maior que zero");

const occurredOnSchema = z
  .string()
  .refine(isRealCivilDate, "Informe uma data valida");

/** Mesma normalizacao do backend: espacos colapsados; texto vazio vira null. */
const descriptionSchema = z
  .string()
  .nullish()
  .transform((value) => {
    const normalized = value?.replace(/\s+/g, " ").trim() ?? "";
    return normalized === "" ? null : normalized;
  });

export const idempotencyKeySchema = z.uuid();

export const createTransactionInputSchema = z
  .object({
    accountId: z.uuid("Escolha uma conta"),
    type: z.enum(MOVEMENT_TYPES),
    amount: amountSchema,
    occurredOn: occurredOnSchema,
    description: descriptionSchema,
  })
  .strict();

export const createTransferInputSchema = z
  .object({
    fromAccountId: z.uuid("Escolha a conta de origem"),
    toAccountId: z.uuid("Escolha a conta de destino"),
    amount: amountSchema,
    occurredOn: occurredOnSchema,
    description: descriptionSchema,
  })
  .strict()
  .refine(
    (value) => value.fromAccountId.toLowerCase() !== value.toAccountId.toLowerCase(),
    { path: ["toAccountId"], message: "Escolha contas de origem e destino diferentes" },
  );

export const transactionCategoryUpdateSchema = z.union([
  z.object({ categoryId: z.uuid() }).strict(),
  z.object({ categorizationStatus: z.enum(UNCERTAIN_STATUSES) }).strict(),
]);

export const transactionSchema = z.object({
  id: z.string(),
  accountId: z.string(),
  type: z.enum(["income", "expense", "transfer"]),
  amount: z.string().regex(AMOUNT),
  occurredOn: z.string(),
  description: z.string().nullable(),
  status: z.enum(["posted", "voided"]),
  transferId: z.string().nullable(),
  transferSide: z.enum(["outgoing", "incoming"]).nullable(),
  categoryId: z.string().nullable(),
  categorizationStatus: z.enum(CATEGORIZATION_STATUSES),
  categorizationSource: z.enum(["manual", "rule"]).nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const transactionPageSchema = z.object({
  items: z.array(transactionSchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
});

export const transferSchema = z.object({
  entries: z.tuple([transactionSchema, transactionSchema]),
});
