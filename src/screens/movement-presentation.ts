import { formatMoney } from "../lib/money";
import type { CategoryStatus } from "../lib/categories/types";
import type { Transaction } from "../lib/transactions/types";

export const PAGE_SIZE = 20;

/** Conta ausente da lista de ativas (arquivada) ou lista indisponivel: nunca exibir o UUID. */
export const ACCOUNT_FALLBACK_LABEL = "Conta indisponível";

export interface AccountOption {
  id: string;
  name: string;
}

/** Categoria resolvida para exibicao; arquivadas continuam legiveis no historico. */
export interface CategoryOption {
  id: string;
  name: string;
  status: CategoryStatus;
}

/** Categoria referenciada mas ausente da lista (ou lista indisponivel): nunca exibir o UUID. */
export const CATEGORY_FALLBACK_LABEL = "Categoria indisponível";

export function accountLabel(accountId: string, accounts: AccountOption[] | null): string {
  const target = accountId.toLowerCase();
  return (
    accounts?.find((account) => account.id.toLowerCase() === target)?.name ??
    ACCOUNT_FALLBACK_LABEL
  );
}

/** Transferencia e registro contabil entre contas proprias: o rotulo nunca sugere envio de dinheiro. */
export function typeLabel(transaction: Pick<Transaction, "type" | "transferSide">): string {
  if (transaction.type === "income") return "Receita";
  if (transaction.type === "expense") return "Despesa";
  return transaction.transferSide === "incoming"
    ? "Transferência entre contas — entrada"
    : "Transferência entre contas — saída";
}

/**
 * O sinal comunica a direcao em texto; a cor e apenas reforco. Formato do style guide:
 * "+ R$ 6.800,00" e "− R$ 184,90" (sinal de menos tipografico, U+2212).
 */
export function signedAmount(
  transaction: Pick<Transaction, "type" | "transferSide" | "amount">,
): { text: string; direction: "in" | "out" } {
  const inflow = transaction.type === "income" || transaction.transferSide === "incoming";
  return inflow
    ? { text: `+ ${formatMoney(transaction.amount)}`, direction: "in" }
    : { text: `\u2212 ${formatMoney(transaction.amount)}`, direction: "out" };
}

/** Somente receitas e despesas lancadas aceitam categoria; transferencias usam not_applicable. */
export function canCategorize(transaction: Pick<Transaction, "type" | "status">): boolean {
  return transaction.type !== "transfer" && transaction.status === "posted";
}

function categoryName(categoryId: string | null, categories: CategoryOption[] | null): string {
  const target = categoryId?.toLowerCase();
  const category = categories?.find((item) => item.id.toLowerCase() === target);
  if (!category) return CATEGORY_FALLBACK_LABEL;
  return category.status === "archived" ? `${category.name} (arquivada)` : category.name;
}

/** Estado de categorizacao sempre em texto; incerto e nao reconhecido sao estados normais. */
export function categorizationLabel(
  transaction: Pick<Transaction, "categorizationStatus" | "categorizationSource" | "categoryId">,
  categories: CategoryOption[] | null,
): string {
  switch (transaction.categorizationStatus) {
    case "categorized": {
      const origin =
        transaction.categorizationSource === "rule" ? "aplicada por regra" : "definida por você";
      return `${categoryName(transaction.categoryId, categories)} · ${origin}`;
    }
    case "uncertain":
      return "Categoria incerta";
    case "unrecognized":
      return "Não reconhecida";
    case "not_applicable":
      return "Não se aplica";
    case "unclassified":
      return "Sem categoria";
  }
}

/**
 * Acrescenta a proxima pagina sem repetir ids: um registro novo desloca a paginacao
 * do servidor e pode reenviar um item ja exibido.
 */
export function appendPage(current: Transaction[], next: Transaction[]): Transaction[] {
  const seen = new Set(current.map((item) => item.id));
  return [...current, ...next.filter((item) => !seen.has(item.id))];
}

/** Troca a linha pela versao confirmada pela API, sem supor o resultado localmente. */
export function replaceItem(items: Transaction[], updated: Transaction): Transaction[] {
  return items.map((item) => (item.id === updated.id ? updated : item));
}

export type CategorizationTone = "positive" | "warning" | "neutral";

/** Tom da etiqueta; o texto de `categorizationLabel` sempre acompanha a cor. */
export function categorizationTone(
  transaction: Pick<Transaction, "categorizationStatus">,
): CategorizationTone {
  switch (transaction.categorizationStatus) {
    case "categorized":
      return "positive";
    case "uncertain":
    case "unrecognized":
      return "warning";
    default:
      return "neutral";
  }
}

export type MovementDirection = "in" | "out" | "transfer";

export function movementDirection(
  transaction: Pick<Transaction, "type" | "transferSide">,
): MovementDirection {
  if (transaction.type === "transfer") return "transfer";
  return transaction.type === "income" ? "in" : "out";
}
