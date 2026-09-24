import type { z } from "zod";
import { isUnauthorized } from "../lib/accounts/messages";
import { PROBLEM_CODES, ProblemDetailsError } from "../lib/api/errors";
import { parseBrazilianDate } from "../lib/civil-date";
import { mustRotateIdempotencyKey } from "../lib/idempotency";
import { parseMoneyInput } from "../lib/money";
import { isResourceUnavailable, transactionsErrorMessage } from "../lib/transactions/messages";
import {
  createTransactionInputSchema,
  createTransferInputSchema,
} from "../lib/transactions/schema";
import type { CreateTransactionInput, CreateTransferInput } from "../lib/transactions/types";

export type FieldErrors = Record<string, string>;

type Parsed<T> = { ok: true; input: T } | { ok: false; fieldErrors: FieldErrors };

const AMOUNT_MESSAGE = "Informe um valor maior que zero, com ate duas casas decimais.";
const DATE_MESSAGE = "Informe uma data valida no formato DD/MM/AAAA.";

// Mensagens do Zod para tipos/enums sao genericas e em ingles; o backend responde
// `errors[].path` com o nome do campo e mensagem tecnica em ingles.
const FIELD_MESSAGES: Record<string, string> = {
  accountId: "Escolha uma conta.",
  fromAccountId: "Escolha a conta de origem.",
  toAccountId: "Escolha a conta de destino.",
  type: "Escolha receita ou despesa.",
  amount: AMOUNT_MESSAGE,
  occurredOn: DATE_MESSAGE,
  description: "Revise a descricao.",
};

export interface MovementFields {
  accountId: string;
  type: string;
  amount: string;
  /** DD/MM/AAAA, como digitado. */
  date: string;
  description: string;
}

export interface TransferFields {
  fromAccountId: string;
  toAccountId: string;
  amount: string;
  date: string;
  description: string;
}

export function parseMovementFields(fields: MovementFields): Parsed<CreateTransactionInput> {
  const { date, ...rest } = fields;
  return parseWith(createTransactionInputSchema, rest, fields.amount, date);
}

export function parseTransferFields(fields: TransferFields): Parsed<CreateTransferInput> {
  const { date, ...rest } = fields;
  return parseWith(createTransferInputSchema, rest, fields.amount, date);
}

function parseWith<T>(
  schema: z.ZodType<T>,
  rest: Record<string, string>,
  rawAmount: string,
  rawDate: string,
): Parsed<T> {
  const amount = parseMoneyInput(rawAmount);
  const occurredOn = parseBrazilianDate(rawDate);
  const result = schema.safeParse({ ...rest, amount: amount ?? "", occurredOn: occurredOn ?? "" });

  const fieldErrors: FieldErrors = {};
  if (!result.success) {
    for (const issue of result.error.issues) {
      const field = String(issue.path[0] ?? "");
      if (!field || fieldErrors[field]) continue;
      // Refinements (`custom`) ja trazem mensagem propria em pt-BR.
      fieldErrors[field] =
        issue.code === "custom" && field !== "occurredOn"
          ? `${issue.message}.`
          : (FIELD_MESSAGES[field] ?? "Valor invalido.");
    }
  }
  if (amount === null) fieldErrors.amount = AMOUNT_MESSAGE;
  if (occurredOn === null) fieldErrors.occurredOn = DATE_MESSAGE;

  if (result.success && Object.keys(fieldErrors).length === 0) {
    return { ok: true, input: result.data };
  }
  return { ok: false, fieldErrors };
}

/** Como a tela reage a uma falha de envio. `rotateKey` so e true quando o backend recusa a chave. */
export type SubmitFailure =
  | { kind: "unauthorized" }
  | { kind: "fields"; fieldErrors: FieldErrors }
  | { kind: "accountUnavailable"; message: string }
  | { kind: "message"; message: string; rotateKey: boolean };

export function classifySubmitError(error: unknown, fallback: string): SubmitFailure {
  if (isUnauthorized(error)) return { kind: "unauthorized" };

  if (mustRotateIdempotencyKey(error)) {
    return { kind: "message", message: transactionsErrorMessage(error, fallback), rotateKey: true };
  }

  if (isResourceUnavailable(error)) {
    return { kind: "accountUnavailable", message: transactionsErrorMessage(error, fallback) };
  }

  if (error instanceof ProblemDetailsError) {
    if (error.code === PROBLEM_CODES.transferAccountsMustDiffer) {
      return {
        kind: "fields",
        fieldErrors: { toAccountId: transactionsErrorMessage(error, FIELD_MESSAGES.toAccountId) },
      };
    }
    if (error.status === 400) {
      const fieldErrors: FieldErrors = {};
      for (const item of error.problem.errors ?? []) {
        const message = FIELD_MESSAGES[item.path];
        if (message && !fieldErrors[item.path]) fieldErrors[item.path] = message;
      }
      if (Object.keys(fieldErrors).length > 0) return { kind: "fields", fieldErrors };
    }
    // 403 IDENTITY_CONTEXT_UNAVAILABLE, 500 e demais: mensagem segura, mesma chave.
    return {
      kind: "message",
      message: transactionsErrorMessage(error, `${fallback} Tente de novo.`),
      rotateKey: false,
    };
  }

  // Falha de rede ou resposta fora do contrato: reenviar com a mesma chave e seguro.
  return { kind: "message", message: `${fallback} Tente de novo.`, rotateKey: false };
}
