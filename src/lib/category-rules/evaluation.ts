// Cópia, no cliente, da avaliação de regras do backend (@ backend 2c9bf9f; cópia da versão do web):
// - `CategoryRule.matches` e `normalizeForComparison` em domain/category-rule.ts;
// - `findActiveForEvaluation` (prioridade desc, criação asc, id asc; só regras ativas de
//   categorias ativas) e o `.find` de create-manual-transaction.ts (vale a primeira).
// Serve só para explicar e simular: quem categoriza de verdade é o servidor. Se o backend
// mudar, os casos de evaluation.test.ts (os mesmos do category-rule.spec.ts) precisam mudar junto.

import type { CategoryRule, RuleConditionField } from "./types";

export type EvaluableRule = Pick<
  CategoryRule,
  "id" | "categoryId" | "conditionField" | "conditionOperator" | "conditionValue" | "priority" | "status" | "createdAt"
>;

/** O que o simulador sabe de um lançamento novo, como o backend recebe na criação manual. */
export interface SimulatedTransaction {
  description: string | null;
  type: "income" | "expense";
  accountId: string | null;
}

/** Igual ao backend: espaços colapsados, sem bordas, minúsculas. Acentos continuam diferentes. */
export function normalizeForComparison(value: string): string {
  return value.replace(/\s+/gu, " ").trim().toLowerCase();
}

/** Igual a `normalizeDescription` do backend: vazio vira null. */
export function normalizeDescription(value: string | null | undefined): string | null {
  const normalized = value?.replace(/\s+/gu, " ").trim() ?? "";
  return normalized === "" ? null : normalized;
}

/** Ordem de avaliação do backend: maior prioridade, depois a mais antiga, depois o id. */
export function compareRules(a: EvaluableRule, b: EvaluableRule): number {
  if (a.priority !== b.priority) return b.priority - a.priority;
  const created = Date.parse(a.createdAt) - Date.parse(b.createdAt);
  if (created !== 0) return created;
  const left = a.id.toLowerCase();
  const right = b.id.toLowerCase();
  return left < right ? -1 : left > right ? 1 : 0;
}

function candidateFor(field: RuleConditionField, transaction: SimulatedTransaction): string | null {
  if (field === "description") return normalizeDescription(transaction.description);
  if (field === "type") return transaction.type;
  return transaction.accountId;
}

/** Só a condição, sem olhar o status: o status é tratado em `simulate`. */
export function conditionMatches(rule: EvaluableRule, transaction: SimulatedTransaction): boolean {
  const candidate = candidateFor(rule.conditionField, transaction);
  if (candidate === null) return false;
  const left = normalizeForComparison(candidate);
  const right = normalizeForComparison(rule.conditionValue);
  switch (rule.conditionOperator) {
    case "equals":
      return left === right;
    case "contains":
      return left.includes(right);
    case "starts_with":
      return left.startsWith(right);
    case "ends_with":
      return left.endsWith(right);
  }
}

/** A regra entra na fila do backend: ativa e com a categoria ativa. */
export function isEvaluated(rule: EvaluableRule, activeCategoryIds: ReadonlySet<string>): boolean {
  return rule.status === "active" && activeCategoryIds.has(rule.categoryId.toLowerCase());
}

/**
 * Posição de cada regra na fila real de aplicação (1 = avaliada primeiro). Regras fora da fila
 * (inativas, removidas, de categoria arquivada) não têm posição. `tiedWith` aponta a posição
 * anterior quando a prioridade empata: aí vale a mais antiga.
 */
export function applicationQueue(
  rules: readonly EvaluableRule[],
  activeCategoryIds: ReadonlySet<string>,
): { position: Map<string, number>; tiedWith: Map<string, number>; size: number } {
  const queue = rules.filter((rule) => isEvaluated(rule, activeCategoryIds)).sort(compareRules);
  const position = new Map<string, number>();
  const tiedWith = new Map<string, number>();
  queue.forEach((rule, index) => {
    position.set(rule.id, index + 1);
    if (index > 0 && queue[index - 1].priority === rule.priority) tiedWith.set(rule.id, index);
  });
  return { position, tiedWith, size: queue.length };
}

export type MatchOutcome =
  /** Primeira da fila que combina: define a categoria. */
  | "aplica"
  /** Combina, mas uma regra anterior na fila já decidiu. */
  | "perde"
  /** Combinaria, mas está inativa. */
  | "inativa"
  /** Combinaria, mas a categoria está arquivada ou não foi encontrada. */
  | "categoria-arquivada";

export interface SimulationMatch<R extends EvaluableRule> {
  rule: R;
  outcome: MatchOutcome;
}

/**
 * Simula a criação manual de um lançamento: todas as regras não removidas cuja condição
 * combina, na ordem do backend, com o papel de cada uma. `winner` é a que categorizaria.
 */
export function simulate<R extends EvaluableRule>(
  rules: readonly R[],
  activeCategoryIds: ReadonlySet<string>,
  transaction: SimulatedTransaction,
): { winner: R | null; matches: SimulationMatch<R>[] } {
  let winner: R | null = null;
  const matches: SimulationMatch<R>[] = [];
  for (const rule of [...rules].filter((item) => item.status !== "removed").sort(compareRules)) {
    if (!conditionMatches(rule, transaction)) continue;
    if (rule.status !== "active") matches.push({ rule, outcome: "inativa" });
    else if (!activeCategoryIds.has(rule.categoryId.toLowerCase())) matches.push({ rule, outcome: "categoria-arquivada" });
    else if (winner) matches.push({ rule, outcome: "perde" });
    else {
      winner = rule;
      matches.push({ rule, outcome: "aplica" });
    }
  }
  return { winner, matches };
}

/**
 * Trecho da descrição (já normalizada para exibição) que a regra de descrição reconhece, para
 * destacar. null quando não há trecho, ou quando minúsculas mudariam o tamanho do texto.
 */
export function matchRange(description: string, rule: Pick<EvaluableRule, "conditionField" | "conditionOperator" | "conditionValue">): [number, number] | null {
  if (rule.conditionField !== "description") return null;
  const shown = normalizeDescription(description);
  if (!shown) return null;
  const lower = shown.toLowerCase();
  const value = normalizeForComparison(rule.conditionValue);
  if (lower.length !== shown.length || value.length === 0) return null;
  switch (rule.conditionOperator) {
    case "equals":
      return lower === value ? [0, shown.length] : null;
    case "starts_with":
      return lower.startsWith(value) ? [0, value.length] : null;
    case "ends_with":
      return lower.endsWith(value) ? [shown.length - value.length, shown.length] : null;
    case "contains": {
      const start = lower.indexOf(value);
      return start >= 0 ? [start, start + value.length] : null;
    }
  }
}
