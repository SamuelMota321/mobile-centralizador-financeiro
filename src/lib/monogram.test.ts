import { describe, expect, it } from "vitest";
import { monogramInitials } from "./monogram";

describe("monogramInitials", () => {
  it("usa a primeira letra das duas primeiras palavras", () => {
    expect(monogramInitials("Banco Inter")).toBe("BI");
    expect(monogramInitials("Caixa Econômica Federal")).toBe("CE");
  });

  it("ignora palavras de ligação", () => {
    expect(monogramInitials("Banco do Brasil")).toBe("BB");
  });

  it("com uma palavra, usa as duas primeiras letras", () => {
    expect(monogramInitials("nubank")).toBe("NU");
    expect(monogramInitials("C6")).toBe("C6");
  });

  it("devolve um marcador neutro para texto vazio", () => {
    expect(monogramInitials("   ")).toBe("?");
  });
});
