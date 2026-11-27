import { describe, expect, it } from "vitest";
import { VIEW_HEIGHT, WAVES, wavePath } from "./backdrop-paths";

describe("wavePath", () => {
  it("começa e termina na mesma altura e cobre exatamente 2 períodos (laço sem emenda)", () => {
    const path = wavePath(900, 70, 120);
    expect(path.startsWith("M0,120 ")).toBe(true);
    expect(path).toContain(" T1800,120 ");
    // Fecha por baixo: sem isso o preenchimento vazaria para cima.
    expect(path.endsWith(`V${VIEW_HEIGHT} H0 Z`)).toBe(true);
  });

  it("a senoide cruza a linha de base a cada meio período", () => {
    expect(wavePath(1000, 50, 100, 300)).toBe("M0,100 Q250,50 500,100 T1000,100 T1500,100 T2000,100 V300 H0 Z");
  });

  it("as três camadas têm períodos diferentes entre si (cristas nunca alinhadas)", () => {
    expect(new Set(WAVES.map((wave) => wave.period)).size).toBe(WAVES.length);
  });
});
