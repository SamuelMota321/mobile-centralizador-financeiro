import type { Account, AccountType } from "../lib/accounts/types";

export const ACCOUNT_GROUPS = ["banks", "cards", "investments", "others"] as const;
export type AccountGroup = (typeof ACCOUNT_GROUPS)[number];

export const GROUP_LABELS: Record<AccountGroup, string> = {
  banks: "Bancos",
  cards: "Cartões",
  investments: "Investimentos",
  others: "Outros",
};

const GROUP_OF_TYPE: Record<AccountType, AccountGroup> = {
  checking: "banks",
  savings: "banks",
  payment: "banks",
  credit_card: "cards",
  investment: "investments",
  cash: "others",
  other: "others",
};

export const SEARCH_MAX_LENGTH = 80;

export interface AccountFilters {
  search: string;
  group: AccountGroup | null;
}

/** Sem acento e sem caixa: "itau" encontra "Itaú". */
function normalize(text: string): string {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

/** Filtra no aparelho a lista já carregada: a API de contas não tem busca. */
export function filterAccounts(accounts: readonly Account[], filters: AccountFilters): Account[] {
  const term = normalize(filters.search);
  return accounts.filter((account) => {
    if (filters.group && GROUP_OF_TYPE[account.type] !== filters.group) return false;
    if (!term) return true;
    return normalize(`${account.name} ${account.institutionName ?? ""}`).includes(term);
  });
}

export interface AccountGroupView {
  group: AccountGroup;
  label: string;
  accounts: Account[];
}

/** Grupos na ordem fixa, só os que têm contas; dentro do grupo, a ordem da API. */
export function groupAccounts(accounts: readonly Account[]): AccountGroupView[] {
  return ACCOUNT_GROUPS.map((group) => ({
    group,
    label: GROUP_LABELS[group],
    accounts: accounts.filter((account) => GROUP_OF_TYPE[account.type] === group),
  })).filter((view) => view.accounts.length > 0);
}

export interface AccountCounts {
  total: number;
  manual: number;
  connected: number;
  byGroup: Record<AccountGroup, number>;
}

/** Contagens, nunca valores: saldo consolidado pertence ao painel (Sprint 5). */
export function accountCounts(accounts: readonly Account[]): AccountCounts {
  const byGroup: Record<AccountGroup, number> = { banks: 0, cards: 0, investments: 0, others: 0 };
  for (const account of accounts) byGroup[GROUP_OF_TYPE[account.type]] += 1;
  const manual = accounts.filter((account) => account.origin === "manual").length;
  return { total: accounts.length, manual, connected: accounts.length - manual, byGroup };
}

const GROUP_NOUNS: Record<AccountGroup, [string, string]> = {
  banks: ["banco", "bancos"],
  cards: ["cartão", "cartões"],
  investments: ["investimento", "investimentos"],
  others: ["outra", "outras"],
};

/** "2 bancos · 1 cartão": só os grupos presentes. */
export function groupBreakdown(byGroup: Record<AccountGroup, number>): string {
  return ACCOUNT_GROUPS.filter((group) => byGroup[group] > 0)
    .map((group) => `${byGroup[group]} ${GROUP_NOUNS[group][byGroup[group] === 1 ? 0 : 1]}`)
    .join(" · ");
}

export function shareOf(part: number, total: number): number {
  return total > 0 ? part / total : 0;
}
