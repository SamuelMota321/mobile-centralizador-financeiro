import type { AccountOption } from "./movement-presentation";

export function accountChoices(accounts: AccountOption[]) {
  return accounts.map((account) => ({ value: account.id, label: account.name }));
}

/** Conta que saiu da lista de ativas deixa de contar como selecionada. */
export function selectedAccount(accountId: string, accounts: AccountOption[]): string {
  return accounts.some((account) => account.id === accountId) ? accountId : "";
}
