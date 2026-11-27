import { afterEach, describe, expect, it, vi } from "vitest";
import { investmentsPreviewEnabled, investmentsPreviewPage } from "./preview";

afterEach(() => vi.unstubAllEnvs());

describe("prévia de Investimentos", () => {
  it("só liga com EXPO_PUBLIC_INVESTMENTS_PREVIEW=true", () => {
    vi.stubEnv("EXPO_PUBLIC_INVESTMENTS_PREVIEW", "");
    expect(investmentsPreviewEnabled()).toBe(false);
    vi.stubEnv("EXPO_PUBLIC_INVESTMENTS_PREVIEW", "1");
    expect(investmentsPreviewEnabled()).toBe(false);
    vi.stubEnv("EXPO_PUBLIC_INVESTMENTS_PREVIEW", "true");
    expect(investmentsPreviewEnabled()).toBe(true);
  });

  it("os dados de exemplo passam no esquema real da API (o parse acontece dentro da função)", () => {
    const page = investmentsPreviewPage(new Date("2025-11-27T15:00:00.000Z"));
    expect(page.positions).toHaveLength(5);
    expect(page.portfolio.total).toBeNull();
    expect(page.portfolio.totalsByCurrency.map((m) => m.currencyCode)).toEqual(["BRL", "USD"]);
    expect(page.portfolio.connections.map((c) => c.availability)).toEqual(["complete", "complete", "partial", "unavailable"]);
  });

  it("as datas são relativas a hoje e nenhuma moeda é misturada na composição", () => {
    const page = investmentsPreviewPage(new Date("2025-11-27T15:00:00.000Z"));
    expect(page.portfolio.referenceDate?.startsWith("2025-11-25")).toBe(true);
    for (const currency of page.portfolio.allocation.currencies) {
      const sum = currency.byClass.reduce((total, group) => total + Number(group.amount), 0);
      expect(sum).toBe(Number(currency.denominatorAmount));
    }
  });
});
