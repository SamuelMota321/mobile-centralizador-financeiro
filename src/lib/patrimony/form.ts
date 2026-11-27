import { parseBrazilianDate } from "../civil-date";
import { parseMoneyInput } from "../money";
import { LIMITS, type InputByCollection, type PatrimonyCollection } from "./types";

// Validacao dos formularios de bens e dividas, pura e testavel. Os textos sao os da tela.

export type FieldErrors = Partial<Record<string, string>>;
export type FormValues = Record<string, string>;

export type ParseResult<C extends PatrimonyCollection> =
  | { ok: true; input: InputByCollection[C] }
  | { ok: false; errors: FieldErrors };

const ZERO = /^0+(?:[.,]0{1,2})?$/;

/**
 * Valor em pt-BR ("1.234,56", "1234,5", "0"). Diferente de `parseMoneyInput`, aceita zero:
 * o contrato HU-012 permite saldo e valor zerados. Negativo continua recusado.
 */
export function parseAmountInput(raw: string): string | null {
  const value = raw.trim().replace(/^R\$\s*/, "");
  if (ZERO.test(value)) return "0.00";
  return parseMoneyInput(value);
}

function text(values: FormValues, name: string): string {
  return (values[name] ?? "").trim();
}

function requiredText(values: FormValues, name: string, max: number, label: string, errors: FieldErrors): string {
  const value = text(values, name);
  if (value === "") errors[name] = `Informe ${label}.`;
  else if (value.length > max) errors[name] = `Use até ${max} caracteres.`;
  return value;
}

function amount(values: FormValues, name: string, label: string, errors: FieldErrors): string {
  const parsed = parseAmountInput(values[name] ?? "");
  if (parsed === null) errors[name] = `Informe ${label} em reais, como 1.250,00.`;
  return parsed ?? "";
}

export function parsePatrimonyForm<C extends PatrimonyCollection>(collection: C, values: FormValues): ParseResult<C> {
  const errors: FieldErrors = {};
  const description = requiredText(values, "description", LIMITS.description, "uma descrição", errors);

  let input: InputByCollection[PatrimonyCollection];
  if (collection === "assets") {
    const type = requiredText(values, "type", LIMITS.type, "o tipo do bem", errors);
    const estimatedValue = amount(values, "estimatedValue", "o valor estimado", errors);
    const valuationDate = parseBrazilianDate(values.valuationDate ?? "");
    if (valuationDate === null) errors.valuationDate = "Informe uma data válida no formato DD/MM/AAAA.";
    const source = requiredText(values, "source", LIMITS.source, "de onde veio o valor", errors);
    input = { type, description, estimatedValue, valuationDate: valuationDate ?? "", source };
  } else {
    const outstandingBalance = amount(values, "outstandingBalance", "o saldo devedor", errors);
    if (collection === "financings") {
      const raw = text(values, "assetId");
      const assetId = raw === "" ? null : /^[0-9a-f-]{36}$/i.test(raw) ? raw : undefined;
      if (assetId === undefined) errors.assetId = "Escolha um bem da lista ou “Sem bem associado”.";
      input = { description, outstandingBalance, assetId: assetId ?? null };
    } else {
      input = { description, outstandingBalance };
    }
  }

  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, input: input as InputByCollection[C] };
}

/** Só os campos que mudaram em relação ao estado atual; vazio quando nada mudou. */
export function changedFields<C extends PatrimonyCollection>(
  current: InputByCollection[C],
  next: InputByCollection[C],
): Partial<InputByCollection[C]> {
  const patch: Partial<InputByCollection[C]> = {};
  for (const key of Object.keys(next) as (keyof InputByCollection[C])[]) {
    if (next[key] !== current[key]) patch[key] = next[key];
  }
  return patch;
}
