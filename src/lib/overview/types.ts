// Agregações da Visão geral (HU-010) na forma que o Developer 2 pediu ao Developer 1
// (planejamento S5, seção 5). O backend ainda não publicou estas rotas: nomes e campos são
// provisórios e devem ser reconferidos no OpenAPI antes de ligar a tela na API.
// Totais chegam calculados pelo servidor; o cliente só formata (RNF-013).

import type { AccountType } from "../accounts/types";

/** Frescor do saldo: prazo de "desatualizado" é a definição D-08, ainda aberta. */
export type Freshness = "current" | "stale" | "unavailable";

/** De onde vem o saldo da conta. */
export type BalanceSource = "manual" | "ofx" | "pluggy";

export interface AccountBalance {
  accountId: string;
  name: string;
  type: AccountType;
  source: BalanceSource;
  institutionName: string | null;
  /** Saldo atual (D-01), string decimal com duas casas, assinada. */
  balance: string;
  currencyCode: "BRL";
  /** Momento a que o saldo se refere (ISO 8601 com fuso). */
  asOf: string;
  freshness: Freshness;
}

export interface BalancesSummary {
  /** Soma dos saldos das contas que contam como disponíveis (D-03). */
  available: string;
  /** Quantas contas entram em `available`. */
  availableAccounts: number;
  /** Referência mais antiga entre as contas somadas (D-07). */
  asOf: string;
  /** Alguma conta somada está desatualizada. */
  includesStale: boolean;
  accounts: AccountBalance[];
  /**
   * Disponível no fim de cada mês, do mais antigo ao período escolhido (o último é o
   * próprio `available`). Acréscimo pedido ao Developer 1 para a tendência e a variação.
   */
  history: { month: string; available: string }[];
}

/** Lançamento para "Últimas movimentações": vem de GET /transactions quando ligado. */
export interface RecentMovement {
  transactionId: string;
  /** AAAA-MM-DD. */
  date: string;
  description: string | null;
  direction: "inflow" | "outflow" | "transfer";
  /** Valor positivo; o sinal vem de `direction`. */
  amount: string;
  accountName: string;
  /** null: sem categoria ou transferência. */
  categoryId: string | null;
  categoryName: string | null;
  /** Sem categoria segura (`unclassified`, `uncertain`, `unrecognized`). */
  toReview: boolean;
}

export interface FlowMonth {
  /** AAAA-MM. */
  month: string;
  /** Só `income` `posted`, sem transferências (D-02, D-04). */
  inflow: string;
  /** Só `expense` `posted`, sem transferências. */
  outflow: string;
  /** inflow − outflow. */
  net: string;
  /** Mês corrente, ainda em andamento (D-05). */
  partial: boolean;
}

export interface FlowSummary {
  /** Do mais antigo ao mais recente; na página 1, o último é o período escolhido. */
  months: FlowMonth[];
  /** Página de meses: 1 termina no período; as seguintes vão para trás. */
  page: number;
  pages: number;
}

export interface SpendingCategory {
  categoryId: string;
  name: string;
  archived: boolean;
  amount: string;
  count: number;
}

export interface SpendingSummary {
  /** AAAA-MM. */
  period: string;
  /** Total de saídas do período, base dos percentuais (D-12). */
  total: string;
  /** Soma de `unclassified`, `uncertain` e `unrecognized` (D-06). */
  toReview: { amount: string; count: number };
  categories: SpendingCategory[];
}

/** Saída do período para a lista sob a rosca; vem de GET /transactions com filtros. */
export interface SpendingMovement {
  transactionId: string;
  /** AAAA-MM-DD. */
  date: string;
  description: string | null;
  /** Valor positivo (é sempre saída). */
  amount: string;
  accountName: string;
  /** null quando ainda não tem categoria segura. */
  categoryId: string | null;
  categoryName: string | null;
  toReview: boolean;
}

export interface Page<T> {
  items: T[];
  page: number;
  pages: number;
  total: number;
}

/** Disponível no fim de um dia; ligado: saldo diário consolidado (pedido ao Developer 1). */
export interface DailyAvailable {
  /** AAAA-MM-DD. */
  date: string;
  available: string;
}

export interface DailyAvailableSummary {
  /** Do mais antigo ao mais recente; o último é a referência do período. */
  points: DailyAvailable[];
}

/** Soma de um dia (entradas ou saídas); ligado: somas diárias do fluxo (pedido ao Developer 1). */
export interface DailyAmount {
  /** AAAA-MM-DD. */
  date: string;
  /** Soma do dia, sem transferências (D-04); zero quando não houve lançamento. */
  amount: string;
}

export interface DailyFlowSummary {
  /** Do mais antigo ao mais recente; o último é a referência do período. */
  points: DailyAmount[];
}
