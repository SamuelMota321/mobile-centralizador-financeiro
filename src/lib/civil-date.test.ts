import { describe, expect, it } from "vitest";
import {
  formatCivilDate,
  isRealCivilDate,
  parseBrazilianDate,
  todayCivilDate,
} from "./civil-date";

describe("todayCivilDate", () => {
  it("usa o calendario local, sem conversao para UTC", () => {
    expect(todayCivilDate(new Date(2026, 8, 23, 23, 59))).toBe("2026-09-23");
    expect(todayCivilDate(new Date(2026, 0, 1, 0, 0))).toBe("2026-01-01");
  });
});

describe("isRealCivilDate", () => {
  it.each(["2026-09-23", "2024-02-29", "2026-12-31", "0001-01-01"])("aceita %s", (value) => {
    expect(isRealCivilDate(value)).toBe(true);
  });

  it.each(["2026-02-29", "2026-02-30", "2026-13-01", "2026-00-10", "2026-9-23", "23/09/2026", ""])(
    "recusa %j",
    (value) => {
      expect(isRealCivilDate(value)).toBe(false);
    },
  );
});

describe("formatCivilDate", () => {
  it("converte para DD/MM/AAAA", () => {
    expect(formatCivilDate("2026-09-23")).toBe("23/09/2026");
    expect(formatCivilDate("invalida")).toBe("invalida");
  });
});

describe("parseBrazilianDate", () => {
  it("converte DD/MM/AAAA para a data civil do contrato", () => {
    expect(parseBrazilianDate("20/09/2026")).toBe("2026-09-20");
    expect(parseBrazilianDate(" 29/02/2024 ")).toBe("2024-02-29");
  });

  it.each(["29/02/2026", "31/04/2026", "2026-09-20", "1/9/2026", "20-09-2026", ""])("recusa %j", (raw) => {
    expect(parseBrazilianDate(raw)).toBeNull();
  });
});
