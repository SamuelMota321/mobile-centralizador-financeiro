import { z } from "zod";
import { apiRequest } from "../api/http-client";
import { pageQuerySchema, type PageQuery } from "../api/pagination";
import { toProblemError } from "../api/problem-error";
import {
  createTransactionInputSchema,
  createTransferInputSchema,
  idempotencyKeySchema,
  transactionCategoryUpdateSchema,
  transactionPageSchema,
  transactionSchema,
  transferSchema,
} from "./schema";
import type {
  CreateTransactionInput,
  CreateTransferInput,
  Transaction,
  TransactionCategoryUpdate,
  TransactionPage,
  Transfer,
} from "./types";

/** Movimentacoes exigem Idempotency-Key: o tipo impede esquecer a chave. */
export interface MovementRequestOptions {
  idempotencyKey: string;
}

const uuidSchema = z.uuid();

/** GET /api/v1/transactions — ordem do servidor: occurredOn desc, id desc. Sem filtros. */
export async function listTransactions(
  query: PageQuery = {},
): Promise<TransactionPage> {
  const { page, pageSize } = pageQuerySchema.parse(query);
  try {
    const raw = await apiRequest<unknown>("/transactions", {
      method: "GET",
      query: { page, pageSize },
    });
    return transactionPageSchema.parse(raw);
  } catch (error) {
    throw toProblemError(error);
  }
}

/** Teto de lançamentos lidos para somar um período: acima disso, a soma não é mostrada. */
export const PERIOD_SCAN_LIMIT = 3000;

/**
 * Lê as páginas (mais recentes primeiro) até passar de `since` ou atingir o teto. A ordem
 * do servidor (occurredOn desc) garante que, ao ver uma data anterior, nada do período
 * ficou para trás. `complete` é false quando o teto cortou: não somar. `total` é o tamanho
 * do histórico inteiro, informado pela API.
 */
export async function listTransactionsSince(
  since: string,
  limit: number = PERIOD_SCAN_LIMIT,
): Promise<{ items: Transaction[]; complete: boolean; total: number }> {
  const items: Transaction[] = [];
  for (let page = 1; ; page += 1) {
    const result = await listTransactions({ page, pageSize: 100 });
    const inRange = result.items.filter((item) => item.occurredOn >= since);
    items.push(...inRange);
    const passedSince = inRange.length < result.items.length;
    const exhausted = page * 100 >= result.total || result.items.length === 0;
    if (passedSince || exhausted) return { items, complete: true, total: result.total };
    if (items.length >= limit) return { items, complete: false, total: result.total };
  }
}

/** POST /api/v1/transactions — receita ou despesa manual. */
export async function createTransaction(
  input: CreateTransactionInput,
  options: MovementRequestOptions,
): Promise<Transaction> {
  const body = createTransactionInputSchema.parse(input);
  const idempotencyKey = idempotencyKeySchema.parse(options.idempotencyKey);
  try {
    const raw = await apiRequest<unknown>("/transactions", {
      method: "POST",
      body,
      idempotencyKey,
    });
    return transactionSchema.parse(raw);
  } catch (error) {
    throw toProblemError(error);
  }
}

/** POST /api/v1/transfers — transferencia contabil entre contas do proprio usuario. */
export async function createTransfer(
  input: CreateTransferInput,
  options: MovementRequestOptions,
): Promise<Transfer> {
  const body = createTransferInputSchema.parse(input);
  const idempotencyKey = idempotencyKeySchema.parse(options.idempotencyKey);
  try {
    const raw = await apiRequest<unknown>("/transfers", {
      method: "POST",
      body,
      idempotencyKey,
    });
    return transferSchema.parse(raw);
  } catch (error) {
    throw toProblemError(error);
  }
}

/** PATCH /api/v1/transactions/{id}/category — categoria manual ou resultado incerto. */
export async function updateTransactionCategory(
  transactionId: string,
  update: TransactionCategoryUpdate,
): Promise<Transaction> {
  const id = uuidSchema.parse(transactionId);
  const body = transactionCategoryUpdateSchema.parse(update);
  try {
    const raw = await apiRequest<unknown>(`/transactions/${id}/category`, {
      method: "PATCH",
      body,
    });
    return transactionSchema.parse(raw);
  } catch (error) {
    throw toProblemError(error);
  }
}
