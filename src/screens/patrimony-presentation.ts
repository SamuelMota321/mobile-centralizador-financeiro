import { formatCivilDate } from "../lib/civil-date";
import { formatMoney } from "../lib/money";
import type { Asset, InputByCollection, PatrimonyCollection, PatrimonyItem } from "../lib/patrimony/types";

/** Itens por página, em cada seção. */
export const PATRIMONY_PAGE_SIZE = 10;

export const SECTIONS = {
  assets: {
    title: "Bens",
    create: "Novo bem",
    submit: "Registrar bem",
    created: "Bem registrado.",
    empty: "Nenhum bem cadastrado. Registre imóveis, veículos ou outros bens com o valor que você estima.",
  },
  financings: {
    title: "Financiamentos",
    create: "Novo financiamento",
    submit: "Registrar financiamento",
    created: "Financiamento registrado.",
    empty: "Nenhum financiamento cadastrado. Um financiamento pode ficar associado ao bem que ele pagou.",
  },
  liabilities: {
    title: "Outras dívidas",
    create: "Nova dívida",
    submit: "Registrar dívida",
    created: "Dívida registrada.",
    empty: "Nenhuma outra dívida cadastrada, como empréstimos ou parcelamentos.",
  },
} as const satisfies Record<PatrimonyCollection, { title: string; create: string; submit: string; created: string; empty: string }>;

export const ASSET_UNAVAILABLE = "Bem indisponível";
export const NO_ASSET = "Sem bem associado";

/** Bem do financiamento pela descrição, nunca pelo UUID. */
export function assetLabel(assetId: string | null, assets: readonly Pick<Asset, "id" | "description">[] | null): string {
  if (assetId === null) return NO_ASSET;
  return assets?.find((asset) => asset.id === assetId)?.description ?? ASSET_UNAVAILABLE;
}

export function amountText(value: string): string {
  return formatMoney(value);
}

export function assetDateText(valuationDate: string): string {
  return formatCivilDate(valuationDate);
}

/** Meses inteiros entre duas datas civis (AAAA-MM-DD); negativo se `to` for anterior a `from`. */
function wholeMonths(from: string, to: string): number {
  const [y1, m1, d1] = from.split("-").map(Number);
  const [y2, m2, d2] = to.split("-").map(Number);
  return (y2 - y1) * 12 + (m2 - m1) - (d2 < d1 ? 1 : 0);
}

function daysBetween(from: string, to: string): number {
  const [y1, m1, d1] = from.split("-").map(Number);
  const [y2, m2, d2] = to.split("-").map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000);
}

/**
 * Há quanto tempo o valor foi avaliado: "hoje", "há 12 dias", "há 5 meses", "há 2 anos" (anos só a
 * partir de 24 meses). Sinal honesto de que o valor pode estar velho; calculado só da data da
 * avaliação. Data futura não tem texto. Mesma regra do web.
 */
export function valuationAge(valuationDate: string, today: string): string | null {
  const days = daysBetween(valuationDate, today);
  if (days < 0) return null;
  if (days === 0) return "hoje";
  const months = wholeMonths(valuationDate, today);
  if (months < 1) return days === 1 ? "há 1 dia" : `há ${days} dias`;
  if (months < 24) return months === 1 ? "há 1 mês" : `há ${months} meses`;
  return `há ${Math.floor(months / 12)} anos`;
}

/**
 * Momento de uma versão no horário de Brasília: "20/11/2026 12:00". Brasília é UTC-3 o ano todo
 * (sem horário de verão desde 2019), então não depende de `Intl` com fuso, que varia entre aparelhos.
 */
export function formatStamp(iso: string): string {
  const shifted = new Date(new Date(iso).getTime() - 3 * 3_600_000);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(shifted.getUTCDate())}/${pad(shifted.getUTCMonth() + 1)}/${shifted.getUTCFullYear()} ${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}`;
}

/** Campos editáveis de um item, no formato que a API devolve e recebe. */
export function editableState(item: PatrimonyItem): InputByCollection[PatrimonyCollection] {
  if (item.kind === "asset") {
    return { type: item.type, description: item.description, estimatedValue: item.estimatedValue, valuationDate: item.valuationDate, source: item.source };
  }
  if (item.kind === "financing") return { description: item.description, outstandingBalance: item.outstandingBalance, assetId: item.assetId };
  return { description: item.description, outstandingBalance: item.outstandingBalance };
}

/** Valores iniciais do formulário, como texto: valor com vírgula e data DD/MM/AAAA. */
export function formValuesFromItem(item?: PatrimonyItem): Record<string, string> {
  if (!item) return {};
  const values: Record<string, string> = { description: item.description };
  if (item.kind === "asset") {
    Object.assign(values, {
      type: item.type,
      estimatedValue: item.estimatedValue.replace(".", ","),
      valuationDate: formatCivilDate(item.valuationDate),
      source: item.source,
    });
  } else {
    values.outstandingBalance = item.outstandingBalance.replace(".", ",");
    if (item.kind === "financing") values.assetId = item.assetId ?? "";
  }
  return values;
}

/** Fatos de uma versão gravada, na ordem da tela. */
export function stateFacts(
  collection: PatrimonyCollection,
  state: InputByCollection[PatrimonyCollection],
  assets: readonly Pick<Asset, "id" | "description">[] | null,
): [string, string][] {
  if (collection === "assets") {
    const asset = state as InputByCollection["assets"];
    return [
      ["Tipo", asset.type],
      ["Descrição", asset.description],
      ["Valor estimado", amountText(asset.estimatedValue)],
      ["Data da avaliação", formatCivilDate(asset.valuationDate)],
      ["Fonte informada", asset.source],
    ];
  }
  const debt = state as InputByCollection["financings"];
  const facts: [string, string][] = [
    ["Descrição", debt.description],
    ["Saldo devedor", amountText(debt.outstandingBalance)],
  ];
  if (collection === "financings") facts.push(["Bem associado", assetLabel(debt.assetId ?? null, assets)]);
  return facts;
}
