import { formatCivilDate } from "../lib/civil-date";
import type { ChipTone } from "../ui/controls";
import type {
  Allocation,
  AssetClass,
  Availability,
  CurrencyAllocation,
  ExclusionReason,
  Freshness,
  Portfolio,
  Position,
} from "../lib/investments/types";
import { valuationAge } from "./patrimony-presentation";

/** Posições por página no celular. */
export const INVESTMENTS_PAGE_SIZE = 10;

/** Campo que a fonte nao enviou: escrito como ausente, nunca como zero. */
export const ABSENT = "Não informado pela fonte";
export const CURRENCY_ABSENT = "Moeda não informada";
export const INSTITUTION_ABSENT = "Instituição não informada";

const CLASS_LABELS: Record<AssetClass, string> = {
  FIXED_INCOME: "Renda fixa",
  EQUITY: "Ações",
  ETF: "ETFs",
  MUTUAL_FUND: "Fundos",
  COE: "COE",
  SECURITY: "Valores mobiliários",
  UNCLASSIFIED: "Não classificado",
};

export function assetClassLabel(assetClass: AssetClass): string {
  return CLASS_LABELS[assetClass];
}

/**
 * Posição de cada classe na paleta de categorias do tema (0 a 5); a classe escrita ao lado é que
 * identifica. "Não classificado" não tem posição: usa a cor neutra.
 */
const CLASS_SLOTS: Record<AssetClass, number | null> = {
  FIXED_INCOME: 0,
  EQUITY: 1,
  ETF: 2,
  MUTUAL_FUND: 3,
  COE: 4,
  SECURITY: 5,
  UNCLASSIFIED: null,
};

export function assetClassColor(assetClass: AssetClass, palette: readonly string[], other: string): string {
  const slot = CLASS_SLOTS[assetClass];
  return slot === null ? other : (palette[slot] ?? other);
}

export function institutionLabel(name: string | null): string {
  return name ?? INSTITUTION_ABSENT;
}

const EXCLUSION_LABELS: Record<ExclusionReason, string> = {
  incomplete_or_stale: "coleta incompleta ou dados desatualizados",
  non_active: "posição que não está ativa",
  non_positive_balance: "saldo zerado ou negativo",
  unknown_currency: "moeda não informada",
};

export function exclusionLabel(reason: ExclusionReason): string {
  return EXCLUSION_LABELS[reason];
}

export function availabilityLabel(availability: Availability): string {
  if (availability === "complete") return "Dados completos";
  if (availability === "partial") return "Dados parciais";
  return "Dados indisponíveis";
}

export function availabilityTone(availability: Availability): ChipTone {
  if (availability === "complete") return "positive";
  if (availability === "partial") return "warning";
  return "neutral";
}

export function freshnessLabel(freshness: Freshness): string {
  if (freshness === "current") return "Atual";
  if (freshness === "stale") return "Desatualizado";
  return "Referência desconhecida";
}

export function freshnessTone(freshness: Freshness): ChipTone {
  return freshness === "current" ? "positive" : freshness === "stale" ? "warning" : "neutral";
}

/** Deslocamento fixo de Brasília (sem horário de verão desde 2019): evita `Intl` com fuso, que varia entre aparelhos. */
const BRASILIA_OFFSET_MS = 3 * 3_600_000;

function brasilia(date: Date): { year: number; month: string; day: string; hour: string; minute: string } {
  const shifted = new Date(date.getTime() - BRASILIA_OFFSET_MS);
  const pad = (value: number) => String(value).padStart(2, "0");
  return { year: shifted.getUTCFullYear(), month: pad(shifted.getUTCMonth() + 1), day: pad(shifted.getUTCDate()), hour: pad(shifted.getUTCHours()), minute: pad(shifted.getUTCMinutes()) };
}

/** "2026-11-22T13:00:00Z" -> "22/11 10:00" (horário de Brasília). Ausente vira texto explícito. */
export function formatReference(iso: string | null): string {
  if (!iso) return "Referência não informada";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Referência não informada";
  const parts = brasilia(date);
  return `${parts.day}/${parts.month} ${parts.hour}:${parts.minute}`;
}

/** Linha de metadados do Style Guide: `Origem · ref. DD/MM HH:MM`. */
export function metaLine(source: string, referenceDate: string | null): string {
  const origin = source === "pluggy" ? "Pluggy" : source;
  return referenceDate ? `${origin} · ref. ${formatReference(referenceDate)}` : `${origin} · ${formatReference(null).toLowerCase()}`;
}

function groupThousands(integer: string): string {
  return integer.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/**
 * "1234.5" + "BRL" -> "R$ 1.234,5"; outra moeda -> "USD 1.234,5". As casas vêm da fonte, sem
 * arredondar. Sem moeda, o valor sai com o aviso, nunca assumindo BRL.
 */
export function formatAmount(value: string, currencyCode: string | null): string {
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(value);
  if (!match) return value;
  const [, sign, integer, fraction] = match;
  const number = `${groupThousands(integer)}${fraction ? `,${fraction}` : ""}`;
  const prefix = currencyCode === "BRL" ? "R$" : currencyCode;
  if (!prefix) return `${sign === "-" ? "−" : ""}${number} (${CURRENCY_ABSENT.toLowerCase()})`;
  return `${sign === "-" ? "−" : ""}${prefix} ${number}`;
}

export function optionalAmount(value: string | null, currencyCode: string | null): string {
  return value === null ? ABSENT : formatAmount(value, currencyCode);
}

export function optionalText(value: string | null): string {
  return value === null || value === "" ? ABSENT : value;
}

/** Vencimento chega como data ou data e hora; só a data civil é exibida. */
export function formatMaturity(value: string | null): string {
  if (value === null) return ABSENT;
  const civil = /^\d{4}-\d{2}-\d{2}/.exec(value)?.[0];
  return civil ? formatCivilDate(civil) : value;
}

/** Taxa e tipo como a fonte enviou, juntos; nenhuma rentabilidade é calculada. */
export function rateText(position: Pick<Position, "rate" | "rateType" | "fixedAnnualRate">): string {
  const parts = [
    position.rate !== null ? `Taxa ${position.rate}${position.rateType ? ` (${position.rateType})` : ""}` : null,
    position.fixedAnnualRate !== null ? `Prefixada ${position.fixedAnnualRate}% ao ano` : null,
  ].filter((part): part is string => part !== null);
  return parts.length > 0 ? parts.join(" · ") : ABSENT;
}

/**
 * Explica por que o total está ausente. Só descreve o que o contrato permite concluir:
 * o backend não diz qual das causas ocorreu.
 */
export function totalNote(portfolio: Pick<Portfolio, "total" | "availability" | "totalsByCurrency">): string | null {
  if (portfolio.total !== null) return null;
  if (portfolio.totalsByCurrency.length > 1) {
    return "A carteira tem mais de uma moeda e o app não converte entre elas. Os totais ficam separados por moeda.";
  }
  if (portfolio.availability !== "complete") {
    return "A coleta está incompleta ou desatualizada, então não há um total seguro para exibir.";
  }
  return "Sem posição ativa com dados suficientes, não há total para exibir.";
}

/** Texto de cobertura da alocação, só com as contagens que o backend declara. */
export function coverageText(included: number, known: number): string {
  return `${included} de ${known} ${known === 1 ? "posição conhecida entra" : "posições conhecidas entram"} no cálculo.`;
}

/** "66.7" -> "66,7%": só troca o separador; o arredondamento é do backend. */
export function percentageText(percentage: string): string {
  return `${percentage.replace(".", ",")}%`;
}

/**
 * Origem e referência de um grupo da composição, a partir das posições que o formam.
 * Mostra a referência mais antiga (a que limita a leitura); se alguma falta, diz isso.
 */
export function groupMeta(members: readonly { source: string; referenceDate: string | null }[]): string {
  const count = `${members.length} ${members.length === 1 ? "posição" : "posições"}`;
  if (members.length === 0) return count;
  const origins = [...new Set(members.map((member) => (member.source === "pluggy" ? "Pluggy" : member.source)))].join(", ");
  const dates = members.map((member) => member.referenceDate);
  if (dates.some((date) => date === null)) return `${origins} · ${count} · referência ausente em parte`;
  const oldest = [...(dates as string[])].sort((a, b) => Date.parse(a) - Date.parse(b))[0];
  return `${origins} · ${count} · ref. mais antiga ${formatReference(oldest)}`;
}

// ---------- Faixa de resumo, composição por moeda e dados de cada posição ----------

/** Data civil (AAAA-MM-DD) de um instante, no calendário de Brasília; nunca a do aparelho. */
export function civilDateInSaoPaulo(date: Date): string {
  const parts = brasilia(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/**
 * Há quanto tempo é a referência: "hoje", "há 12 dias", "há 5 meses". null sem referência ou
 * com data inválida ou futura. Mesma regra de "avaliado há" em Bens e dívidas.
 */
export function referenceAge(referenceIso: string | null, now: Date): string | null {
  if (!referenceIso) return null;
  const date = new Date(referenceIso);
  if (Number.isNaN(date.getTime())) return null;
  return valuationAge(civilDateInSaoPaulo(date), civilDateInSaoPaulo(now));
}

/** Data da referência como "27/11/2025"; ausente vira texto explícito. */
export function referenceDay(referenceIso: string | null): string {
  if (!referenceIso) return "Referência não informada";
  const date = new Date(referenceIso);
  if (Number.isNaN(date.getTime())) return "Referência não informada";
  return formatCivilDate(civilDateInSaoPaulo(date));
}

export interface AvailabilityShare {
  total: number;
  complete: number;
  partial: number;
  unavailable: number;
  /** Percentuais inteiros por conexão; arredondados, podem não somar 100. */
  percent: { complete: number; partial: number; unavailable: number };
}

/** Disponibilidade contada por CONEXÃO: é o que a carteira informa para todas, não só para a página. */
export function availabilityShare(connections: readonly { availability: Availability }[]): AvailabilityShare {
  const count = (kind: Availability) => connections.filter((connection) => connection.availability === kind).length;
  const total = connections.length;
  const complete = count("complete");
  const partial = count("partial");
  const unavailable = count("unavailable");
  const pct = (value: number) => (total === 0 ? 0 : Math.round((value / total) * 100));
  return { total, complete, partial, unavailable, percent: { complete: pct(complete), partial: pct(partial), unavailable: pct(unavailable) } };
}

/** Classe de cada posição que entra na composição; as demais não têm classe conhecida pelo cliente. */
export function classByPosition(allocation: Allocation): Map<string, AssetClass> {
  const result = new Map<string, AssetClass>();
  for (const currency of allocation.currencies) {
    for (const group of currency.byClass) {
      for (const member of group.positions) result.set(member.id, group.assetClass);
    }
  }
  return result;
}

/** Moeda mostrada na composição: a pedida na URL, se existir; senão BRL, se houver; senão a primeira. */
export function selectedCurrency(allocation: Allocation, requested: string | null): CurrencyAllocation | null {
  const { currencies } = allocation;
  if (currencies.length === 0) return null;
  return (
    currencies.find((currency) => currency.currencyCode === requested) ??
    currencies.find((currency) => currency.currencyCode === "BRL") ??
    currencies[0]
  );
}

export interface PositionDataText {
  label: string;
  tone: ChipTone;
  /** Segunda linha opcional (ex.: a atualização quando os dados são parciais). */
  detail: string | null;
}

/**
 * O que a coluna "Dados" diz de uma posição. Indisponível vence tudo; parcial mostra a atualização
 * numa segunda linha; completo diz a data (atual) ou a idade (desatualizado).
 */
export function positionDataText(position: Pick<Position, "dataQuality" | "referenceDate">, now: Date): PositionDataText {
  const { availability, freshness } = position.dataQuality;
  const age = referenceAge(position.referenceDate, now);
  const freshnessText =
    freshness === "current"
      ? `Atualizado em ${referenceDay(position.referenceDate)}`
      : freshness === "stale"
        ? `Desatualizado${age ? ` · ${age}` : ""}`
        : "Referência desconhecida";
  if (availability === "unavailable") return { label: "Dados indisponíveis", tone: "neutral", detail: null };
  if (availability === "partial") return { label: "Dados parciais", tone: "warning", detail: freshnessText };
  return { label: freshnessText, tone: freshnessTone(freshness), detail: null };
}

/** Taxa para a coluna da tabela: um traço quando a fonte não enviou (o texto completo fica no detalhe). */
export function rateCell(position: Pick<Position, "rate" | "rateType" | "fixedAnnualRate">): string {
  return position.rate === null && position.fixedAnnualRate === null ? "—" : rateText(position);
}

export function resultCell(position: Pick<Position, "resultAmount" | "currencyCode">): string {
  return position.resultAmount === null ? "—" : formatAmount(position.resultAmount, position.currencyCode);
}

/** Texto do resultado, para o aviso temporário. */
export function refreshMessage(state: { total: number; requested: number; running: number; failed: number }): { tone: "success" | "info" | "warning"; text: string } {
  const { total, requested, running, failed } = state;
  if (total === 0) return { tone: "info", text: "Você ainda não tem conexões para atualizar." };
  const parts = [
    requested > 0 ? `${requested} ${requested === 1 ? "pedida" : "pedidas"}` : null,
    running > 0 ? `${running} já ${running === 1 ? "estava" : "estavam"} em andamento` : null,
    failed > 0 ? `${failed} não ${failed === 1 ? "pôde" : "puderam"} ser pedida${failed === 1 ? "" : "s"}` : null,
  ].filter(Boolean);
  const base = `Atualização das conexões: ${parts.join(", ")}.`;
  if (failed > 0) return { tone: "warning", text: `${base} Tente de novo para as que falharam.` };
  return { tone: "success", text: `${base} Os dados novos podem levar alguns minutos.` };
}
