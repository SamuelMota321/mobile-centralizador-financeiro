import { afterEach, describe, expect, it, vi } from "vitest";
import { toCents } from "./chart-model";
import { overviewPreviewEnabled } from "./flag";
import { splitAccounts, toDonutItems } from "./presentation";
import {
  getAvailableDaily,
  getBalances,
  getDailyFlow,
  getFlow,
  getSpending,
  getSpendingMovements,
  listPeriods,
  MOVEMENTS_PAGE_SIZE,
  parseCategory,
  REVIEW_FILTER,
} from "./source";

afterEach(() => vi.unstubAllEnvs());

describe("prévia da Visão geral", () => {
  it("só habilita a aba se a flag pública do Expo for explicitamente verdadeira", () => {
    vi.stubEnv("OVERVIEW_PREVIEW", "true");
    vi.stubEnv("EXPO_PUBLIC_OVERVIEW_PREVIEW", undefined);
    expect(overviewPreviewEnabled()).toBe(false);
    vi.stubEnv("EXPO_PUBLIC_OVERVIEW_PREVIEW", "false");
    expect(overviewPreviewEnabled()).toBe(false);
    vi.stubEnv("EXPO_PUBLIC_OVERVIEW_PREVIEW", "true");
    expect(overviewPreviewEnabled()).toBe(true);
  });

  it("troca o período dos saldos, das séries de 30 dias e do fluxo mensal", () => {
    const [current, previous] = listPeriods();
    expect(getBalances(current).available).not.toBe(getBalances(previous).available);
    expect(getFlow(current).months.at(-1)).toMatchObject({ month: current, partial: true });
    expect(getFlow(previous).months.at(-1)).toMatchObject({ month: previous, partial: false });
    for (const period of listPeriods()) {
      const available = getAvailableDaily(period).points;
      expect(available).toHaveLength(30);
      expect(available.at(-1)).toMatchObject({ available: getBalances(period).available });
      expect(available.at(-1)?.date.slice(0, 7)).toBe(period);
      for (const kind of ["inflow", "outflow"] as const) {
        const daily = getDailyFlow(period, kind).points;
        expect(daily).toHaveLength(30);
        expect(daily.map((point) => point.date)).toEqual(available.map((point) => point.date));
      }
    }
  });

  it("pagina o fluxo em direção aos meses mais antigos", () => {
    const [period] = listPeriods();
    const first = getFlow(period);
    const second = getFlow(period, 2);
    expect(first.months).toHaveLength(7);
    expect(second.page).toBe(2);
    expect(second.months.at(-1)?.month.localeCompare(period)).toBeLessThan(0);
    expect(getFlow(period, 99)).toEqual(second);
  });

  it("filtra os gastos por categoria e por A revisar, preservando os totais da rosca", () => {
    const [period] = listPeriods();
    const spending = getSpending(period);
    const slices = toDonutItems(spending, [], "#888");
    const total = slices.reduce((sum, slice) => sum + toCents(slice.value), BigInt(0));
    expect(total).toBe(toCents(spending.total));
    expect(slices.at(-1)?.id).toBe(REVIEW_FILTER);
    expect(parseCategory("desconhecida", spending)).toBeNull();

    const category = spending.categories[0];
    const filtered = getSpendingMovements(period, { category: parseCategory(category.categoryId, spending), page: 1 });
    expect(filtered.total).toBe(category.count);
    expect(filtered.items.every((item) => item.categoryId === category.categoryId)).toBe(true);

    const review = getSpendingMovements(period, { category: parseCategory(REVIEW_FILTER, spending), page: 1 });
    expect(review.total).toBe(spending.toReview.count);
    expect(review.items.every((item) => item.toReview)).toBe(true);
  });

  it("pagina as saídas mais recentes sem repetir lançamentos", () => {
    const [period] = listPeriods();
    const first = getSpendingMovements(period, { category: null, page: 1 });
    const second = getSpendingMovements(period, { category: null, page: 2 });
    expect(first.items).toHaveLength(MOVEMENTS_PAGE_SIZE);
    expect(second.page).toBe(2);
    expect(second.items.some((item) => first.items.some((other) => other.transactionId === item.transactionId))).toBe(false);
    expect(second.items[0].date.localeCompare(first.items[first.items.length - 1].date)).toBeLessThanOrEqual(0);
  });

  it("mantém os cartões em um grupo próprio, fora do saldo disponível", () => {
    const balances = getBalances(listPeriods()[0]);
    const { accounts, cards } = splitAccounts(balances.accounts);
    expect(cards.length).toBeGreaterThan(0);
    expect(cards.every((card) => card.type === "credit_card")).toBe(true);
    expect(accounts).toHaveLength(balances.availableAccounts);
    expect(accounts.reduce((sum, account) => sum + toCents(account.balance), BigInt(0))).toBe(toCents(balances.available));
  });
});
