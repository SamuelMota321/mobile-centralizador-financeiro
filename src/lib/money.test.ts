import { describe, expect, it } from "vitest";
import { formatMoney, parseMoneyInput } from "./money";

describe("parseMoneyInput", () => {
  it.each([
    ["1.234,56", "1234.56"],
    ["1234,56", "1234.56"],
    ["1234,5", "1234.50"],
    ["1234.56", "1234.56"],
    ["12.5", "12.50"],
    ["1.234", "1234.00"],
    ["1.234.567,89", "1234567.89"],
    ["1234", "1234.00"],
    ["0,01", "0.01"],
    ["0,5", "0.50"],
    ["007,00", "7.00"],
    ["  R$ 10,00  ", "10.00"],
    ["99999999999999999,99", "99999999999999999.99"],
  ])("normaliza %j para %j", (raw, expected) => {
    expect(parseMoneyInput(raw)).toBe(expected);
  });

  it.each([
    [""],
    ["0"],
    ["0,00"],
    ["-10"],
    ["-10,00"],
    ["10,001"],
    ["10.001,00,00"],
    ["1,234.56"],
    ["12.34.56"],
    ["abc"],
    ["1e3"],
    ["100000000000000000,00"],
  ])("recusa %j", (raw) => {
    expect(parseMoneyInput(raw)).toBeNull();
  });
});

describe("formatMoney", () => {
  it.each([
    ["0.01", "R$ 0,01"],
    ["1234.56", "R$ 1.234,56"],
    ["1000000.00", "R$ 1.000.000,00"],
    ["99999999999999999.99", "R$ 99.999.999.999.999.999,99"],
    ["-42.50", "-R$ 42,50"],
  ])("formata %s como %s", (value, expected) => {
    expect(formatMoney(value)).toBe(expected);
  });

  it("devolve valores fora do contrato sem alterar", () => {
    expect(formatMoney("12,5")).toBe("12,5");
  });
});
