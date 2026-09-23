import type { AccountType } from "../lib/accounts/types";

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  checking: "Conta corrente",
  savings: "Poupanca",
  payment: "Conta de pagamento",
  cash: "Dinheiro",
  credit_card: "Cartao de credito",
  investment: "Investimento",
  other: "Outra",
};
