import { z } from "zod";
import { ACCOUNT_TYPES } from "./types";

// PROVISORIO — espelha as regras de borda do backend
// (src/modules/accounts/adapters/inbound/account-input.schema.ts @ backend b154f14)
// e o Modelo de Dados Identity e Accounts 1.0.
//
// Nao e um pacote compartilhado: cada cliente mantem a propria copia. A normalizacao
// completa de nome e instituicao e as invariantes monetarias sao reaplicadas pelo
// backend; aqui fica apenas a validacao de borda para feedback imediato ao usuario.

const DECIMAL_TWO_PLACES = /^-?\d+(\.\d{1,2})?$/;
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
      .regex(DECIMAL_TWO_PLACES, "Informe um valor decimal com ate duas casas"),
    initialBalanceAsOf: z
      .string()
      .regex(ISO_DATE, "Informe uma data no formato AAAA-MM-DD")
      .refine((value) => !Number.isNaN(Date.parse(value)), "Data invalida")
      .refine(
        (value) => new Date(`${value}T00:00:00Z`).getTime() <= Date.now(),
        "A data de referencia nao pode ser futura",
      ),
  })
  .strict();

export type ManualAccountInputParsed = z.infer<typeof manualAccountInputSchema>;
