import { z } from "zod";
import { apiRequest } from "../api/http-client";
import { type PageQuery, pageQuerySchema } from "../api/pagination";
import { toProblemError } from "../api/problem-error";
import { movementPageSchema, positionPageSchema } from "./schema";
import type { MovementPage, PositionPage } from "./types";

const uuidSchema = z.uuid();

/**
 * GET /api/v1/investments — carteira, alocação (calculada antes da paginação) e posições
 * paginadas. Só leitura; sem Idempotency-Key.
 */
export async function listInvestments(query: PageQuery = {}): Promise<PositionPage> {
  const { page, pageSize } = pageQuerySchema.parse(query);
  try {
    const raw = await apiRequest<unknown>(`/investments?page=${page}&pageSize=${pageSize}`, { method: "GET" });
    return positionPageSchema.parse(raw);
  } catch (error) {
    throw toProblemError(error);
  }
}

/** GET /api/v1/investments/{id}/movements — 404 para posição inexistente ou de outro usuário. */
export async function listInvestmentMovements(positionId: string, query: PageQuery = {}): Promise<MovementPage> {
  const id = uuidSchema.parse(positionId);
  const { page, pageSize } = pageQuerySchema.parse(query);
  try {
    const raw = await apiRequest<unknown>(`/investments/${id}/movements?page=${page}&pageSize=${pageSize}`, { method: "GET" });
    return movementPageSchema.parse(raw);
  } catch (error) {
    throw toProblemError(error);
  }
}
