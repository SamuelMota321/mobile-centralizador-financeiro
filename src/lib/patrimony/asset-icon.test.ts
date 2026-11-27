import { describe, expect, it } from "vitest";
import { assetIconKey } from "./asset-icon";

describe("assetIconKey", () => {
  it("escolhe pelo tipo, sem acento e sem caixa", () => {
    expect(assetIconKey("Imóvel")).toBe("home");
    expect(assetIconKey("APARTAMENTO na praia")).toBe("home");
    expect(assetIconKey("Veículo")).toBe("vehicle");
    expect(assetIconKey("moto")).toBe("vehicle");
  });

  it("compara palavras inteiras", () => {
    // "casa" dentro de "casamento" não conta.
    expect(assetIconKey("Casamento")).toBe("generic");
  });

  it("sem regra ou sem tipo, genérico", () => {
    expect(assetIconKey("Joias")).toBe("generic");
    expect(assetIconKey("")).toBe("generic");
    expect(assetIconKey(null)).toBe("generic");
  });
});
