// Contrato publico das execucoes de sincronizacao (HU-008), conferido contra o OpenAPI do
// backend em b5826a3 (24/11/2026): src/lib/api/openapi.snapshot.json.

export const SYNC_RUN_STATUSES = [
  "queued",
  "running",
  "action_required",
  "succeeded",
  "partial",
  "failed",
] as const;
export type SyncRunStatus = (typeof SYNC_RUN_STATUSES)[number];

/** Estados finais: a consulta de andamento para aqui (C-03). */
export const FINAL_SYNC_RUN_STATUSES = ["succeeded", "partial", "failed"] as const satisfies readonly SyncRunStatus[];

export const SYNC_TRIGGERS = ["manual", "daily"] as const;
export type SyncTrigger = (typeof SYNC_TRIGGERS)[number];

export const SYNC_REASON_DATA_TYPES = [
  "accounts",
  "transactions",
  "investments",
  "investment_transactions",
  "connection",
] as const;
export type SyncReasonDataType = (typeof SYNC_REASON_DATA_TYPES)[number];

export const SYNC_REASON_CODES = ["unavailable", "failed", "ambiguous_identity"] as const;
export type SyncReasonCode = (typeof SYNC_REASON_CODES)[number];

/** Motivo de uma execucao incompleta: qual dado e o que aconteceu com ele. */
export interface SyncReason {
  dataType: SyncReasonDataType;
  code: SyncReasonCode;
}

/** Execucao como a API devolve; sem dados financeiros, credenciais ou payload do provedor. */
export interface SyncRun {
  runId: string;
  connectionId: string;
  status: SyncRunStatus;
  trigger: SyncTrigger;
  acceptedAt: string;
  statusUrl: string;
  /** Nulo enquanto a execucao nao comecou ou nao terminou. */
  startedAt: string | null;
  completedAt: string | null;
  /** Data de referencia dos dados; nula quando a execucao nao a produziu. */
  referenceDate: string | null;
  reasons: SyncReason[];
}

/** Ultima execucao e a ultima reconciliada (que chegou a dados confiaveis); ambas anulaveis. */
export interface LatestSyncRuns {
  latest: SyncRun | null;
  lastReconciled: SyncRun | null;
}

/** Sessao curta do Pluggy para renovar a autorizacao de uma conexao existente. */
export interface UpdateSession {
  connectToken: string;
  expiresAt: string;
}
