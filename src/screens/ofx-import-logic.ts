import { isUnauthorized } from "../lib/accounts/messages";
import { PROBLEM_CODES, ProblemDetailsError } from "../lib/api/errors";
import { mustRotateIdempotencyKey, newIdempotencyKey } from "../lib/idempotency";
import { ingestionErrorMessage } from "../lib/ingestions/messages";
import {
  EXTERNAL_ID_MISSING,
  type ImportRun,
  type ImportRunStatus,
  type IngestionItem,
} from "../lib/ingestions/types";
import type { ChipTone, NoticeTone } from "../ui/controls";
import { signedAmount } from "./movement-presentation";

export type ImportStep = "preview" | "processing" | "expired" | "result";

/** Passo que a tela mostra para o estado do ImportRun. */
export function stepForStatus(status: ImportRunStatus): ImportStep {
  switch (status) {
    case "preview_ready":
      return "preview";
    case "queued":
    case "processing":
      return "processing";
    case "expired":
      return "expired";
    case "completed":
    case "completed_with_errors":
    case "failed":
      return "result";
  }
}

export interface PreviewSummary {
  total: number;
  fresh: number;
  duplicates: number;
  withoutBankId: number;
  /** Menor e maior data das linhas; null quando o arquivo nao tem linhas. */
  period: { from: string; to: string } | null;
}

export function previewSummary(
  items: Pick<IngestionItem, "isDuplicate" | "warnings" | "occurredOn">[],
): PreviewSummary {
  const duplicates = items.filter((item) => item.isDuplicate).length;
  // Datas civis AAAA-MM-DD ordenam como texto.
  const dates = items.map((item) => item.occurredOn).sort();
  return {
    total: items.length,
    fresh: items.length - duplicates,
    duplicates,
    withoutBankId: items.filter((item) => item.warnings.includes(EXTERNAL_ID_MISSING)).length,
    period: dates.length > 0 ? { from: dates[0], to: dates[dates.length - 1] } : null,
  };
}

/** Situacao da linha em texto; a cor do chip e so reforco. */
export function itemSituation(item: Pick<IngestionItem, "status" | "isDuplicate">): {
  label: string;
  tone: ChipTone;
} {
  switch (item.status) {
    case "previewed":
      return item.isDuplicate
        ? { label: "Já registrada — será ignorada", tone: "neutral" }
        : { label: "Nova", tone: "info" };
    case "imported":
      return { label: "Importada", tone: "positive" };
    case "ignored_duplicate":
      return { label: "Já registrada — ignorada", tone: "neutral" };
    case "failed":
      return { label: "Não importada", tone: "warning" };
  }
}

/** Os codigos de erro por linha nao tem lista publicada: a tela nunca mostra o codigo bruto. */
export const FAILED_ITEM_MESSAGE = "Não foi possível importar esta linha. As demais não foram afetadas.";

export function itemAmount(item: Pick<IngestionItem, "type" | "amount">) {
  return signedAmount({ type: item.type, amount: item.amount, transferSide: null });
}

export function countLabel(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function resultSummary(
  run: Pick<ImportRun, "status" | "importedItems" | "ignoredItems" | "failedItems">,
): { tone: NoticeTone; text: string } {
  const parts = [countLabel(run.importedItems, "movimentação importada", "movimentações importadas")];
  if (run.ignoredItems > 0) {
    parts.push(
      countLabel(run.ignoredItems, "ignorada por já estar registrada", "ignoradas por já estarem registradas"),
    );
  }
  if (run.failedItems > 0) parts.push(countLabel(run.failedItems, "com erro", "com erro"));
  const counts = `${parts.join(", ")}.`;

  if (run.status === "failed") return { tone: "error", text: `A importação não foi concluída: ${counts}` };
  return { tone: run.failedItems > 0 ? "warning" : "success", text: counts };
}

/**
 * Como a tela reage a uma falha. `rotateKey` so e true quando o backend recusa a chave;
 * `restart` quando a previa expirou, ja foi confirmada ou nao existe (so um arquivo novo resolve).
 */
export type ImportFailure =
  | { kind: "unauthorized" }
  | { kind: "message"; message: string; rotateKey: boolean; restart: boolean };

export function classifyImportError(error: unknown, fallback: string): ImportFailure {
  if (isUnauthorized(error)) return { kind: "unauthorized" };
  const restart =
    error instanceof ProblemDetailsError &&
    error.code === PROBLEM_CODES.invalidRequest &&
    (error.status === 404 || error.status === 409);
  return {
    kind: "message",
    message: ingestionErrorMessage(error, `${fallback} Tente de novo.`),
    rotateKey: mustRotateIdempotencyKey(error),
    restart,
  };
}

/**
 * Chave da confirmacao depois de uma falha: a mesma, para o reenvio devolver a mesma importacao
 * sem duplicar transacoes, salvo quando o backend recusou a chave.
 */
export function confirmKeyAfterFailure(currentKey: string, failure: ImportFailure): string {
  return failure.kind === "message" && failure.rotateKey ? newIdempotencyKey() : currentKey;
}
