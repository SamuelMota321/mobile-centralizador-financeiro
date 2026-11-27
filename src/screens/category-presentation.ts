import { formatShare, fromCents, toCents } from "../lib/overview/chart-model";
import type { Transaction } from "../lib/transactions/types";
import { DEFAULT_PERIOD, monthsBefore, PERIOD_PRESETS, type MovementFilters, type PeriodPreset } from "./movement-presentation";

// ---------- Ordenação, busca e período ----------

export const SORTS = { uso: "Mais usadas", nome: "Nome (A–Z)", recentes: "Mais recentes" } as const;
export type CategorySort = keyof typeof SORTS;

/** Categorias por página, nas ativas e nas arquivadas. */
export const CATEGORIES_PAGE_SIZE = 10;

const PRESET_MONTHS: Record<PeriodPreset, number> = { "1m": 1, "3m": 3, "6m": 6, "12m": 12 };

/** Período inclusivo: N meses antes de hoje até hoje (mesma regra de Movimentações). */
export function periodRange(period: PeriodPreset, today: string): { since: string; until: string } {
  return { since: monthsBefore(today, PRESET_MONTHS[period]), until: today };
}

export function periodLabel(period: PeriodPreset): string {
  return PERIOD_PRESETS[period];
}

/** Recorta a página pedida; página além do fim vale a última. */
export function paginate<T>(items: readonly T[], page: number, size = CATEGORIES_PAGE_SIZE): { items: T[]; page: number; pages: number } {
  const pages = Math.max(1, Math.ceil(items.length / size));
  const current = Math.min(Math.max(page, 1), pages);
  return { items: items.slice((current - 1) * size, current * size), page: current, pages };
}

// ---------- Uso por categoria no período ----------

export interface CategoryUsage {
  expense: bigint;
  income: bigint;
  /** Lançamentos categorizados (receitas e despesas) no período. */
  count: number;
}

export interface PeriodUsage {
  byCategory: Map<string, CategoryUsage>;
  totalExpense: bigint;
  /** Despesas sem categoria ou incertas: entram no total e aparecem em "A revisar", nunca somem. */
  uncategorizedExpense: bigint;
  uncategorizedCount: number;
  /** Das despesas a revisar: quantas não têm categoria e quantas ficaram incertas. */
  reviewKinds: { unclassified: number; uncertain: number };
}

/**
 * Soma em centavos as receitas e despesas lançadas do período, por categoria. Transferências e
 * estornos ficam fora. Só deve ser chamada com o período lido por inteiro.
 */
export function periodUsage(transactions: readonly Transaction[], since: string, until: string): PeriodUsage {
  const byCategory = new Map<string, CategoryUsage>();
  let totalExpense = BigInt(0);
  let uncategorizedExpense = BigInt(0);
  let uncategorizedCount = 0;
  const reviewKinds = { unclassified: 0, uncertain: 0 };

  for (const transaction of transactions) {
    if (transaction.status !== "posted" || transaction.type === "transfer") continue;
    if (transaction.occurredOn < since || transaction.occurredOn > until) continue;
    const cents = toCents(transaction.amount);
    if (transaction.type === "expense") totalExpense += cents;
    const categoryId = transaction.categorizationStatus === "categorized" ? transaction.categoryId : null;
    if (!categoryId) {
      if (transaction.type === "expense") {
        uncategorizedExpense += cents;
        uncategorizedCount += 1;
        if (transaction.categorizationStatus === "unclassified") reviewKinds.unclassified += 1;
        else reviewKinds.uncertain += 1;
      }
      continue;
    }
    const entry = byCategory.get(categoryId) ?? { expense: BigInt(0), income: BigInt(0), count: 0 };
    if (transaction.type === "expense") entry.expense += cents;
    else entry.income += cents;
    entry.count += 1;
    byCategory.set(categoryId, entry);
  }
  return { byCategory, totalExpense, uncategorizedExpense, uncategorizedCount, reviewKinds };
}

/** Texto da linha: gasto quando há despesa; recebido quando só há receita. */
export function usageFigure(usage: CategoryUsage | undefined, totalExpense: bigint): {
  kind: "gasto" | "recebido" | "nenhum";
  value: string | null;
  share: string | null;
} {
  if (!usage || (usage.expense === BigInt(0) && usage.income === BigInt(0))) return { kind: "nenhum", value: null, share: null };
  if (usage.expense > BigInt(0)) {
    return { kind: "gasto", value: fromCents(usage.expense), share: formatShare(fromCents(usage.expense), fromCents(totalExpense)) };
  }
  return { kind: "recebido", value: fromCents(usage.income), share: null };
}

/** Parte das despesas, com uma casa ("22,0%"); null sem despesa no período. */
export function expenseShare(cents: bigint, totalExpense: bigint): string | null {
  return totalExpense > BigInt(0) ? formatShare(fromCents(cents), fromCents(totalExpense)) : null;
}

/**
 * Filtros de Movimentações que mostram exatamente as despesas a revisar do período: só sem
 * categoria, só incertas, ou todas as despesas quando há das duas (não existe filtro que junte).
 */
export function reviewFilters(kinds: { unclassified: number; uncertain: number }, period: PeriodPreset): Partial<MovementFilters> {
  return {
    type: "despesas",
    situation: kinds.uncertain === 0 ? "sem-categoria" : kinds.unclassified === 0 ? "incertas" : null,
    period,
  };
}

/** Lançamentos de uma categoria no mesmo período. */
export function categoryFilters(categoryId: string, period: PeriodPreset): Partial<MovementFilters> {
  return { categoryId, period };
}

export { DEFAULT_PERIOD };

// ---------- Lista ----------

function normalize(text: string): string {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

/** Busca sem acento e sem caixa; ordena por uso (gasto, depois quantidade), nome ou criação. */
export function arrangeCategories<C extends { id: string; name: string; createdAt: string }>(
  categories: readonly C[],
  usage: ReadonlyMap<string, CategoryUsage> | null,
  search: string,
  sort: CategorySort,
): C[] {
  const term = normalize(search.trim());
  const filtered = term ? categories.filter((category) => normalize(category.name).includes(term)) : [...categories];
  const byName = (a: C, b: C) => a.name.localeCompare(b.name, "pt-BR");
  if (sort === "nome") return filtered.sort(byName);
  if (sort === "recentes") return filtered.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return filtered.sort((a, b) => {
    const ua = usage?.get(a.id);
    const ub = usage?.get(b.id);
    const weight = (u: CategoryUsage | undefined) => (u ? u.expense + u.income : BigInt(0));
    const diff = weight(ub) - weight(ua);
    if (diff !== BigInt(0)) return diff > BigInt(0) ? 1 : -1;
    return (ub?.count ?? 0) - (ua?.count ?? 0) || byName(a, b);
  });
}

/** Regras ativas ou inativas (não removidas) por categoria. */
export function rulesPerCategory(rules: readonly { categoryId: string; status: string }[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const rule of rules) {
    if (rule.status === "removed") continue;
    counts.set(rule.categoryId, (counts.get(rule.categoryId) ?? 0) + 1);
  }
  return counts;
}

// ---------- Sugeridas ----------

export interface SuggestionTileData {
  name: string;
  color: string | null;
  state: "added" | "archived" | "missing";
}

/** As sugeridas com o estado de cada uma (nome exato, como o índice único do banco). */
export function suggestionTiles(
  suggested: readonly string[],
  categories: readonly { id: string; name: string; status: "active" | "archived" }[],
  colors: ReadonlyMap<string, string>,
): SuggestionTileData[] {
  const byName = new Map(categories.map((category) => [category.name, category]));
  return suggested.map((name) => {
    const found = byName.get(name);
    return {
      name,
      color: found ? (colors.get(found.id) ?? null) : null,
      state: !found ? "missing" : found.status === "archived" ? "archived" : "added",
    };
  });
}
