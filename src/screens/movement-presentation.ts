import { formatMoney } from "../lib/money";
import { fromCents, toCents } from "../lib/overview/chart-model";
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

/** Tom do status; o texto de `statusLabel` sempre acompanha a cor. */
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

// ---------- Período, busca e filtros ----------

export const PERIOD_PRESETS = { "1m": "1 mês", "3m": "3 meses", "6m": "6 meses", "12m": "1 ano" } as const;
export type PeriodPreset = keyof typeof PERIOD_PRESETS;
const PRESET_MONTHS: Record<PeriodPreset, number> = { "1m": 1, "3m": 3, "6m": 6, "12m": 12 };
export const DEFAULT_PERIOD: PeriodPreset = "1m";

/** Janela de busca para "Tudo": a API não filtra, então o aparelho filtra os mais recentes. */
export const SEARCH_WINDOW = 500;

export const TYPE_FILTERS = { receitas: "Receitas", despesas: "Despesas", transferencias: "Transferências" } as const;
export type TypeFilter = keyof typeof TYPE_FILTERS;

export const SITUATION_FILTERS = {
  "sem-categoria": "Sem categoria",
  categorizadas: "Categorizadas",
  incertas: "Incertas ou não reconhecidas",
  "nao-se-aplica": "Não se aplica",
} as const;
export type SituationFilter = keyof typeof SITUATION_FILTERS;

export interface MovementFilters {
  search: string;
  type: TypeFilter | null;
  situation: SituationFilter | null;
  accountId: string | null;
  categoryId: string | null;
  /** Atalho de período; "personalizado" usa `from` e `to`; null é "Tudo". */
  period: PeriodPreset | "personalizado" | null;
  from: string | null;
  to: string | null;
}

export const DEFAULT_FILTERS: MovementFilters = {
  search: "",
  type: null,
  situation: null,
  accountId: null,
  categoryId: null,
  period: DEFAULT_PERIOD,
  from: null,
  to: null,
};

/** Filtros além do período: com eles, a lista é filtrada no aparelho. */
export function hasContentFilters(filters: MovementFilters): boolean {
  return Boolean(filters.search.trim() || filters.type || filters.situation || filters.accountId || filters.categoryId);
}

/** Quantos filtros da tela "Filtros" estão ativos (para o contador do botão). */
export function activeFilterCount(filters: MovementFilters): number {
  return [filters.type, filters.situation, filters.accountId, filters.categoryId].filter(Boolean).length;
}

function pad(value: number, length = 2): string {
  return String(value).padStart(length, "0");
}

/** Mesmo dia N meses antes; sem esse dia no mês de destino, o último dia dele (31/05 − 3 = 28/02). */
export function monthsBefore(today: string, months: number): string {
  const [year, month, day] = today.split("-").map(Number);
  const target = new Date(year, month - 1 - months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  return `${pad(target.getFullYear(), 4)}-${pad(target.getMonth() + 1)}-${pad(Math.min(day, lastDay))}`;
}

/** Intervalo de datas civis do filtro, inclusivo; null nas pontas abertas. */
export function dateRange(filters: MovementFilters, today: string): { since: string | null; until: string | null } {
  if (filters.period === "personalizado") {
    const [since, until] = filters.from && filters.to && filters.from > filters.to ? [filters.to, filters.from] : [filters.from, filters.to];
    return { since, until };
  }
  if (filters.period) return { since: monthsBefore(today, PRESET_MONTHS[filters.period]), until: null };
  return { since: null, until: null };
}

function normalize(text: string): string {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

function matchesSituation(transaction: Transaction, situation: SituationFilter): boolean {
  switch (situation) {
    case "sem-categoria":
      return transaction.categorizationStatus === "unclassified";
    case "categorizadas":
      return transaction.categorizationStatus === "categorized";
    case "incertas":
      return transaction.categorizationStatus === "uncertain" || transaction.categorizationStatus === "unrecognized";
    case "nao-se-aplica":
      return transaction.categorizationStatus === "not_applicable";
  }
}

const TYPE_OF_FILTER: Record<TypeFilter, Transaction["type"]> = {
  receitas: "income",
  despesas: "expense",
  transferencias: "transfer",
};

/** Nomes para a busca: categoria e conta, além da descrição. Lista indisponível não busca por nome. */
export interface SearchNames {
  accounts: readonly AccountOption[] | null;
  categories: readonly CategoryOption[] | null;
}

/** Combina busca e filtros sobre a lista já carregada, mantendo a ordem da API. */
export function filterMovements(
  transactions: readonly Transaction[],
  filters: MovementFilters,
  today: string,
  names: SearchNames = { accounts: null, categories: null },
): Transaction[] {
  const term = normalize(filters.search.trim());
  const { since, until } = dateRange(filters, today);
  const accountNames = new Map(names.accounts?.map((account) => [account.id.toLowerCase(), account.name]));
  const categoryNames = new Map(names.categories?.map((category) => [category.id.toLowerCase(), category.name]));
  return transactions.filter((transaction) => {
    if (filters.type && transaction.type !== TYPE_OF_FILTER[filters.type]) return false;
    if (filters.situation && !matchesSituation(transaction, filters.situation)) return false;
    if (filters.accountId && transaction.accountId.toLowerCase() !== filters.accountId.toLowerCase()) return false;
    if (filters.categoryId && transaction.categoryId?.toLowerCase() !== filters.categoryId.toLowerCase()) return false;
    if (since && transaction.occurredOn < since) return false;
    if (until && transaction.occurredOn > until) return false;
    if (!term) return true;
    const haystack = [
      transaction.description ?? "",
      accountNames.get(transaction.accountId.toLowerCase()) ?? "",
      transaction.categoryId ? (categoryNames.get(transaction.categoryId.toLowerCase()) ?? "") : "",
    ].join(" ");
    return normalize(haystack).includes(term);
  });
}

/** Lançamentos dentro de um intervalo inclusivo de datas civis. */
export function withinRange<T extends Pick<Transaction, "occurredOn">>(items: readonly T[], since: string, until: string): T[] {
  return items.filter((item) => item.occurredOn >= since && item.occurredOn <= until);
}

// ---------- Colunas da linha ----------

/** Rótulo curto do tipo para a etiqueta; a direção da transferência fica na linha de apoio. */
export function typeTag(transaction: Pick<Transaction, "type">): string {
  if (transaction.type === "income") return "Receita";
  if (transaction.type === "expense") return "Despesa";
  return "Transferência";
}

export function statusLabel(transaction: Pick<Transaction, "categorizationStatus">): string {
  switch (transaction.categorizationStatus) {
    case "categorized":
      return "Categorizada";
    case "uncertain":
      return "Incerta";
    case "unrecognized":
      return "Não reconhecida";
    case "not_applicable":
      return "Não se aplica";
    case "unclassified":
      return "Sem categoria";
  }
}

export function statusSource(transaction: Pick<Transaction, "categorizationStatus" | "categorizationSource">): string | null {
  if (transaction.categorizationStatus !== "categorized") return null;
  return transaction.categorizationSource === "rule" ? "por regra" : "por você";
}

/** Nome do chip de categoria: a categoria quando categorizada; "Outro" nos demais casos. */
export function categoryChipLabel(
  transaction: Pick<Transaction, "categorizationStatus" | "categoryId">,
  categories: readonly CategoryOption[] | null,
): string {
  if (transaction.categorizationStatus !== "categorized" || !transaction.categoryId) return "Outro";
  const target = transaction.categoryId.toLowerCase();
  const category = categories?.find((item) => item.id.toLowerCase() === target);
  if (!category) return CATEGORY_FALLBACK_LABEL;
  return category.status === "archived" ? `${category.name} (arquivada)` : category.name;
}

/** Motivo da ação de categorização indisponível, para o menu da linha. */
export function categorizeBlockedReason(
  transaction: Pick<Transaction, "type" | "status">,
  categoriesAvailable: boolean,
): string | null {
  if (transaction.type === "transfer") return "Transferências não recebem categoria.";
  if (transaction.status === "voided") return "Lançamento estornado não recebe categoria.";
  if (!categoriesAvailable) return "Categorias indisponíveis no momento.";
  return null;
}

/** "Mostrando 20 de 124 movimentações". */
export function showingText(shown: number, total: number): string {
  const noun = total === 1 ? "movimentação" : "movimentações";
  return `Mostrando ${shown} de ${total} ${noun}`;
}

// ---------- Entradas, saídas e balanço do período ----------

export interface PeriodTotals {
  income: string;
  expense: string;
  /** Entradas menos saídas; transferências entre contas próprias não entram. */
  balance: string;
}

/** Só lançamentos válidos: estornos e transferências ficam fora. Soma em centavos. */
export function periodTotals(transactions: readonly Transaction[]): PeriodTotals {
  let income = BigInt(0);
  let expense = BigInt(0);
  for (const transaction of transactions) {
    if (transaction.status !== "posted") continue;
    if (transaction.type === "income") income += toCents(transaction.amount);
    else if (transaction.type === "expense") expense += toCents(transaction.amount);
  }
  return { income: fromCents(income), expense: fromCents(expense), balance: fromCents(income - expense) };
}

function shiftDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const shifted = new Date(year, month - 1, day + days);
  return `${pad(shifted.getFullYear(), 4)}-${pad(shifted.getMonth() + 1)}-${pad(shifted.getDate())}`;
}

function daysBetween(since: string, until: string): number {
  const [y1, m1, d1] = since.split("-").map(Number);
  const [y2, m2, d2] = until.split("-").map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000);
}

/** Período anterior com o mesmo número de dias, terminando na véspera do início. */
export function previousRange(since: string, until: string): { since: string; until: string } {
  const length = daysBetween(since, until);
  const previousUntil = shiftDays(since, -1);
  return { since: shiftDays(previousUntil, -length), until: previousUntil };
}

/** Variação percentual inteira; null quando o período anterior é zero (sem base). */
export function percentChange(current: string, previous: string): number | null {
  const base = toCents(previous);
  if (base === BigInt(0)) return null;
  const delta = toCents(current) - base;
  return Math.round((Number(delta) / Math.abs(Number(base))) * 100);
}

export function changeText(change: number | null): string {
  if (change === null) return "Sem base de comparação no período anterior";
  const sign = change > 0 ? "+" : change < 0 ? "−" : "";
  return `${sign}${Math.abs(change)}% vs. período anterior`;
}

/** Séries do período para os minigráficos, acumuladas dia a dia desde o início do período. */
export function dailySeries(
  transactions: readonly Transaction[],
  since: string,
  until: string,
): { income: string[]; expense: string[]; balance: string[] } {
  const length = daysBetween(since, until) + 1;
  const income = Array.from({ length }, () => BigInt(0));
  const expense = Array.from({ length }, () => BigInt(0));
  for (const transaction of transactions) {
    if (transaction.status !== "posted" || transaction.occurredOn < since || transaction.occurredOn > until) continue;
    const index = daysBetween(since, transaction.occurredOn);
    if (transaction.type === "income") income[index] += toCents(transaction.amount);
    else if (transaction.type === "expense") expense[index] += toCents(transaction.amount);
  }
  // Acumulado: a linha termina no valor do card.
  const accumulate = (values: bigint[]) => {
    let running = BigInt(0);
    return values.map((value) => fromCents((running += value)));
  };
  return {
    income: accumulate(income),
    expense: accumulate(expense),
    balance: accumulate(income.map((value, index) => value - expense[index])),
  };
}

/**
 * Reduz a série para no máximo `max` pontos, a intervalos iguais, mantendo o primeiro e o
 * último. Em série acumulada a linha continua terminando no valor certo.
 */
export function downsample<T>(values: readonly T[], max = 60): T[] {
  if (values.length <= max) return [...values];
  const step = (values.length - 1) / (max - 1);
  return Array.from({ length: max }, (_, index) => values[Math.round(index * step)]);
}
