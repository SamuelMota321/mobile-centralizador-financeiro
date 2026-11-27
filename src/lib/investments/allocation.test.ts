import { describe, expect, it } from "vitest";
import { shareBasisPoints, shareWidth } from "./allocation";

describe("shareBasisPoints", () => {
  it("usa os valores exatos, não o percentual arredondado", () => {
    expect(shareBasisPoints("1000.00", "1500.00")).toBe(6666);
    expect(shareBasisPoints("500.00", "1500.00")).toBe(3333);
  });

  it("aceita casas decimais diferentes entre valor e denominador", () => {
    expect(shareBasisPoints("1.5", "6.000")).toBe(2500);
    expect(shareBasisPoints("10", "10.00")).toBe(10000);
  });

  it("não perde precisão em valores grandes", () => {
    expect(shareBasisPoints("123456789012345.67", "246913578024691.34")).toBe(5000);
  });

  it("valor inválido, negativo ou denominador não positivo vira 0", () => {
    expect(shareBasisPoints("x", "10")).toBe(0);
    expect(shareBasisPoints("-5", "10")).toBe(0);
    expect(shareBasisPoints("5", "0.00")).toBe(0);
    expect(shareBasisPoints("5", "-10")).toBe(0);
  });

  it("nunca passa de 100%", () => {
    expect(shareBasisPoints("20", "10")).toBe(10000);
  });
});

describe("shareWidth", () => {
  it("formata a largura CSS com duas casas", () => {
    expect(shareWidth("1000.00", "1500.00")).toBe("66.66%");
    expect(shareWidth("1", "4")).toBe("25.00%");
    expect(shareWidth("0", "4")).toBe("0.00%");
  });
});
