import type { Account, AccountUpdateInput, ManualAccountInput } from "./types";

/**
 * Monta o corpo de PATCH somente com os campos alterados.
 * Saldo e data de referencia sao enviados juntos, como o contrato exige.
 * Retorna null quando nada mudou, para nao enviar PATCH vazio.
 */
export function buildAccountPatch(
  original: Account,
  next: ManualAccountInput,
): AccountUpdateInput | null {
  const patch: AccountUpdateInput = {};

  if (next.name !== original.name) patch.name = next.name;
  if (next.type !== original.type) patch.type = next.type;

  const nextInstitution = next.institutionName ?? null;
  if (nextInstitution !== original.institutionName) {
    patch.institutionName = nextInstitution;
  }

  if (
    !sameDecimal(next.initialBalance, original.initialBalance) ||
    next.initialBalanceAsOf !== original.initialBalanceAsOf
  ) {
    patch.initialBalance = next.initialBalance;
    patch.initialBalanceAsOf = next.initialBalanceAsOf;
  }

  return Object.keys(patch).length > 0 ? patch : null;
}

// Comparacao textual a duas casas: valores monetarios nunca passam por Number.
function sameDecimal(a: string, b: string): boolean {
  return canonicalDecimal(a) === canonicalDecimal(b);
}

function canonicalDecimal(value: string): string {
  const negative = value.startsWith("-");
  const [integer, fraction = ""] = (negative ? value.slice(1) : value).split(".");
  const cents = fraction.padEnd(2, "0");
  const isZero = /^0+$/.test(integer) && cents === "00";
  return `${negative && !isZero ? "-" : ""}${integer}.${cents}`;
}
