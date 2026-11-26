import { describe, expect, it } from "vitest";
import { categoriesToCreate, RULE_PACK, rulePackSize, rulesToCreate, splitSuggestedRules, SUGGESTED_CATEGORIES } from "./suggestions";

const ACTIVE = "active" as const;

describe("categoriesToCreate", () => {
  it("cria todas quando não há nenhuma", () => {
    expect(categoriesToCreate([])).toEqual([...SUGGESTED_CATEGORIES]);
  });

  it("pula nomes iguais, inclusive de arquivadas, como o índice único do banco", () => {
    const result = categoriesToCreate([{ name: "Mercado" }, { name: "Lazer" }]);
    expect(result).not.toContain("Mercado");
    expect(result).not.toContain("Lazer");
    expect(result).toHaveLength(SUGGESTED_CATEGORIES.length - 2);
  });

  it("nome com caixa diferente é outro nome para o banco", () => {
    expect(categoriesToCreate([{ name: "mercado" }])).toContain("Mercado");
  });
});

describe("rulesToCreate", () => {
  const categories = [
    { id: "c-alim", name: "Alimentacao", status: ACTIVE },
    { id: "c-transp", name: "Transporte", status: ACTIVE },
    { id: "c-lazer", name: "Lazer", status: "archived" as const },
  ];

  it("usa só categorias ativas, achadas sem acento e sem caixa", () => {
    const { toCreate, missingCategories } = rulesToCreate(categories, []);
    expect(new Set(toCreate.map((rule) => rule.categoryId))).toEqual(new Set(["c-alim", "c-transp"]));
    expect(missingCategories).toContain("Lazer");
    expect(missingCategories).not.toContain("Alimentação");
  });

  it("pula regra igual existente e não removida; removida conta como ausente", () => {
    const rules = [
      { categoryId: "c-transp", conditionField: "description", conditionOperator: "contains", conditionValue: "UBER", status: "active" },
      { categoryId: "c-transp", conditionField: "description", conditionOperator: "contains", conditionValue: "99app", status: "removed" },
    ];
    const values = rulesToCreate(categories, rules).toCreate.filter((rule) => rule.categoryId === "c-transp").map((rule) => rule.conditionValue);
    expect(values).not.toContain("uber");
    expect(values).toContain("99app");
  });

  it("termos específicos têm prioridade maior que os genéricos", () => {
    const compras = RULE_PACK.find((group) => group.category === "Compras");
    const mercado = RULE_PACK.find((group) => group.category === "Mercado");
    expect(compras?.priority).toBeGreaterThan(mercado?.priority ?? 0);
  });
});

describe("pacote", () => {
  it("toda categoria do pacote existe nas sugeridas", () => {
    for (const group of RULE_PACK) expect(SUGGESTED_CATEGORIES).toContain(group.category);
  });

  it("não repete valores dentro do pacote", () => {
    const values = RULE_PACK.flatMap((group) => group.values.map((value) => value.toLowerCase()));
    expect(new Set(values).size).toBe(values.length);
    expect(rulePackSize()).toBe(values.length);
  });
});

describe("splitSuggestedRules", () => {
  const categories = [
    { id: "c-transp", name: "Transporte" },
    { id: "c-saude", name: "Saude" },
    { id: "c-outra", name: "Viagens" },
  ];
  const rule = (categoryId: string, conditionValue: string, extra: Partial<{ conditionField: string; conditionOperator: string; status: string }> = {}) => ({
    categoryId,
    conditionValue,
    conditionField: "description",
    conditionOperator: "contains",
    status: "active",
    ...extra,
  });

  it("separa as sugeridas por categoria, na ordem do pacote", () => {
    const rules = [rule("c-saude", "Drogaria"), rule("c-transp", "uber"), rule("c-transp", "pedágio")];
    const { personal, suggested, suggestedCount } = splitSuggestedRules(rules, categories);
    expect(personal).toEqual([]);
    expect(suggested.map((group) => group.category)).toEqual(["Transporte", "Saúde"]);
    expect(suggested[0].rules.map((item) => item.conditionValue)).toEqual(["uber", "pedágio"]);
    expect(suggestedCount).toBe(3);
  });

  it("regra editada para outro termo, categoria ou operador é da pessoa", () => {
    const rules = [rule("c-transp", "uber centro"), rule("c-outra", "uber"), rule("c-transp", "uber", { conditionOperator: "equals" })];
    const { personal, suggestedCount } = splitSuggestedRules(rules, categories);
    expect(personal).toHaveLength(3);
    expect(suggestedCount).toBe(0);
  });

  it("removidas continuam no grupo, e sem lista de categorias tudo é da pessoa", () => {
    expect(splitSuggestedRules([rule("c-transp", "uber", { status: "removed" })], categories).suggestedCount).toBe(1);
    expect(splitSuggestedRules([rule("c-transp", "uber")], null).personal).toHaveLength(1);
  });
});
