import { describe, expect, it } from "vitest";
import { fromCents, toCents } from "../lib/overview/chart-model";
import type { Transaction } from "../lib/transactions/types";
import {
  activeFilterCount,
  categorizeBlockedReason,
  categoryChipLabel,
  changeText,
  dailySeries,
  dateRange,
  DEFAULT_FILTERS,
  downsample,
  filterMovements,
  hasContentFilters,
  monthsBefore,
  percentChange,
  periodTotals,
  previousRange,
  showingText,
  statusLabel,
  statusSource,
  typeTag,
} from "./movement-presentation";

const ACCOUNT_A = "3f1c2b4e-8a6d-4c1e-9b2a-7d5e6f8a9b0c";
const ACCOUNT_B = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";
const TODAY = "2026-11-26";

let sequence = 0;
function movement(overrides: Partial<Transaction>): Transaction {
  sequence += 1;
  return {
    id: `00000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`,
    accountId: ACCOUNT_A,
    type: "expense",
    amount: "10.00",
    occurredOn: TODAY,
    description: null,
    status: "posted",
    transferId: null,
    transferSide: null,
    categoryId: null,
    categorizationStatus: "unclassified",
    categorizationSource: null,
    createdAt: "2026-11-26T12:00:00.000Z",
    updatedAt: "2026-11-26T12:00:00.000Z",
    ...overrides,
  };
}

const mercado = movement({ description: "Mercado São João" });
const salario = movement({ type: "income", description: "Salário", occurredOn: "2026-11-01", categorizationStatus: "categorized", categorizationSource: "rule", categoryId: "c1" });
const aluguel = movement({ description: "Aluguel", occurredOn: "2026-07-10", accountId: ACCOUNT_B, categorizationStatus: "categorized", categorizationSource: "manual", categoryId: "c2" });
const transferencia = movement({ type: "transfer", transferSide: "outgoing", categorizationStatus: "not_applicable" });
const incerta = movement({ description: "Pix recebido", categorizationStatus: "uncertain" });
const all = [mercado, salario, aluguel, transferencia, incerta];
const none = { ...DEFAULT_FILTERS, period: null };
const names = {
  accounts: [
    { id: ACCOUNT_A, name: "Conta Corrente" },
    { id: ACCOUNT_B, name: "Poupança Família" },
  ],
  categories: [{ id: "c1", name: "Trabalho", status: "active" as const }],
};

describe("filtros", () => {
  it("padrão é 1 mês, sem filtros de conteúdo", () => {
    expect(DEFAULT_FILTERS.period).toBe("1m");
    expect(hasContentFilters(DEFAULT_FILTERS)).toBe(false);
    expect(activeFilterCount({ ...none, type: "despesas", accountId: ACCOUNT_A })).toBe(2);
  });

  it("busca por descrição, conta e categoria, sem acento nem caixa", () => {
    expect(filterMovements(all, { ...none, search: "SAO JOAO" }, TODAY)).toEqual([mercado]);
    expect(filterMovements(all, { ...none, search: "familia" }, TODAY, names)).toEqual([aluguel]);
    expect(filterMovements(all, { ...none, search: "trabalho" }, TODAY, names)).toEqual([salario]);
  });

  it("filtra por tipo, situação, conta, categoria e período", () => {
    expect(filterMovements(all, { ...none, type: "transferencias" }, TODAY)).toEqual([transferencia]);
    expect(filterMovements(all, { ...none, situation: "incertas" }, TODAY)).toEqual([incerta]);
    expect(filterMovements(all, { ...none, accountId: ACCOUNT_B }, TODAY)).toEqual([aluguel]);
    expect(filterMovements(all, { ...none, categoryId: "c1" }, TODAY)).toEqual([salario]);
    expect(filterMovements(all, { ...none, period: "3m" }, TODAY)).not.toContain(aluguel);
  });

  it("período personalizado é inclusivo e aceita datas trocadas", () => {
    const range = { ...none, period: "personalizado" as const, from: "2026-11-01", to: "2026-07-10" };
    expect(filterMovements(all, range, TODAY)).toEqual([salario, aluguel]);
  });
});

describe("períodos", () => {
  it("volta meses no calendário, ajustando o fim do mês", () => {
    expect(monthsBefore(TODAY, 1)).toBe("2026-10-26");
    expect(monthsBefore("2026-05-31", 3)).toBe("2026-02-28");
  });

  it("intervalo do atalho, do personalizado e de Tudo", () => {
    expect(dateRange({ ...none, period: "6m" }, TODAY)).toEqual({ since: "2026-05-26", until: null });
    expect(dateRange(none, TODAY)).toEqual({ since: null, until: null });
  });

  it("período anterior com o mesmo número de dias", () => {
    expect(previousRange("2026-10-26", "2026-11-26")).toEqual({ since: "2026-09-24", until: "2026-10-25" });
  });
});

describe("entradas, saídas e balanço", () => {
  const estornada = movement({ type: "income", amount: "999.99", status: "voided" });
  const entrada = movement({ type: "income", amount: "1000.50" });
  const saida = movement({ type: "expense", amount: "250.25" });
  const saida2 = movement({ type: "expense", amount: "0.25", occurredOn: "2026-11-24" });
  const transf = movement({ type: "transfer", transferSide: "incoming", amount: "5000.00" });

  it("soma em centavos, sem estornos nem transferências", () => {
    expect(periodTotals([entrada, saida, saida2, estornada, transf])).toEqual({ income: "1000.50", expense: "250.50", balance: "750.00" });
    expect(periodTotals([saida]).balance).toBe("-250.25");
  });

  it("variação inteira e sem base quando o anterior é zero", () => {
    expect(percentChange("112.00", "100.00")).toBe(12);
    expect(percentChange("10.00", "0.00")).toBeNull();
    expect(changeText(-50)).toBe("−50% vs. período anterior");
  });

  it("séries acumuladas no período, terminando nos totais", () => {
    expect(dailySeries([entrada, saida, saida2, estornada], "2026-11-24", "2026-11-26")).toEqual({
      income: ["0.00", "0.00", "1000.50"],
      expense: ["0.25", "0.25", "250.50"],
      balance: ["-0.25", "-0.25", "750.00"],
    });
  });

  it("reduz a série mantendo primeiro e último", () => {
    const series = Array.from({ length: 366 }, (_, index) => index);
    const reduced = downsample(series, 60);
    expect(reduced).toHaveLength(60);
    expect(reduced[0]).toBe(0);
    expect(reduced.at(-1)).toBe(365);
    expect(downsample([1, 2, 3], 60)).toEqual([1, 2, 3]);
  });

  it("centavos ida e volta", () => {
    expect(fromCents(toCents("-5197.00"))).toBe("-5197.00");
    expect(fromCents(BigInt(0))).toBe("0.00");
    expect(fromCents(BigInt(5))).toBe("0.05");
  });
});

describe("linha", () => {
  it("tipo, status e origem em texto", () => {
    expect([salario, mercado, transferencia].map(typeTag)).toEqual(["Receita", "Despesa", "Transferência"]);
    expect([mercado, salario, transferencia, incerta].map(statusLabel)).toEqual(["Sem categoria", "Categorizada", "Não se aplica", "Incerta"]);
    expect(statusSource(salario)).toBe("por regra");
    expect(statusSource(mercado)).toBeNull();
  });

  it("chip 'Outro' sem categoria e fallback sem expor o id", () => {
    expect(categoryChipLabel(salario, names.categories)).toBe("Trabalho");
    expect(categoryChipLabel(aluguel, names.categories)).toBe("Categoria indisponível");
    expect(categoryChipLabel(mercado, names.categories)).toBe("Outro");
  });

  it("motivo quando não dá para categorizar", () => {
    expect(categorizeBlockedReason(transferencia, true)).toMatch(/Transferências/);
    expect(categorizeBlockedReason({ ...mercado, status: "voided" }, true)).toMatch(/estornado/);
    expect(categorizeBlockedReason(mercado, false)).toMatch(/indisponíveis/);
    expect(categorizeBlockedReason(mercado, true)).toBeNull();
  });

  it("rodapé", () => {
    expect(showingText(20, 124)).toBe("Mostrando 20 de 124 movimentações");
  });
});
