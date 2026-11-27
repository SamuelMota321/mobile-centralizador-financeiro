import { describe, expect, it } from "vitest";
import { categoryIconKey } from "./category-icon";

describe("categoryIconKey", () => {
  it("escolhe pelo nome, sem acento e sem caixa", () => {
    expect(categoryIconKey("Moradia")).toBe("home");
    expect(categoryIconKey("ALIMENTAÇÃO")).toBe("food");
    expect(categoryIconKey("Transporte e combustível")).toBe("transport");
    expect(categoryIconKey("Saúde")).toBe("health");
    expect(categoryIconKey("Lazer")).toBe("leisure");
    expect(categoryIconKey("Educação (arquivada)")).toBe("education");
    expect(categoryIconKey("Roupas")).toBe("shopping");
    expect(categoryIconKey("Conta de luz")).toBe("bills");
    expect(categoryIconKey("Renda")).toBe("income");
  });

  it("as sugeridas têm ícones distintos entre si", () => {
    expect(categoryIconKey("Mercado")).toBe("groceries");
    expect(categoryIconKey("Alimentação")).toBe("food");
    expect(categoryIconKey("Cuidados pessoais")).toBe("care");
    expect(categoryIconKey("Salário")).toBe("salary");
    expect(categoryIconKey("Outras receitas")).toBe("income");
    expect(categoryIconKey("Contas fixas")).toBe("bills");
  });

  it("compara palavras inteiras e a primeira regra decide", () => {
    // "lazer" aparece dentro de "lazeres", mas só palavra inteira conta.
    expect(categoryIconKey("Lazeres")).toBe("generic");
    // Casa vem antes de lazer na ordem das regras.
    expect(categoryIconKey("Casa de praia")).toBe("home");
  });

  it("sem regra, ou sem nome, cai no genérico", () => {
    expect(categoryIconKey("Pets")).toBe("generic");
    expect(categoryIconKey("Outras (3)")).toBe("generic");
    expect(categoryIconKey(null)).toBe("generic");
    expect(categoryIconKey("")).toBe("generic");
  });
});
