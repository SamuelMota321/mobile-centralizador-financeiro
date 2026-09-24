import type { AccountType } from "../lib/accounts/types";

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  checking: "Conta corrente",
  savings: "Poupança",
  payment: "Conta de pagamento",
  cash: "Dinheiro",
  credit_card: "Cartão de crédito",
  investment: "Investimento",
  other: "Outra",
};
