import type { z } from "zod";
import { isUnauthorized } from "../lib/accounts/messages";
import { PROBLEM_CODES, ProblemDetailsError } from "../lib/api/errors";
import { categoryRuleInputSchema } from "../lib/category-rules/schema";
import {
  OPERATORS_BY_FIELD,
  type CategoryRule,
  type CategoryRuleInput,
  type CategoryRuleUpdate,
  type RuleConditionField,
  type RuleOperator,
  type RuleStatus,
} from "../lib/category-rules/types";

export const FIELD_LABELS: Record<RuleConditionField, string> = {
  description: "Descrição",
  type: "Tipo",
  accountId: "Conta",
};

/** Sujeito da frase: "Se a descrição…", "Se o tipo…", "Se a conta…". */
const FIELD_SUBJECTS: Record<RuleConditionField, string> = {
  description: "a descrição",
  type: "o tipo",
  accountId: "a conta",
};

export const OPERATOR_LABELS: Record<RuleOperator, string> = {
  equals: "é igual a",
  contains: "contém",
  starts_with: "começa com",
  ends_with: "termina com",
};

export const STATUS_LABELS: Record<RuleStatus, string> = {
  active: "Ativa",
  inactive: "Inativa",
  removed: "Removida",
};

export const TYPE_VALUE_LABELS: Record<string, string> = {
  income: "Receita",
  expense: "Despesa",
};

export interface NamedOption {
  id: string;
  name: string;
}

export interface CategoryOption extends NamedOption {
  status: "active" | "archived";
}

export const ACCOUNT_FALLBACK = "Conta indisponível";
export const CATEGORY_FALLBACK = "Categoria indisponível";

function findById<T extends NamedOption>(items: T[] | null, id: string): T | undefined {
  const target = id.toLowerCase();
  return items?.find((item) => item.id.toLowerCase() === target);
}

export function operatorsFor(field: RuleConditionField): readonly RuleOperator[] {
  return OPERATORS_BY_FIELD[field];
}

/** Valor da condição legível; nunca um UUID cru. */
export function conditionValueLabel(
  rule: Pick<CategoryRule, "conditionField" | "conditionValue">,
  accounts: NamedOption[] | null,
): string {
  switch (rule.conditionField) {
    case "description":
      return `“${rule.conditionValue}”`;
    case "type":
      return TYPE_VALUE_LABELS[rule.conditionValue.toLowerCase()] ?? rule.conditionValue;
    case "accountId":
      return findById(accounts, rule.conditionValue)?.name ?? ACCOUNT_FALLBACK;
  }
}

export function ruleCondition(
  rule: Pick<CategoryRule, "conditionField" | "conditionOperator" | "conditionValue">,
  accounts: NamedOption[] | null,
): string {
  return `Se ${FIELD_SUBJECTS[rule.conditionField]} ${OPERATOR_LABELS[rule.conditionOperator]} ${conditionValueLabel(rule, accounts)}`;
}

export function ruleCategory(
  rule: Pick<CategoryRule, "categoryId">,
  categories: CategoryOption[] | null,
): { name: string; archived: boolean } {
  const category = findById(categories, rule.categoryId);
  if (!category) return { name: CATEGORY_FALLBACK, archived: false };
  return { name: category.name, archived: category.status === "archived" };
}

/** Valores do formulário, sempre texto (como chegam do FormData ou dos campos). */
export interface RuleFormValues {
  conditionField: string;
  conditionOperator: string;
  conditionValue: string;
  categoryId: string;
  priority: string;
}

export type FieldErrors = Partial<Record<keyof RuleFormValues, string>>;

export function valuesFromRule(rule: CategoryRule): RuleFormValues {
  return {
    conditionField: rule.conditionField,
    conditionOperator: rule.conditionOperator,
    conditionValue: rule.conditionValue,
    categoryId: rule.categoryId,
    priority: String(rule.priority),
  };
}

export const EMPTY_RULE_VALUES: RuleFormValues = {
  conditionField: "description",
  conditionOperator: "contains",
  conditionValue: "",
  categoryId: "",
  priority: "0",
};

const FIELD_MESSAGES: Record<keyof RuleFormValues, string> = {
  conditionField: "Escolha o campo da condição.",
  conditionOperator: "Escolha como comparar.",
  conditionValue: "Informe o valor da condição.",
  categoryId: "Escolha uma categoria ativa.",
  priority: "Use um número inteiro entre 0 e 2.147.483.647.",
};

export function fieldMessage(field: string): string | undefined {
  return FIELD_MESSAGES[field as keyof RuleFormValues];
}

/** Inteiro >= 0 digitado como texto; qualquer outra forma é recusada, sem arredondar. */
function parsePriority(raw: string): number | null {
  const value = raw.trim();
  return /^\d{1,10}$/.test(value) ? Number(value) : null;
}

export type ParsedRule = { ok: true; input: CategoryRuleInput } | { ok: false; fieldErrors: FieldErrors };

export function parseRuleForm(values: RuleFormValues): ParsedRule {
  const priority = parsePriority(values.priority);
  const result = categoryRuleInputSchema.safeParse({
    categoryId: values.categoryId,
    conditionField: values.conditionField,
    conditionOperator: values.conditionOperator,
    conditionValue: values.conditionValue,
    priority: priority ?? -1,
  });

  const fieldErrors: FieldErrors = {};
  if (!result.success) {
    for (const issue of result.error.issues as z.core.$ZodIssue[]) {
      const field = String(issue.path[0] ?? "") as keyof RuleFormValues;
      if (!field || fieldErrors[field]) continue;
      // Refinamentos do schema ("é igual a", Receita/Despesa, conta) já vêm em pt-BR.
      fieldErrors[field] = issue.code === "custom" ? `${issue.message}.` : FIELD_MESSAGES[field];
    }
  }
  if (priority === null) fieldErrors.priority = FIELD_MESSAGES.priority;

  if (result.success && Object.keys(fieldErrors).length === 0) {
    return { ok: true, input: result.data };
  }
  return { ok: false, fieldErrors };
}

function sameConditionValue(field: RuleConditionField, left: string, right: string): boolean {
  const normalize = (value: string) => value.replace(/\s+/g, " ").trim();
  // Tipo e conta não diferenciam maiúsculas no backend; descrição é comparada sem caixa
  // na avaliação, mas o valor salvo preserva o que o usuário digitou.
  return field === "description"
    ? normalize(left) === normalize(right)
    : normalize(left).toLowerCase() === normalize(right).toLowerCase();
}

/**
 * PATCH somente com o que mudou. Se qualquer parte da condição muda, campo, operador e
 * valor seguem juntos para o backend validar a combinação. null = nada a salvar.
 */
export function buildRulePatch(
  original: CategoryRule,
  input: CategoryRuleInput,
): CategoryRuleUpdate | null {
  const patch: CategoryRuleUpdate = {};
  const conditionChanged =
    original.conditionField !== input.conditionField ||
    original.conditionOperator !== input.conditionOperator ||
    !sameConditionValue(input.conditionField, original.conditionValue, input.conditionValue);

  if (conditionChanged) {
    patch.conditionField = input.conditionField;
    patch.conditionOperator = input.conditionOperator;
    patch.conditionValue = input.conditionValue;
  }
  if (original.categoryId.toLowerCase() !== input.categoryId.toLowerCase()) {
    patch.categoryId = input.categoryId;
  }
  if (original.priority !== input.priority) patch.priority = input.priority;

  return Object.keys(patch).length > 0 ? patch : null;
}

/** Comparação do formulário bruto com a regra, para habilitar "Salvar" só quando algo mudou. */
export function isDirty(original: CategoryRule, values: RuleFormValues): boolean {
  const base = valuesFromRule(original);
  return (
    base.conditionField !== values.conditionField ||
    base.conditionOperator !== values.conditionOperator ||
    !sameConditionValue(original.conditionField, base.conditionValue, values.conditionValue) ||
    base.categoryId !== values.categoryId ||
    base.priority !== values.priority.trim()
  );
}

/** Trocar o campo mantém o operador só se ele for válido para o novo campo; o valor recomeça. */
export function changeField(values: RuleFormValues, field: RuleConditionField): RuleFormValues {
  const operators = OPERATORS_BY_FIELD[field];
  const operator = operators.includes(values.conditionOperator as RuleOperator)
    ? values.conditionOperator
    : operators[0];
  return { ...values, conditionField: field, conditionOperator: operator, conditionValue: "" };
}

export type RuleFailure =
  | { kind: "unauthorized" }
  /** Regra inexistente/de outro tenant ou já removida: volta para a lista e recarrega. */
  | { kind: "stale"; message: string }
  | { kind: "fields"; fieldErrors: FieldErrors; clearCategory?: boolean }
  | { kind: "message"; message: string };

const UNAVAILABLE_MESSAGE =
  "A regra, a categoria ou a conta escolhida não foi encontrada ou não está mais disponível.";

export function classifyRuleError(error: unknown, fallback: string): RuleFailure {
  if (isUnauthorized(error)) return { kind: "unauthorized" };
  if (error instanceof ProblemDetailsError) {
    switch (error.code) {
      case PROBLEM_CODES.categoryRuleConflict:
        return { kind: "stale", message: "Esta regra já tinha sido removida e não pode mais ser alterada." };
      case PROBLEM_CODES.categoryRuleNotFound:
      case PROBLEM_CODES.categoryNotFound:
      case PROBLEM_CODES.accountNotFound:
        return { kind: "stale", message: UNAVAILABLE_MESSAGE };
      case PROBLEM_CODES.categoryArchived:
        return {
          kind: "fields",
          clearCategory: true,
          fieldErrors: { categoryId: "A categoria escolhida foi arquivada. Escolha uma categoria ativa." },
        };
      case PROBLEM_CODES.identityContextUnavailable:
        return { kind: "message", message: "Não foi possível confirmar seu acesso. Entre novamente." };
    }
    if (error.status === 400) {
      const fieldErrors: FieldErrors = {};
      for (const item of error.problem.errors ?? []) {
        const message = fieldMessage(item.path);
        if (message) fieldErrors[item.path as keyof RuleFormValues] ??= message;
      }
      if (Object.keys(fieldErrors).length > 0) return { kind: "fields", fieldErrors };
      return { kind: "message", message: "Revise a condição da regra e tente de novo." };
    }
  }
  return { kind: "message", message: `${fallback} Tente de novo.` };
}
