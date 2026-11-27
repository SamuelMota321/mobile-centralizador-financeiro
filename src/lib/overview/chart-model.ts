// Valores chegam como string decimal exata ("1234.56"), como no contrato da API. O que
// vira texto (percentual) é calculado em centavos com BigInt; Number só entra na
// geometria, onde a imprecisão some no arredondamento para pixel.

const DECIMAL = /^(-?)(\d+)\.(\d{2})$/;
// O tsconfig mira abaixo de ES2020, sem literais BigInt (0n).
const ZERO = BigInt(0);
const TWO = BigInt(2);
const TEN = BigInt(10);
const PER_MILLE_TWICE = BigInt(2000);

export function toCents(value: string): bigint {
  const match = DECIMAL.exec(value);
  if (!match) throw new RangeError(`Valor fora do formato decimal: "${value}"`);
  const cents = BigInt(match[2] + match[3]);
  return match[1] ? -cents : cents;
}

/** Valor em reais como número, só para escalas e posições. */
export function toGeometry(value: string): number {
  return Number(toCents(value)) / 100;
}

/**
 * "41,9%": parte sobre o total com uma casa, meio para cima (D-12). Sem ajuste para
 * fechar 100%. Total zero não tem percentual: retorna null.
 */
export function formatShare(part: string, total: string): string | null {
  const partCents = toCents(part);
  const totalCents = toCents(total);
  if (partCents < ZERO) throw new RangeError(`Parte negativa: "${part}"`);
  if (totalCents <= ZERO) return null;
  const tenths = (partCents * PER_MILLE_TWICE + totalCents) / (TWO * totalCents);
  return `${tenths / TEN},${tenths % TEN}%`;
}

/** Do maior para o menor; empate mantém a ordem recebida. */
function rankByValue<T extends { value: string }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => {
    const diff = toCents(b.value) - toCents(a.value);
    return diff > ZERO ? 1 : diff < ZERO ? -1 : 0;
  });
}

export function fromCents(cents: bigint): string {
  const negative = cents < ZERO;
  const digits = (negative ? -cents : cents).toString().padStart(3, "0");
  return `${negative ? "-" : ""}${digits.slice(0, -2)}.${digits.slice(-2)}`;
}

function sumValues(values: readonly string[]): string {
  return fromCents(values.reduce((total, value) => total + toCents(value), ZERO));
}

/* ---------- Rosca ---------- */

export interface DonutItem {
  id: string;
  label: string;
  value: string;
  /** Cor da categoria na paleta do app. */
  color: string;
  /** "A revisar": sempre a última fatia, nunca agrupado. */
  review?: boolean;
}

/** Fatias além desta quantidade (sem contar "A revisar") viram "Outras". */
export const DONUT_MAX_SLICES = 6;
export const DONUT_OTHER_ID = "outras";

/**
 * Ordena do maior para o menor e junta o excedente em "Outras" (neutra), para a rosca
 * não passar de seis fatias com cor; "A revisar" fica no fim, sempre separado.
 */
export function donutItems(items: readonly DonutItem[], otherColor: string): DonutItem[] {
  const regular = rankByValue(items.filter((item) => !item.review));
  const review = items.filter((item) => item.review);
  if (regular.length <= DONUT_MAX_SLICES) return [...regular, ...review];
  const kept = regular.slice(0, DONUT_MAX_SLICES - 1);
  const rest = regular.slice(DONUT_MAX_SLICES - 1);
  const other: DonutItem = {
    id: DONUT_OTHER_ID,
    label: `Outras (${rest.length})`,
    value: sumValues(rest.map((item) => item.value)),
    color: otherColor,
  };
  return [...kept, other, ...review];
}

export interface DonutArc {
  id: string;
  /** Comprimento visível do traço, já descontado o espaço entre fatias. */
  length: number;
  /** Onde a fatia começa no contorno (a partir do topo, sentido horário). */
  start: number;
}

/** Espaço entre fatias, em px de contorno: a superfície aparece entre as cores. */
export const DONUT_GAP = 2;

export function donutArcs(items: readonly DonutItem[], total: string, circumference: number): DonutArc[] {
  const totalCents = toCents(total);
  if (totalCents <= ZERO) return items.map((item) => ({ id: item.id, length: 0, start: 0 }));
  const gap = items.length > 1 ? DONUT_GAP : 0;
  let start = 0;
  return items.map((item) => {
    const span = (Number(toCents(item.value)) / Number(totalCents)) * circumference;
    const arc = { id: item.id, length: Math.max(0, span - gap), start };
    start += span;
    return arc;
  });
}
