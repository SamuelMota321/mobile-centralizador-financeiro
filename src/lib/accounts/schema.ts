import { z } from "zod";
import { ACCOUNT_TYPES } from "./types";

// Validacao de borda espelhando o contrato OpenAPI do backend (@ backend 17ca76d)
// e o schema inbound `account-input.schema.ts`. Nao substitui a validacao do backend,
// que reaplica a normalizacao completa de nome/instituicao e as invariantes monetarias.

/** Aceito na ENTRADA (POST body): ate duas casas, sem zeros a esquerda. */
const INITIAL_BALANCE_INPUT = /^-?(?:0|[1-9]\d*)(?:\.\d{1,2})?$/;
/** Emitido na SAIDA pelo backend: sempre duas casas. */
const INITIAL_BALANCE_OUTPUT = /^-?(?:0|[1-9]\d*)\.\d{2}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const manualAccountInputSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    type: z.enum(ACCOUNT_TYPES),
    institutionName: z
      .string()
      .trim()
      .max(120)
      .nullish()
      .transform((value) => (value ? value : null)),
    initialBalance: z
      .string()
      .trim()
      .regex(INITIAL_BALANCE_INPUT, "Informe um valor decimal com ate duas casas"),
    initialBalanceAsOf: z
      .string()
      .regex(ISO_DATE, "Informe uma data no formato AAAA-MM-DD")
      .refine((value) => !Number.isNaN(Date.parse(value)), "Data invalida")
      .refine(
        (value) => new Date(`${value}T00:00:00Z`).getTime() <= Date.now(),
        "A data de referencia nao pode ser futura",
      ),
    confirmPossibleDuplicate: z.boolean().optional(),
  })
  .strict();

export const accountListQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

export const accountSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(ACCOUNT_TYPES),
  origin: z.enum(["manual", "connected"]),
  institutionName: z.string().nullable(),
  initialBalance: z.string().regex(INITIAL_BALANCE_OUTPUT),
  initialBalanceAsOf: z.string(),
  currencyCode: z.literal("BRL"),
  archivedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const accountPageSchema = z.object({
  items: z.array(accountSchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
});

export const duplicateCandidateSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(ACCOUNT_TYPES),
  origin: z.literal("connected"),
  institutionName: z.string().nullable(),
});

export const duplicateCandidatesSchema = z.array(duplicateCandidateSchema);
