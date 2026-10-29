import type { MovementType } from "../transactions/types";

// Alinhado a POST /ingestions/ofx/previews, POST /ingestions/{id}/confirmations e
// GET /ingestions/{id} do OpenAPI do backend (@ 2c416cd). Schemas inline; transcrito a mao.

export const IMPORT_RUN_STATUSES = [
  "preview_ready",
  "queued",
  "processing",
  "completed",
  "completed_with_errors",
  "failed",
  "expired",
] as const;
export type ImportRunStatus = (typeof IMPORT_RUN_STATUSES)[number];

export const INGESTION_ITEM_STATUSES = [
  "previewed",
  "imported",
  "ignored_duplicate",
  "failed",
] as const;
export type IngestionItemStatus = (typeof INGESTION_ITEM_STATUSES)[number];

export const OFX_VARIANTS = ["ofx_1_sgml", "ofx_2_xml"] as const;
export type OfxVariant = (typeof OFX_VARIANTS)[number];

/**
 * Aviso conhecido: linha sem FITID, deduplicada por data, valor e descricao. O contrato nao
 * fecha a lista de avisos, entao a tela trata este e ignora os desconhecidos.
 */
export const EXTERNAL_ID_MISSING = "external_id_missing";

export interface IngestionItem {
  ordinal: number;
  externalId: string | null;
  type: MovementType;
  /** String decimal com duas casas, > 0. */
  amount: string;
  /** Data civil AAAA-MM-DD. */
  occurredOn: string;
  description: string | null;
  status: IngestionItemStatus;
  /** Calculado para a conta de destino informada junto com o arquivo. */
  isDuplicate: boolean;
  warnings: string[];
  errorCode: string | null;
}

export interface ImportRun {
  id: string;
  status: ImportRunStatus;
  destinationAccountId: string;
  variant: OfxVariant;
  fileSizeBytes: number;
  totalItems: number;
  importedItems: number;
  ignoredItems: number;
  failedItems: number;
  terminalAt: string | null;
  /** Fim da retencao dos metadados (90 dias), nao a validade da previa. */
  retentionExpiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  items: IngestionItem[];
}

export interface ConfirmImportInput {
  destinationAccountId: string;
}
