// Largura das barras da composicao: sempre os valores exatos `amount` e `denominatorAmount`
// (HU-011), em inteiros BigInt, nunca o percentual arredondado e nunca ponto flutuante.

function scaledParts(value: string): { digits: bigint; scale: number } | null {
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(value);
  if (!match) return null;
  const [, sign, integer, fraction = ""] = match;
  const digits = BigInt(`${integer}${fraction}`);
  return { digits: sign === "-" ? -digits : digits, scale: fraction.length };
}

/** Potencia de dez sem `**` em BigInt (alvo de compilacao anterior a ES2020). */
function pow10(exponent: number): bigint {
  let result = BigInt(1);
  const ten = BigInt(10);
  for (let index = 0; index < exponent; index += 1) result *= ten;
  return result;
}

/**
 * Fracao `amount / denominator` em pontos-base (0 a 10000), truncada para baixo.
 * Valor invalido, denominador nao positivo ou valor negativo viram 0; acima do todo, 10000.
 */
export function shareBasisPoints(amount: string, denominator: string): number {
  const a = scaledParts(amount);
  const d = scaledParts(denominator);
  if (!a || !d || d.digits <= BigInt(0) || a.digits <= BigInt(0)) return 0;
  const scale = Math.max(a.scale, d.scale);
  const numerator = a.digits * pow10(scale - a.scale);
  const base = d.digits * pow10(scale - d.scale);
  const points = (numerator * BigInt(10000)) / base;
  return points > BigInt(10000) ? 10000 : Number(points);
}

/** Largura CSS ("37.5%") para a barra; duas casas bastam para o pixel. */
export function shareWidth(amount: string, denominator: string): string {
  return `${(shareBasisPoints(amount, denominator) / 100).toFixed(2)}%`;
}
