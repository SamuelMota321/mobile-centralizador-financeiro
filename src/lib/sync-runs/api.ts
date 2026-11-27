import { z } from "zod";
import { apiRequest } from "../api/http-client";
import { toProblemError } from "../api/problem-error";
import { syncRunSchema } from "./schema";
import type { SyncRun } from "./types";

const uuidSchema = z.uuid();

/**
 * POST /api/v1/connections/{connectionId}/sync-runs — 202 quando aceita para processamento. O
 * contrato não define Idempotency-Key: existe no máximo uma execução por conexão, e quem já tem
 * uma em andamento recebe 409 (a tela trata como "em andamento", não como falha). Só o pedido
 * existe no mobile; acompanhar o andamento fica para uma etapa futura.
 */
export async function requestSyncRun(connectionId: string): Promise<SyncRun> {
  const id = uuidSchema.parse(connectionId);
  try {
    const raw = await apiRequest<unknown>(`/connections/${id}/sync-runs`, { method: "POST" });
    return syncRunSchema.parse(raw);
  } catch (error) {
    throw toProblemError(error);
  }
}
