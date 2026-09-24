import { describe, expect, it } from "vitest";
import { categoryRuleInputSchema, categoryRuleUpdateSchema, MAX_RULE_PRIORITY } from "./schema";

const CATEGORY = "7c6b5a49-3827-4165-9a8b-7c6d5e4f3a2b";
const ACCOUNT = "3f1c2b4e-8a6d-4c1e-9b2a-7d5e6f8a9b0c";

const rule = {
  categoryId: CATEGORY,
  conditionField: "description",
  conditionOperator: "contains",
  conditionValue: "mercado",
  priority: 10,
};

describe("categoryRuleInputSchema — gramática aprovada", () => {
  it.each(["equals", "contains", "starts_with", "ends_with"])("descrição aceita %s", (conditionOperator) => {
    expect(categoryRuleInputSchema.safeParse({ ...rule, conditionOperator }).success).toBe(true);
  });

  it.each([
    ["type", "contains", "income"],
    ["type", "starts_with", "expense"],
    ["accountId", "ends_with", ACCOUNT],
  ])("%s não aceita %s", (conditionField, conditionOperator, conditionValue) => {
    expect(
      categoryRuleInputSchema.safeParse({ ...rule, conditionField, conditionOperator, conditionValue }).success,
    ).toBe(false);
  });

  it.each(["income", "expense", "INCOME"])("tipo aceita %s", (conditionValue) => {
    expect(
      categoryRuleInputSchema.safeParse({ ...rule, conditionField: "type", conditionOperator: "equals", conditionValue })
        .success,
    ).toBe(true);
  });

  it.each(["transfer", "receita", "mercado"])("tipo recusa %s", (conditionValue) => {
    expect(
      categoryRuleInputSchema.safeParse({ ...rule, conditionField: "type", conditionOperator: "equals", conditionValue })
        .success,
    ).toBe(false);
  });

  it("conta exige UUID", () => {
    const base = { ...rule, conditionField: "accountId", conditionOperator: "equals" };
    expect(categoryRuleInputSchema.safeParse({ ...base, conditionValue: ACCOUNT }).success).toBe(true);
    expect(categoryRuleInputSchema.safeParse({ ...base, conditionValue: "Carteira" }).success).toBe(false);
  });

  it("recusa campo, operador ou expressão fora da gramática", () => {
    expect(categoryRuleInputSchema.safeParse({ ...rule, conditionField: "amount" }).success).toBe(false);
    expect(categoryRuleInputSchema.safeParse({ ...rule, conditionOperator: "regex" }).success).toBe(false);
    expect(categoryRuleInputSchema.safeParse({ ...rule, conditions: [] }).success).toBe(false);
  });

  it("normaliza espaços e recusa valor vazio", () => {
    expect(categoryRuleInputSchema.parse({ ...rule, conditionValue: "  mercado   bairro " }).conditionValue).toBe(
      "mercado bairro",
    );
    expect(categoryRuleInputSchema.safeParse({ ...rule, conditionValue: "   " }).success).toBe(false);
  });
});

describe("prioridade", () => {
  it.each([0, 1, MAX_RULE_PRIORITY])("aceita %i", (priority) => {
    expect(categoryRuleInputSchema.safeParse({ ...rule, priority }).success).toBe(true);
  });

  it.each([-1, 1.5, MAX_RULE_PRIORITY + 1, Number.NaN])("recusa %s", (priority) => {
    expect(categoryRuleInputSchema.safeParse({ ...rule, priority }).success).toBe(false);
  });
});

describe("categoryRuleUpdateSchema", () => {
  it("aceita PATCH parcial e recusa PATCH vazio", () => {
    expect(categoryRuleUpdateSchema.safeParse({ priority: 3 }).success).toBe(true);
    expect(categoryRuleUpdateSchema.safeParse({}).success).toBe(false);
  });

  it("valida a combinação quando a condição inteira é enviada", () => {
    expect(
      categoryRuleUpdateSchema.safeParse({ conditionField: "type", conditionOperator: "contains", conditionValue: "income" })
        .success,
    ).toBe(false);
  });
});
