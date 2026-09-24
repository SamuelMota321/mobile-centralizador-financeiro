// Alinhado a CategoryRuleView, CreateCategoryRule e UpdateCategoryRule (@ backend fa9b62a).

export const RULE_CONDITION_FIELDS = ["description", "type", "accountId"] as const;
export type RuleConditionField = (typeof RULE_CONDITION_FIELDS)[number];

export const RULE_OPERATORS = ["equals", "contains", "starts_with", "ends_with"] as const;
export type RuleOperator = (typeof RULE_OPERATORS)[number];

/** Gramatica aprovada: `type` e `accountId` aceitam somente `equals`. */
export const OPERATORS_BY_FIELD: Record<RuleConditionField, readonly RuleOperator[]> = {
  description: RULE_OPERATORS,
  type: ["equals"],
  accountId: ["equals"],
};

export type RuleStatus = "active" | "inactive" | "removed";

/** Regra pessoal. `removed` nao pode ser alterada nem reativada. */
export interface CategoryRule {
  id: string;
  categoryId: string;
  conditionField: RuleConditionField;
  conditionOperator: RuleOperator;
  conditionValue: string;
  /** Inteiro >= 0; maior prioridade vence, empate favorece a regra mais antiga. */
  priority: number;
  status: RuleStatus;
  removedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryRulePage {
  items: CategoryRule[];
  page: number;
  pageSize: number;
  total: number;
}

/** Corpo de POST /api/v1/category-rules. */
export interface CategoryRuleInput {
  categoryId: string;
  conditionField: RuleConditionField;
  conditionOperator: RuleOperator;
  conditionValue: string;
  priority: number;
}

/** Corpo de PATCH /api/v1/category-rules/{id}: parcial, ao menos um campo. */
export type CategoryRuleUpdate = Partial<CategoryRuleInput>;
