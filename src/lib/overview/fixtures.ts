import type {
  AccountBalance,
  BalancesSummary,
  DailyAmount,
  DailyAvailable,
  FlowMonth,
  RecentMovement,
  SpendingMovement,
  SpendingSummary,
} from "./types";

// Dados de exemplo da prévia da Visão geral, enquanto as rotas de agregação não existem.
// Seguem as recomendações D-01 a D-08 do Developer 2 (cartão fora do Disponível,
// transferências fora do fluxo, mês corrente parcial). Nunca são os números do usuário:
// a tela avisa isso no topo. Os totais fecham entre si; os testes conferem.

const id = (n: number) => `0e5a1c2d-7b3f-4c8a-9d1e-${String(n).padStart(12, "0")}`;
const categoryId = (n: number) => `5c9b7e10-2a4d-4f6b-8c3e-${String(n).padStart(12, "0")}`;

/** Períodos disponíveis na prévia, do mais recente ao mais antigo. */
export const SAMPLE_PERIODS = ["2026-10", "2026-09", "2026-08"] as const;

function accounts(
  asOf: string,
  balances: [string, string, string, string, string],
  stale?: { asOf: string },
): AccountBalance[] {
  const [main, reserve, cash, digital, card] = balances;
  const base = { currencyCode: "BRL" as const, asOf, freshness: "current" as const };
  return [
    { ...base, accountId: id(1), name: "Conta do dia a dia", type: "checking", source: "pluggy", institutionName: "Banco Exemplo", balance: main },
    { ...base, accountId: id(2), name: "Reserva", type: "savings", source: "manual", institutionName: "Banco Exemplo", balance: reserve },
    { ...base, accountId: id(3), name: "Carteira", type: "cash", source: "manual", institutionName: null, balance: cash },
    {
      ...base,
      accountId: id(4),
      name: "Conta digital",
      type: "payment",
      source: "ofx",
      institutionName: "Fintech Exemplo",
      balance: digital,
      ...(stale ? { asOf: stale.asOf, freshness: "stale" as const } : {}),
    },
    { ...base, accountId: id(5), name: "Cartão do dia a dia", type: "credit_card", source: "pluggy", institutionName: "Banco Exemplo", balance: card },
  ];
}

/** Disponível no fim de cada mês (outubro: na referência mais antiga). */
const AVAILABLE_HISTORY = [
  { month: "2026-05", available: "13980.40" },
  { month: "2026-06", available: "14620.75" },
  { month: "2026-07", available: "14810.30" },
  { month: "2026-08", available: "15431.10" },
  { month: "2026-09", available: "16630.20" },
  { month: "2026-10", available: "17340.95" },
];

const historyUntil = (month: string) =>
  AVAILABLE_HISTORY.slice(0, AVAILABLE_HISTORY.findIndex((entry) => entry.month === month) + 1);

export const SAMPLE_BALANCES: Record<(typeof SAMPLE_PERIODS)[number], BalancesSummary> = {
  "2026-10": {
    history: historyUntil("2026-10"),
    available: "17340.95",
    availableAccounts: 4,
    asOf: "2026-10-01T18:40:00-03:00",
    includesStale: true,
    accounts: accounts("2026-10-05T09:12:00-03:00", ["4210.55", "12000.00", "180.00", "950.40", "-1240.30"], {
      asOf: "2026-10-01T18:40:00-03:00",
    }),
  },
  "2026-09": {
    history: historyUntil("2026-09"),
    available: "16630.20",
    availableAccounts: 4,
    asOf: "2026-09-30T23:59:00-03:00",
    includesStale: false,
    accounts: accounts("2026-09-30T23:59:00-03:00", ["3890.20", "11500.00", "220.00", "1020.00", "-980.10"]),
  },
  "2026-08": {
    history: historyUntil("2026-08"),
    available: "15431.10",
    availableAccounts: 4,
    asOf: "2026-08-31T23:59:00-03:00",
    includesStale: false,
    accounts: accounts("2026-08-31T23:59:00-03:00", ["3410.75", "11000.00", "150.00", "870.35", "-1105.60"]),
  },
};

/** Março a outubro de 2026; outubro é o mês corrente da prévia. */
export const SAMPLE_FLOW_MONTHS: readonly FlowMonth[] = [
  { month: "2026-03", inflow: "6750.00", outflow: "5020.00", net: "1730.00", partial: false },
  { month: "2026-04", inflow: "6800.00", outflow: "5480.00", net: "1320.00", partial: false },
  { month: "2026-05", inflow: "6900.00", outflow: "5210.00", net: "1690.00", partial: false },
  { month: "2026-06", inflow: "6800.00", outflow: "4980.00", net: "1820.00", partial: false },
  { month: "2026-07", inflow: "7050.00", outflow: "6120.00", net: "930.00", partial: false },
  { month: "2026-08", inflow: "6800.00", outflow: "5430.00", net: "1370.00", partial: false },
  { month: "2026-09", inflow: "6950.00", outflow: "4870.00", net: "2080.00", partial: false },
  { month: "2026-10", inflow: "7100.00", outflow: "3462.30", net: "3637.70", partial: true },
];

const category = (n: number, name: string, amount: string, count: number, archived = false) => ({
  categoryId: categoryId(n),
  name,
  archived,
  amount,
  count,
});

export const SAMPLE_SPENDING: Record<(typeof SAMPLE_PERIODS)[number], SpendingSummary> = {
  "2026-10": {
    period: "2026-10",
    total: "3462.30",
    toReview: { amount: "161.40", count: 4 },
    categories: [
      category(1, "Moradia", "1450.00", 2),
      category(2, "Alimentação", "980.40", 14),
      category(3, "Transporte", "412.50", 9),
      category(4, "Saúde", "268.00", 2),
      category(5, "Lazer", "190.00", 3),
    ],
  },
  "2026-09": {
    period: "2026-09",
    total: "4870.00",
    toReview: { amount: "97.40", count: 3 },
    categories: [
      category(1, "Moradia", "1450.00", 2),
      category(2, "Alimentação", "1310.60", 21),
      category(3, "Transporte", "640.00", 12),
      category(4, "Saúde", "520.00", 3),
      category(5, "Lazer", "702.00", 6),
      category(6, "Educação", "150.00", 1, true),
    ],
  },
  "2026-08": {
    period: "2026-08",
    total: "5430.00",
    toReview: { amount: "236.00", count: 5 },
    categories: [
      category(1, "Moradia", "1450.00", 2),
      category(2, "Alimentação", "1205.30", 19),
      category(3, "Transporte", "588.20", 11),
      category(4, "Saúde", "1340.00", 4),
      category(5, "Lazer", "610.50", 5),
    ],
  },
};

/** Categorias na ordem de criação (arquivadas incluídas): decide a cor de cada uma. */
export const SAMPLE_CATEGORY_ORDER: readonly string[] = [1, 2, 3, 4, 5, 6].map(categoryId);

const movementId = (n: number) => `9a2f4b6c-1d3e-4a5b-8c7d-${String(n).padStart(12, "0")}`;

/** Os lançamentos mais recentes, de qualquer período (como em Movimentações). */
export const SAMPLE_RECENT: readonly RecentMovement[] = [
  {
    transactionId: movementId(1),
    date: "2026-10-05",
    description: "Mercado do bairro",
    direction: "outflow",
    amount: "184.90",
    accountName: "Conta do dia a dia",
    categoryId: categoryId(2),
    categoryName: "Alimentação",
    toReview: false,
  },
  {
    transactionId: movementId(2),
    date: "2026-10-05",
    description: "Padaria",
    direction: "outflow",
    amount: "23.50",
    accountName: "Conta do dia a dia",
    categoryId: null,
    categoryName: null,
    toReview: true,
  },
  {
    transactionId: movementId(3),
    date: "2026-10-03",
    description: "Aplicativo de transporte",
    direction: "outflow",
    amount: "32.40",
    accountName: "Cartão do dia a dia",
    categoryId: categoryId(3),
    categoryName: "Transporte",
    toReview: false,
  },
  {
    transactionId: movementId(4),
    date: "2026-10-02",
    description: "Reserva do mês",
    direction: "transfer",
    amount: "500.00",
    accountName: "Conta do dia a dia → Reserva",
    categoryId: null,
    categoryName: null,
    toReview: false,
  },
  {
    transactionId: movementId(5),
    date: "2026-10-01",
    description: "Salário (fictício)",
    direction: "inflow",
    amount: "6800.00",
    accountName: "Conta do dia a dia",
    categoryId: null,
    categoryName: "Renda",
    toReview: false,
  },
];

const DESCRIPTIONS: Record<string, readonly string[]> = {
  Moradia: ["Aluguel", "Condomínio", "Conta de luz", "Internet"],
  Alimentação: ["Mercado do bairro", "Padaria", "Restaurante", "Feira", "Lanchonete", "Açougue"],
  Transporte: ["Aplicativo de transporte", "Combustível", "Estacionamento", "Ônibus"],
  Saúde: ["Farmácia", "Consulta", "Exame"],
  Lazer: ["Cinema", "Streaming", "Livraria"],
  Educação: ["Curso online"],
};
const REVIEW_DESCRIPTIONS = ["Compra no débito", "Pagamento por QR", "Pix enviado", "Débito automático", "Compra online"];

/** Último dia com lançamentos: outubro é o mês corrente da prévia, até 05/10. */
const LAST_DAY: Record<(typeof SAMPLE_PERIODS)[number], number> = { "2026-10": 5, "2026-09": 30, "2026-08": 31 };

/** Divide um valor em `count` partes em centavos; a sobra fica na primeira. */
function split(amount: string, count: number): string[] {
  const cents = Number(amount.replace(".", ""));
  const base = Math.floor(cents / count);
  const toText = (value: number) => `${Math.floor(value / 100)}.${String(value % 100).padStart(2, "0")}`;
  return Array.from({ length: count }, (_, index) => toText(index === 0 ? base + (cents - base * count) : base));
}

/**
 * Saídas de cada mês, montadas a partir dos gastos por categoria: a soma de cada categoria
 * e a quantidade de lançamentos batem com SAMPLE_SPENDING (os testes conferem).
 */
function spendingMovements(period: (typeof SAMPLE_PERIODS)[number]): SpendingMovement[] {
  const spending = SAMPLE_SPENDING[period];
  const groups = [
    ...spending.categories.map((category) => ({
      categoryId: category.categoryId as string | null,
      categoryName: category.name as string | null,
      amount: category.amount,
      count: category.count,
      names: DESCRIPTIONS[category.name] ?? [category.name],
      toReview: false,
    })),
    {
      categoryId: null,
      categoryName: null,
      amount: spending.toReview.amount,
      count: spending.toReview.count,
      names: REVIEW_DESCRIPTIONS,
      toReview: true,
    },
  ];
  let sequence = 0;
  const items = groups.flatMap((group, groupIndex) =>
    split(group.amount, group.count).map((amount, index) => {
      sequence += 1;
      const day = 1 + ((index * 7 + groupIndex * 3) % LAST_DAY[period]);
      return {
        transactionId: `b4d2c6e8-3f5a-4b7c-9e1d-${period.replace("-", "")}${String(sequence).padStart(6, "0")}`,
        date: `${period}-${String(day).padStart(2, "0")}`,
        description: group.names[index % group.names.length],
        amount,
        accountName: index % 3 === 2 ? "Cartão do dia a dia" : "Conta do dia a dia",
        categoryId: group.categoryId,
        categoryName: group.categoryName,
        toReview: group.toReview,
      };
    }),
  );
  // Mais recentes primeiro; no mesmo dia, o maior valor antes.
  return items.sort((a, b) => b.date.localeCompare(a.date) || Number(b.amount) - Number(a.amount));
}

export const SAMPLE_SPENDING_MOVEMENTS: Record<(typeof SAMPLE_PERIODS)[number], readonly SpendingMovement[]> = {
  "2026-10": spendingMovements("2026-10"),
  "2026-09": spendingMovements("2026-09"),
  "2026-08": spendingMovements("2026-08"),
};

/** Dias no gráfico do Disponível. */
export const DAILY_WINDOW = 30;

const DAY_MS = 24 * 60 * 60 * 1000;
const toDate = (iso: string) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
const toIso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const toCentsNumber = (value: string) => Number(value.replace(".", ""));
const fromCentsNumber = (cents: number) => `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;

/** Fechamentos conhecidos: fim de cada mês e, no mês corrente, o último dia com dados. */
const DAILY_ANCHORS = AVAILABLE_HISTORY.map((entry) => {
  const period = entry.month as (typeof SAMPLE_PERIODS)[number];
  const day = LAST_DAY[period] ?? new Date(Date.UTC(Number(entry.month.slice(0, 4)), Number(entry.month.slice(5, 7)), 0)).getUTCDate();
  return { ms: toDate(`${entry.month}-${String(day).padStart(2, "0")}`), cents: toCentsNumber(entry.available) };
});

/**
 * Disponível dia a dia, passando exatamente pelos fechamentos de mês: entre dois
 * fechamentos, a reta entre eles mais uma oscilação que some nas pontas (gastos no meio
 * do mês, entradas no começo). Os testes conferem que os fechamentos batem.
 */
function dailyAvailable(period: (typeof SAMPLE_PERIODS)[number]): DailyAvailable[] {
  const end = toDate(`${period}-${String(LAST_DAY[period]).padStart(2, "0")}`);
  return Array.from({ length: DAILY_WINDOW }, (_, index) => {
    const ms = end - (DAILY_WINDOW - 1 - index) * DAY_MS;
    const after = DAILY_ANCHORS.findIndex((anchor) => anchor.ms >= ms);
    const right = DAILY_ANCHORS[after];
    const left = DAILY_ANCHORS[Math.max(0, after - 1)];
    const t = right.ms === left.ms ? 1 : (ms - left.ms) / (right.ms - left.ms);
    const line = left.cents + (right.cents - left.cents) * t;
    const wave = -32000 * Math.sin(Math.PI * t) + 11000 * Math.sin(3 * Math.PI * t);
    return { date: toIso(ms), available: fromCentsNumber(Math.round(line + wave)) };
  });
}

export const SAMPLE_DAILY_AVAILABLE: Record<(typeof SAMPLE_PERIODS)[number], readonly DailyAvailable[]> = {
  "2026-10": dailyAvailable("2026-10"),
  "2026-09": dailyAvailable("2026-09"),
  "2026-08": dailyAvailable("2026-08"),
};

/** Dias da janela de 30 dias que termina na referência do período. */
function windowDates(period: (typeof SAMPLE_PERIODS)[number]): string[] {
  const end = toDate(`${period}-${String(LAST_DAY[period]).padStart(2, "0")}`);
  return Array.from({ length: DAILY_WINDOW }, (_, index) => toIso(end - (DAILY_WINDOW - 1 - index) * DAY_MS));
}

/** Entradas de exemplo: salário fictício no dia 5 e pequenas entradas; fecham com o fluxo do mês. */
const INFLOW_EVENTS: readonly { date: string; amount: string }[] = [
  { date: "2026-08-05", amount: "6800.00" },
  { date: "2026-09-05", amount: "6800.00" },
  { date: "2026-09-18", amount: "150.00" },
  { date: "2026-10-02", amount: "300.00" },
  { date: "2026-10-05", amount: "6800.00" },
];

function sumByDate(entries: readonly { date: string; amount: string }[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const entry of entries) totals.set(entry.date, (totals.get(entry.date) ?? 0) + toCentsNumber(entry.amount));
  return totals;
}

const OUTFLOW_BY_DATE = sumByDate(SAMPLE_PERIODS.flatMap((period) => SAMPLE_SPENDING_MOVEMENTS[period]));
const INFLOW_BY_DATE = sumByDate(INFLOW_EVENTS);

function dailyFlow(period: (typeof SAMPLE_PERIODS)[number], totals: Map<string, number>): DailyAmount[] {
  return windowDates(period).map((date) => ({ date, amount: fromCentsNumber(totals.get(date) ?? 0) }));
}

/** Entradas e saídas de cada dia na janela de 30 dias de cada período. */
export const SAMPLE_DAILY_FLOW: Record<
  "inflow" | "outflow",
  Record<(typeof SAMPLE_PERIODS)[number], readonly DailyAmount[]>
> = {
  inflow: {
    "2026-10": dailyFlow("2026-10", INFLOW_BY_DATE),
    "2026-09": dailyFlow("2026-09", INFLOW_BY_DATE),
    "2026-08": dailyFlow("2026-08", INFLOW_BY_DATE),
  },
  outflow: {
    "2026-10": dailyFlow("2026-10", OUTFLOW_BY_DATE),
    "2026-09": dailyFlow("2026-09", OUTFLOW_BY_DATE),
    "2026-08": dailyFlow("2026-08", OUTFLOW_BY_DATE),
  },
};
