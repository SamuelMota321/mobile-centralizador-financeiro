// Valores monetarios trafegam como string decimal exata ("1234.56"). Nada aqui usa
// Number/parseFloat: a conversao e textual para nao introduzir erro de ponto flutuante.

/** numeric(19,2) no backend: ate 17 digitos inteiros. */
const MAX_INTEGER_DIGITS = 17;

// "1.234,56", "1234,56", "1.234", "1234": virgula decimal, ponto como milhar.
const COMMA_DECIMAL = /^(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?$/;
// "1234.56", "12.5": ponto decimal com ate duas casas.
const DOT_DECIMAL = /^(\d+)\.(\d{1,2})$/;

/**
 * Normaliza um valor positivo digitado em pt-BR para a string do contrato.
 * Retorna null para vazio, zero, negativo, mais de duas casas, mais de 17 digitos
 * inteiros ou formato ambiguo/invalido.
 */
export function parseMoneyInput(raw: string): string | null {
  const value = raw.trim().replace(/^R\$\s*/, "");
  const match = COMMA_DECIMAL.exec(value) ?? DOT_DECIMAL.exec(value);
  if (!match) return null;

  const integer = match[1].replace(/\./g, "").replace(/^0+(?=\d)/, "");
  const fraction = (match[2] ?? "").padEnd(2, "0");
  if (integer.length > MAX_INTEGER_DIGITS) return null;
  if (/^0+$/.test(integer) && fraction === "00") return null;

  return `${integer}.${fraction}`;
}

/** "1234.56" -> "R$ 1.234,56"; "-10.00" -> "-R$ 10,00". Valores fora do formato voltam intactos. */
export function formatMoney(value: string): string {
  const match = /^(-?)(\d+)\.(\d{2})$/.exec(value);
  if (!match) return value;
  const [, sign, integer, cents] = match;
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${sign}R$ ${grouped},${cents}`;
}
