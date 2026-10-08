import type { MovementType } from "../transactions/types";

// Estados aprovados no contrato S3-01 do Dev 1 (docs @ f851384). As rotas ainda nao estao no
// OpenAPI; os nomes dos campos sao Proposed, tirados do dominio do backend @ 9887206.

export const IMPORT_RUN_STATUSES = [
  "preview_ready",
  "awaiting_account_mapping",
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

/** Linha sem FITID: a deduplicacao usa data, valor e descricao, e a previa avisa. */
export const OFX_WARNINGS = ["external_id_missing"] as const;
export type OfxWarning = (typeof OFX_WARNINGS)[number];

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
  warnings: OfxWarning[];
  errorCode: string | null;
}

export interface ImportRun {
  id: string;
  status: ImportRunStatus;
  /** Nula ate a confirmacao: a conta de destino e escolhida ao confirmar. */
  destinationAccountId: string | null;
  totalItems: number;
  importedItems: number;
  ignoredItems: number;
  failedItems: number;
  items: IngestionItem[];
}

export interface ConfirmImportInput {
  destinationAccountId: string;
}
