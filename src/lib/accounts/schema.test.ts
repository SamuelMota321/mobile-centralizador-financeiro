import { describe, expect, it } from "vitest";
import {
  accountIdSchema,
  accountUpdateInputSchema,
  manualAccountInputSchema,
} from "./schema";

const validInput = {
  name: "Conta principal",
  type: "checking",
  institutionName: "Banco Ficticio",
  initialBalance: "1250.00",
  initialBalanceAsOf: "2026-09-10",
};

describe("manualAccountInputSchema", () => {
  it("aceita uma conta válida", () => {
    expect(manualAccountInputSchema.safeParse(validInput).success).toBe(true);
  });

  it("aceita nome com 100 caracteres e recusa com 101", () => {
    expect(manualAccountInputSchema.safeParse({ ...validInput, name: "a".repeat(100) }).success).toBe(true);
    expect(manualAccountInputSchema.safeParse({ ...validInput, name: "a".repeat(101) }).success).toBe(false);
  });

  it("recusa nome somente com espacos", () => {
    expect(manualAccountInputSchema.safeParse({ ...validInput, name: "   " }).success).toBe(false);
  });

  it("normaliza instituição em branco para null", () => {
    const parsed = manualAccountInputSchema.parse({ ...validInput, institutionName: "  " });
    expect(parsed.institutionName).toBeNull();
  });

  it.each(["abc", "10.123", "01.00", "1,50", ""])("recusa o saldo %j", (initialBalance) => {
    expect(manualAccountInputSchema.safeParse({ ...validInput, initialBalance }).success).toBe(false);
  });

  it.each(["-42.5", "0", "1500"])("aceita o saldo %j", (initialBalance) => {
    expect(manualAccountInputSchema.safeParse({ ...validInput, initialBalance }).success).toBe(true);
  });

  it("recusa data futura e data em formato inválido", () => {
    expect(manualAccountInputSchema.safeParse({ ...validInput, initialBalanceAsOf: "2999-01-01" }).success).toBe(false);
    expect(manualAccountInputSchema.safeParse({ ...validInput, initialBalanceAsOf: "10/09/2026" }).success).toBe(false);
  });

  it("recusa campos desconhecidos", () => {
    expect(manualAccountInputSchema.safeParse({ ...validInput, tenantId: "x" }).success).toBe(false);
  });
});

describe("accountUpdateInputSchema", () => {
  it("recusa corpo vazio", () => {
    expect(accountUpdateInputSchema.safeParse({}).success).toBe(false);
  });

  it("recusa somente o controle de duplicidade", () => {
    expect(accountUpdateInputSchema.safeParse({ confirmPossibleDuplicate: true }).success).toBe(false);
  });

  it("exige saldo e data de referência juntos", () => {
    expect(accountUpdateInputSchema.safeParse({ initialBalance: "10.00" }).success).toBe(false);
    expect(accountUpdateInputSchema.safeParse({ initialBalanceAsOf: "2026-09-10" }).success).toBe(false);
    expect(
      accountUpdateInputSchema.safeParse({ initialBalance: "10.00", initialBalanceAsOf: "2026-09-10" }).success,
    ).toBe(true);
  });

  it("recusa campos imutaveis ou desconhecidos", () => {
    expect(accountUpdateInputSchema.safeParse({ name: "a", origin: "manual" }).success).toBe(false);
  });

  it("mantém a instituição omitida e converte em branco para null", () => {
    expect(accountUpdateInputSchema.parse({ name: "Reserva" }).institutionName).toBeUndefined();
    expect(accountUpdateInputSchema.parse({ institutionName: " " }).institutionName).toBeNull();
    expect(accountUpdateInputSchema.parse({ institutionName: null }).institutionName).toBeNull();
  });
});

describe("accountIdSchema", () => {
  it("aceita UUID e recusa outros valores", () => {
    expect(accountIdSchema.safeParse("3f1c2b4e-8a6d-4c1e-9b2a-7d5e6f8a9b0c").success).toBe(true);
    expect(accountIdSchema.safeParse("../outra-conta").success).toBe(false);
  });
});
