import { isUnauthorized } from "../lib/accounts/messages";
import { PROBLEM_CODES, ProblemDetailsError } from "../lib/api/errors";

/** Períodos oferecidos ao aplicar uma regra: os últimos N meses, incluindo o atual. */
export const APPLY_PRESETS = [
  { value: "1", months: 1, label: "Este mês" },
  { value: "3", months: 3, label: "Últimos 3 meses" },
  { value: "6", months: 6, label: "Últimos 6 meses" },
  { value: "12", months: 12, label: "Últimos 12 meses" },
  { value: "24", months: 24, label: "Últimos 24 meses" },
] as const;

export type ApplyPresetValue = (typeof APPLY_PRESETS)[number]["value"];
export const DEFAULT_APPLY_PRESET: ApplyPresetValue = "3";

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/**
 * Datas civis (AAAA-MM-DD, inclusive) dos últimos `months` meses: do primeiro dia do mês mais
 * antigo ao último dia do mês atual. O calendário é o do aparelho, o mesmo que a pessoa vê.
 */
export function presetPeriod(months: number, now: Date = new Date()): { from: string; to: string } {
  const start = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return {
    from: `${start.getFullYear()}-${pad(start.getMonth() + 1)}-01`,
    to: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(lastDay)}`,
  };
}

/** Frase do resultado de aplicar uma regra. */
export function applicationMessage(result: { examined: number; categorized: number; truncated: boolean }): string {
  if (result.categorized === 0) {
    return result.examined === 0
      ? "Não há movimentações sem classificação nesse período."
      : "Nenhuma das movimentações sem classificação nesse período combina com esta regra.";
  }
  const noun = result.categorized === 1 ? "movimentação foi categorizada" : "movimentações foram categorizadas";
  const base = `${result.categorized} ${noun}.`;
  return result.truncated ? `${base} O período é grande: aplique de novo para continuar de onde parou.` : base;
}

export type ApplyFailure =
  | { kind: "unauthorized" }
  /** Regra ou categoria indisponível: volta para a lista, que recarrega. */
  | { kind: "stale"; message: string }
  | { kind: "message"; message: string };

export function classifyApplyError(error: unknown): ApplyFailure {
  if (isUnauthorized(error)) return { kind: "unauthorized" };
  if (error instanceof ProblemDetailsError) {
    if (error.code === PROBLEM_CODES.categoryRuleNotFound) {
      return { kind: "stale", message: "A regra não foi encontrada. A lista foi atualizada." };
    }
    if (error.status === 409) {
      return { kind: "stale", message: "A regra ou a categoria dela não está disponível. Reative a regra e confira a categoria." };
    }
  }
  return { kind: "message", message: "Não foi possível aplicar a regra. Nada foi perdido: tente de novo." };
}
