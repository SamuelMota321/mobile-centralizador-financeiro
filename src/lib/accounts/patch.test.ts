import { describe, expect, it } from "vitest";
import { buildAccountPatch } from "./patch";
import type { Account, ManualAccountInput } from "./types";

const original: Account = {
  id: "3f1c2b4e-8a6d-4c1e-9b2a-7d5e6f8a9b0c",
  name: "Conta principal",
  type: "checking",
  origin: "manual",
  institutionName: "Banco Ficticio",
  initialBalance: "1250.00",
  initialBalanceAsOf: "2026-09-10",
  currencyCode: "BRL",
  archivedAt: null,
  createdAt: "2026-09-10T10:00:00.000Z",
  updatedAt: "2026-09-10T10:00:00.000Z",
};

const unchanged: ManualAccountInput = {
  name: "Conta principal",
  type: "checking",
  institutionName: "Banco Ficticio",
  initialBalance: "1250.00",
  initialBalanceAsOf: "2026-09-10",
};

describe("buildAccountPatch", () => {
  it("retorna null quando nada mudou", () => {
    expect(buildAccountPatch(original, unchanged)).toBeNull();
  });

  it.each(["1250", "1250.0", "1250.00"])(
    "trata %s como o mesmo saldo de 1250.00",
    (initialBalance) => {
      expect(buildAccountPatch(original, { ...unchanged, initialBalance })).toBeNull();
    },
  );

  it("trata -0 e 0.00 como o mesmo saldo", () => {
    expect(
      buildAccountPatch({ ...original, initialBalance: "0.00" }, { ...unchanged, initialBalance: "-0" }),
    ).toBeNull();
  });

  it("envia somente o campo alterado", () => {
    expect(buildAccountPatch(original, { ...unchanged, name: "Reserva" })).toEqual({
      name: "Reserva",
    });
    expect(buildAccountPatch(original, { ...unchanged, type: "savings" })).toEqual({
      type: "savings",
    });
  });

  it("envia saldo e data juntos quando apenas a data muda", () => {
    expect(
      buildAccountPatch(original, { ...unchanged, initialBalanceAsOf: "2026-09-01" }),
    ).toEqual({ initialBalance: "1250.00", initialBalanceAsOf: "2026-09-01" });
  });

  it("envia saldo e data juntos quando apenas o saldo muda", () => {
    expect(buildAccountPatch(original, { ...unchanged, initialBalance: "-1250.00" })).toEqual({
      initialBalance: "-1250.00",
      initialBalanceAsOf: "2026-09-10",
    });
  });

  it("envia null para remover a instituição", () => {
    expect(buildAccountPatch(original, { ...unchanged, institutionName: null })).toEqual({
      institutionName: null,
    });
  });
});
