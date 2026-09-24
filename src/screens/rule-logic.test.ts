import { describe, expect, it } from "vitest";
import { ProblemDetailsError } from "../lib/api/errors";
import type { CategoryRule } from "../lib/category-rules/types";
import {
  ACCOUNT_FALLBACK,
  buildRulePatch,
  CATEGORY_FALLBACK,
  changeField,
  classifyRuleError,
  EMPTY_RULE_VALUES,
  isDirty,
  parseRuleForm,
  ruleCategory,
  ruleCondition,
  valuesFromRule,
} from "./rule-logic";

const CATEGORY_ID = "7c6b5a49-3827-4165-9a8b-7c6d5e4f3a2b";
const OTHER_CATEGORY = "1a2b3c4d-5e6f-4a1b-8c2d-3e4f5a6b7c8d";
const ACCOUNT_ID = "3f1c2b4e-8a6d-4c1e-9b2a-7d5e6f8a9b0c";

function rule(overrides: Partial<CategoryRule> = {}): CategoryRule {
  return {
    id: "9f8e7d6c-5b4a-4938-8271-6a5b4c3d2e1f",
    categoryId: CATEGORY_ID,
    conditionField: "description",
    conditionOperator: "contains",
    conditionValue: "mercado",
    priority: 10,
    status: "active",
    removedAt: null,
    createdAt: "2026-09-20T12:00:00.000Z",
    updatedAt: "2026-09-20T12:00:00.000Z",
    ...overrides,
  };
}

describe("ruleCondition e ruleCategory", () => {
  it("lê a regra como frase em pt-BR", () => {
    expect(ruleCondition(rule(), [])).toBe("Se a descrição contém “mercado”");
    expect(
      ruleCondition(rule({ conditionField: "type", conditionOperator: "equals", conditionValue: "income" }), []),
    ).toBe("Se o tipo é igual a Receita");
  });

  it("mostra o nome da conta e nunca o UUID", () => {
    const accountRule = rule({ conditionField: "accountId", conditionOperator: "equals", conditionValue: ACCOUNT_ID });
    expect(ruleCondition(accountRule, [{ id: ACCOUNT_ID.toUpperCase(), name: "Carteira" }])).toBe(
      "Se a conta é igual a Carteira",
    );
    expect(ruleCondition(accountRule, null)).toBe(`Se a conta é igual a ${ACCOUNT_FALLBACK}`);
  });

  it("marca categoria arquivada e usa fallback neutro", () => {
    expect(ruleCategory(rule(), [{ id: CATEGORY_ID, name: "Alimentação", status: "archived" }])).toEqual({
      name: "Alimentação",
      archived: true,
    });
    expect(ruleCategory(rule(), [])).toEqual({ name: CATEGORY_FALLBACK, archived: false });
  });
});

describe("parseRuleForm", () => {
  const valid = {
    conditionField: "description",
    conditionOperator: "starts_with",
    conditionValue: "  Mercado   Bairro ",
    categoryId: CATEGORY_ID,
    priority: "20",
  };

  it("normaliza o valor e converte a prioridade", () => {
    expect(parseRuleForm(valid)).toEqual({
      ok: true,
      input: {
        categoryId: CATEGORY_ID,
        conditionField: "description",
        conditionOperator: "starts_with",
        conditionValue: "Mercado Bairro",
        priority: 20,
      },
    });
  });

  it.each(["-1", "1.5", "", "abc", "2147483648", "99999999999"])("recusa a prioridade %j", (priority) => {
    expect(parseRuleForm({ ...valid, priority })).toEqual({
      ok: false,
      fieldErrors: { priority: expect.stringContaining("número inteiro") },
    });
  });

  it("aceita 0 e o máximo do banco", () => {
    expect(parseRuleForm({ ...valid, priority: "0" })).toMatchObject({ ok: true });
    expect(parseRuleForm({ ...valid, priority: "2147483647" })).toMatchObject({ ok: true });
  });

  it("recusa valor só com espaços e categoria vazia", () => {
    expect(parseRuleForm({ ...valid, conditionValue: "   ", categoryId: "" })).toEqual({
      ok: false,
      fieldErrors: {
        conditionValue: "Informe o valor da condição.",
        categoryId: "Escolha uma categoria ativa.",
      },
    });
  });

  it("só aceita a gramática aprovada", () => {
    expect(
      parseRuleForm({ ...valid, conditionField: "type", conditionOperator: "contains", conditionValue: "income" }),
    ).toMatchObject({ ok: false, fieldErrors: { conditionOperator: expect.stringContaining("é igual a") } });
    expect(
      parseRuleForm({ ...valid, conditionField: "type", conditionOperator: "equals", conditionValue: "mercado" }),
    ).toMatchObject({ ok: false, fieldErrors: { conditionValue: expect.stringContaining("receita ou despesa") } });
    expect(
      parseRuleForm({ ...valid, conditionField: "accountId", conditionOperator: "equals", conditionValue: "Carteira" }),
    ).toMatchObject({ ok: false, fieldErrors: { conditionValue: expect.stringContaining("conta") } });
  });

  it("aceita valor com acentos", () => {
    expect(parseRuleForm({ ...valid, conditionValue: "Açougue São João" })).toMatchObject({ ok: true });
  });
});

describe("buildRulePatch", () => {
  const input = {
    categoryId: CATEGORY_ID,
    conditionField: "description" as const,
    conditionOperator: "contains" as const,
    conditionValue: "mercado",
    priority: 10,
  };

  it("retorna null quando nada mudou", () => {
    expect(buildRulePatch(rule(), input)).toBeNull();
  });

  it("envia só a prioridade quando só ela muda", () => {
    expect(buildRulePatch(rule(), { ...input, priority: 30 })).toEqual({ priority: 30 });
  });

  it("envia a condição completa quando qualquer parte muda", () => {
    expect(buildRulePatch(rule(), { ...input, conditionOperator: "ends_with" })).toEqual({
      conditionField: "description",
      conditionOperator: "ends_with",
      conditionValue: "mercado",
    });
  });

  it("detecta troca de categoria", () => {
    expect(buildRulePatch(rule(), { ...input, categoryId: OTHER_CATEGORY })).toEqual({
      categoryId: OTHER_CATEGORY,
    });
  });
});

describe("isDirty e changeField", () => {
  it("compara o formulário bruto com a regra", () => {
    const base = rule();
    expect(isDirty(base, valuesFromRule(base))).toBe(false);
    expect(isDirty(base, { ...valuesFromRule(base), conditionValue: " mercado " })).toBe(false);
    expect(isDirty(base, { ...valuesFromRule(base), priority: "11" })).toBe(true);
  });

  it("trocar de descrição para tipo zera o valor e força é igual a", () => {
    const next = changeField({ ...EMPTY_RULE_VALUES, conditionValue: "mercado" }, "type");
    expect(next).toMatchObject({ conditionField: "type", conditionOperator: "equals", conditionValue: "" });
  });

  it("voltar para descrição mantém um operador válido", () => {
    const next = changeField({ ...EMPTY_RULE_VALUES, conditionField: "type", conditionOperator: "equals" }, "description");
    expect(next.conditionOperator).toBe("equals");
  });
});

describe("classifyRuleError", () => {
  function problem(status: number, code: string, errors?: { path: string; code: string; message: string }[]) {
    return new ProblemDetailsError({ type: "about:blank", title: "t", status, code, detail: "Technical detail in English.", errors });
  }

  it("401 descarta a sessão", () => {
    expect(classifyRuleError(problem(401, "AUTHENTICATION_REQUIRED"), "x")).toEqual({ kind: "unauthorized" });
  });

  it.each([
    [409, "CATEGORY_RULE_CONFLICT", "removida"],
    [404, "CATEGORY_RULE_NOT_FOUND", "não está mais disponível"],
    [404, "ACCOUNT_NOT_FOUND", "não está mais disponível"],
  ])("%i %s volta para a lista", (status, code, text) => {
    expect(classifyRuleError(problem(status, code), "x")).toEqual({
      kind: "stale",
      message: expect.stringContaining(text),
    });
  });

  it("categoria arquivada limpa a escolha", () => {
    expect(classifyRuleError(problem(409, "CATEGORY_ARCHIVED"), "x")).toMatchObject({
      kind: "fields",
      clearCategory: true,
    });
  });

  it("mapeia errors[].path e esconde detalhe técnico no 500", () => {
    expect(
      classifyRuleError(problem(400, "INVALID_REQUEST", [{ path: "priority", code: "OUT_OF_RANGE", message: "x" }]), "x"),
    ).toMatchObject({ kind: "fields", fieldErrors: { priority: expect.any(String) } });
    const failure = classifyRuleError(problem(500, "INTERNAL_ERROR"), "Não foi possível criar a regra.");
    expect(failure).toEqual({ kind: "message", message: "Não foi possível criar a regra. Tente de novo." });
  });
});
