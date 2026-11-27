import { describe, expect, it } from "vitest";
import type { Account } from "../lib/accounts/types";
import { accountCounts, filterAccounts, groupAccounts, groupBreakdown, shareOf } from "./accounts-logic";

let sequence = 0;
function account(overrides: Partial<Account>): Account {
  sequence += 1;
  return {
    id: `00000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`,
    name: "Conta",
    type: "checking",
    origin: "manual",
    institutionName: null,
    initialBalance: "0.00",
    initialBalanceAsOf: "2026-10-01",
    currencyCode: "BRL",
    archivedAt: null,
    createdAt: "2026-10-01T12:00:00.000Z",
    updatedAt: "2026-10-01T12:00:00.000Z",
    ...overrides,
  };
}

const corrente = account({ name: "Conta Corrente", type: "checking", institutionName: "Itaú" });
const poupanca = account({ name: "Reserva", type: "savings", institutionName: "Banco do Brasil", origin: "connected" });
const cartao = account({ name: "Cartão Roxo", type: "credit_card", institutionName: "Nubank" });
const tesouro = account({ name: "Tesouro", type: "investment" });
const carteira = account({ name: "Carteira", type: "cash" });
const all = [corrente, cartao, poupanca, tesouro, carteira];

describe("filterAccounts", () => {
  it("busca no nome e na instituição, sem acento nem caixa", () => {
    expect(filterAccounts(all, { search: "itau", group: null })).toEqual([corrente]);
    expect(filterAccounts(all, { search: "CARTÃO", group: null })).toEqual([cartao]);
  });

  it("filtra pelo grupo do tipo", () => {
    expect(filterAccounts(all, { search: "", group: "banks" })).toEqual([corrente, poupanca]);
    expect(filterAccounts(all, { search: "", group: "others" })).toEqual([carteira]);
  });

  it("combina busca e grupo", () => {
    expect(filterAccounts(all, { search: "brasil", group: "cards" })).toEqual([]);
  });
});

describe("groupAccounts", () => {
  it("agrupa na ordem fixa e omite grupos vazios", () => {
    const groups = groupAccounts([cartao, carteira, corrente, poupanca]);
    expect(groups.map((group) => group.label)).toEqual(["Bancos", "Cartões", "Outros"]);
    expect(groups[0].accounts).toEqual([corrente, poupanca]);
  });
});

describe("contagens", () => {
  it("conta origem e grupos, sem somar valores", () => {
    const counts = accountCounts(all);
    expect(counts).toMatchObject({ total: 5, manual: 4, connected: 1 });
    expect(counts.byGroup).toEqual({ banks: 2, cards: 1, investments: 1, others: 1 });
  });

  it("descreve só os grupos presentes, com singular e plural", () => {
    expect(groupBreakdown({ banks: 2, cards: 1, investments: 0, others: 1 })).toBe("2 bancos · 1 cartão · 1 outra");
  });

  it("parte do total sem dividir por zero", () => {
    expect(shareOf(1, 4)).toBe(0.25);
    expect(shareOf(0, 0)).toBe(0);
  });
});
