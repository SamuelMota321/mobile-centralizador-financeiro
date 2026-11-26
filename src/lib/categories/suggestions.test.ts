import { describe, expect, it } from "vitest";
import { categoriesToCreate, RULE_PACK, rulePackSize, rulesToCreate, SUGGESTED_CATEGORIES } from "./suggestions";

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
