import {
  SAMPLE_BALANCES,
  SAMPLE_DAILY_AVAILABLE,
  SAMPLE_DAILY_FLOW,
  SAMPLE_FLOW_MONTHS,
  SAMPLE_PERIODS,
  SAMPLE_RECENT,
  SAMPLE_SPENDING,
  SAMPLE_SPENDING_MOVEMENTS,
} from "./fixtures";
import type {
  BalancesSummary,
  DailyAvailableSummary,
  DailyFlowSummary,
  FlowSummary,
  Page,
  RecentMovement,
  SpendingMovement,
  SpendingSummary,
} from "./types";

// Dados da prévia, espelhados da Visão geral da web.

export type OverviewPeriod = (typeof SAMPLE_PERIODS)[number];

/** Meses por página no gráfico de fluxo; a página 1 termina no período escolhido (D-05). */
const FLOW_WINDOW = 7;

/** Saídas por página na lista sob a rosca. */
export const MOVEMENTS_PAGE_SIZE = 6;

/** Filtro das saídas sem categoria segura (o "A revisar" da rosca). */
export const REVIEW_FILTER = "a-revisar";

/** Do mais recente ao mais antigo; o primeiro é o mês corrente (parcial). */
export function listPeriods(): readonly OverviewPeriod[] {
  return SAMPLE_PERIODS;
}

export function getBalances(period: OverviewPeriod): BalancesSummary {
  return SAMPLE_BALANCES[period];
}

/** Uma categoria com gasto no período ou "a-revisar". */
export function parseCategory(value: string | null, spending: SpendingSummary): string | null {
  if (value === null) return null;
  if (value === REVIEW_FILTER) return spending.toReview.count > 0 ? value : null;
  return spending.categories.some((category) => category.categoryId === value) ? value : null;
}

const clampPage = (page: number, pages: number) => Math.min(Math.max(page, 1), pages);

export function getFlow(period: OverviewPeriod, page = 1): FlowSummary {
  const end = SAMPLE_FLOW_MONTHS.findIndex((month) => month.month === period);
  if (end < 0) throw new RangeError(`Período sem fluxo: ${period}`);
  const available = end + 1;
  const pages = Math.max(1, Math.ceil(available / FLOW_WINDOW));
  const current = clampPage(page, pages);
  // A última página volta até completar a janela: repetir meses é melhor que mostrar um só.
  const start = Math.max(0, available - current * FLOW_WINDOW);
  return {
    months: SAMPLE_FLOW_MONTHS.slice(start, Math.min(available, start + FLOW_WINDOW)),
    page: current,
    pages,
  };
}

/** Saídas do período, mais recentes primeiro. */
export function getSpendingMovements(
  period: OverviewPeriod,
  { category, page }: { category: string | null; page: number },
): Page<SpendingMovement> {
  const all = SAMPLE_SPENDING_MOVEMENTS[period];
  const filtered =
    category === null
      ? all
      : category === REVIEW_FILTER
        ? all.filter((item) => item.toReview)
        : all.filter((item) => item.categoryId === category);
  const pages = Math.max(1, Math.ceil(filtered.length / MOVEMENTS_PAGE_SIZE));
  const current = clampPage(page, pages);
  return {
    items: filtered.slice((current - 1) * MOVEMENTS_PAGE_SIZE, current * MOVEMENTS_PAGE_SIZE),
    page: current,
    pages,
    total: filtered.length,
  };
}

export function getSpending(period: OverviewPeriod): SpendingSummary {
  return SAMPLE_SPENDING[period];
}

/** Os cinco lançamentos mais recentes. Ligado: GET /transactions?page=1&pageSize=5. */
export function getRecentMovements(): readonly RecentMovement[] {
  return SAMPLE_RECENT;
}

/**
 * Disponível nos últimos 30 dias até a referência do período, para o painel que abre ao
 * clicar no Disponível. Ligado: saldo diário consolidado, que o backend ainda não tem.
 */
export function getAvailableDaily(period: OverviewPeriod): DailyAvailableSummary {
  return { points: [...SAMPLE_DAILY_AVAILABLE[period]] };
}

/**
 * Entradas ou saídas de cada dia nos últimos 30 dias até a referência do período, para os
 * painéis dos números da faixa. Ligado: somas diárias do fluxo, que o backend ainda não tem.
 */
export function getDailyFlow(period: OverviewPeriod, kind: "inflow" | "outflow"): DailyFlowSummary {
  return { points: [...SAMPLE_DAILY_FLOW[kind][period]] };
}
