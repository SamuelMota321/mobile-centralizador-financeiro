import { formatCivilDate } from "../civil-date";
import { formatMoney } from "../money";
import { donutItems, toCents, type DonutItem } from "./chart-model";
import { REVIEW_FILTER } from "./source";
import { SAMPLE_CATEGORY_ORDER } from "./fixtures";
import type {
  AccountBalance,
  BalanceSource,
  BalancesSummary,
  Freshness,
  RecentMovement,
  SpendingSummary,
} from "./types";

const MONTH_NAMES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

function parseMonth(month: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) throw new RangeError(`Mês fora do formato AAAA-MM: "${month}"`);
  const index = Number(match[2]) - 1;
  if (index < 0 || index > 11) throw new RangeError(`Mês inválido: "${month}"`);
  return { year: match[1], name: MONTH_NAMES[index] };
}

/** "2026-10" -> "outubro de 2026". */
export function monthName(month: string): string {
  const { year, name } = parseMonth(month);
  return `${name} de ${year}`;
}

/** "abril a outubro de 2026"; anos diferentes: "novembro de 2025 a março de 2026"; um mês só: "março de 2026". */
export function monthRange(first: string, last: string): string {
  if (first === last) return monthName(first);
  const start = parseMonth(first);
  const end = monthName(last);
  return start.year === parseMonth(last).year ? `${start.name} a ${end}` : `${monthName(first)} a ${end}`;
}

/** "2026-10" -> "out". */
export function monthShort(month: string): string {
  return parseMonth(month).name.slice(0, 3);
}

/** "2026-10" -> "Outubro de 2026". */
export function periodTitle(month: string): string {
  const name = monthName(month);
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export const SOURCE_LABELS: Record<BalanceSource, string> = {
  manual: "Manual",
  ofx: "OFX",
  pluggy: "Conectada",
};

const reference = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});

/** "2026-10-05T09:12:00-03:00" -> "05/10, 09:12" no horário de Brasília. */
export function formatReference(iso: string): string {
  return reference.format(new Date(iso));
}

/** Atualizado não ganha marcador (a data basta); só o que pede atenção. */
export function freshnessChip(freshness: Freshness): { tone: "warning" | "neutral"; label: string } | null {
  if (freshness === "stale") return { tone: "warning", label: "Desatualizada" };
  if (freshness === "unavailable") return { tone: "neutral", label: "Indisponível" };
  return null;
}

/** Cartões em grupo próprio, fora do Disponível (D-03). */
export function splitAccounts(accounts: readonly AccountBalance[]) {
  return {
    accounts: accounts.filter((account) => account.type !== "credit_card"),
    cards: accounts.filter((account) => account.type === "credit_card"),
  };
}

/** A cor segue a posição estável da categoria, independente do mês escolhido. */
export function toDonutItems(
  spending: SpendingSummary,
  palette: readonly string[],
  neutralColor: string,
): DonutItem[] {
  const items = spending.categories.map<DonutItem>((category) => ({
    id: category.categoryId,
    label: category.archived ? category.name + " (arquivada)" : category.name,
    value: category.amount,
    color: palette[SAMPLE_CATEGORY_ORDER.indexOf(category.categoryId)] ?? neutralColor,
  }));
  if (spending.toReview.amount !== "0.00") {
    items.push({
      id: REVIEW_FILTER,
      label: "A revisar",
      value: spending.toReview.amount,
      color: neutralColor,
      review: true,
    });
  }
  return donutItems(items, neutralColor);
}

const TWO_THOUSAND = BigInt(2000);
const TWO = BigInt(2);
const TEN = BigInt(10);

/**
 * "↑ 4,3% vs. setembro": variação sobre o mês anterior, uma casa, meio para cima, calculada
 * em centavos. Sem base positiva não há percentual que faça sentido: null.
 */
export function formatChange(current: string, previous: string, previousMonth: string): string | null {
  const now = toCents(current);
  const before = toCents(previous);
  if (before <= BigInt(0)) return null;
  const month = monthName(previousMonth).split(" ")[0];
  const diff = now - before;
  if (diff === BigInt(0)) return `Igual a ${month}`;
  const magnitude = diff < BigInt(0) ? -diff : diff;
  const tenths = (magnitude * TWO_THOUSAND + before) / (TWO * before);
  return `${diff > BigInt(0) ? "↑" : "↓"} ${tenths / TEN},${tenths % TEN}% vs. ${month}`;
}

/** Aceita uma data civil ou a data de referência com hora e fuso da prévia. */
export function formatDay(date: string): string {
  return formatCivilDate(date.slice(0, 10)).slice(0, 5);
}

export interface AttentionItem {
  id: string;
  /** review: hachurado em atenção; warning: marcador de atenção; info: marcador informativo. */
  tone: "review" | "warning" | "info";
  title: string;
  text: string;
  action: { label: string; section: "contas" | "movimentacoes" };
}

const STALE_ACTION: Record<BalanceSource, { label: string; section: "contas" | "movimentacoes" }> = {
  ofx: { label: "Importar extrato OFX", section: "contas" },
  pluggy: { label: "Ver conexão", section: "contas" },
  manual: { label: "Atualizar conta", section: "contas" },
};

/**
 * "Pede sua atenção": só fatos que já estão nas agregações, cada um com a ação que o
 * resolve. Nunca recomendação financeira (RN-017).
 */
export function attentionItems(balances: BalancesSummary, spending: SpendingSummary): AttentionItem[] {
  const items: AttentionItem[] = [];
  if (spending.toReview.amount !== "0.00") {
    const { count, amount } = spending.toReview;
    items.push({
      id: "a-revisar",
      tone: "review",
      title: `${count} ${count === 1 ? "saída sem categoria segura" : "saídas sem categoria segura"} · ${formatMoney(amount)}`,
      text: "Ficam em “A revisar” até você confirmar a categoria.",
      action: { label: "Categorizar", section: "movimentacoes" },
    });
  }
  for (const account of balances.accounts) {
    if (account.freshness === "stale") {
      items.push({
        id: `desatualizada-${account.accountId}`,
        tone: "warning",
        title: `${account.name} com referência de ${formatDay(account.asOf)}`,
        text:
          account.type === "credit_card"
            ? "O saldo do cartão aparece com essa referência."
            : "O saldo dela entra no Disponível com essa referência.",
        action: STALE_ACTION[account.source],
      });
    }
  }
  for (const card of splitAccounts(balances.accounts).cards) {
    items.push({
      id: `cartao-${card.accountId}`,
      tone: "info",
      title: `${card.name}: ${formatMoney(card.balance)}`,
      text: "Fica fora do Disponível, em grupo próprio.",
      action: { label: "Ver contas", section: "contas" },
    });
  }
  return items;
}

export function movementCategory(movement: Pick<RecentMovement, "toReview" | "direction" | "categoryName">): string {
  if (movement.toReview) return "A revisar";
  if (movement.direction === "transfer") return "Transferência";
  return movement.categoryName ?? "Sem categoria";
}

/** "Saídas de outubro de 2026" ou, com filtro, "Saídas de Moradia em outubro de 2026". */
export function movementsTitle(period: string, categoryLabel: string | null): string {
  return categoryLabel ? `Saídas de ${categoryLabel} em ${monthName(period)}` : `Saídas de ${monthName(period)}`;
}

/** "1–6 de 34". */
export function pageRange(page: number, pageSize: number, total: number): string {
  if (total === 0) return "Nenhuma saída";
  const start = (page - 1) * pageSize + 1;
  return `${start}–${Math.min(page * pageSize, total)} de ${total}`;
}
