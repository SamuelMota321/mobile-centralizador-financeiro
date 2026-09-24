import { describe, expect, it } from "vitest";
import {
  createTransactionInputSchema,
  createTransferInputSchema,
  transactionCategoryUpdateSchema,
} from "./schema";

const ACCOUNT_A = "3f1c2b4e-8a6d-4c1e-9b2a-7d5e6f8a9b0c";
const ACCOUNT_B = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";
const CATEGORY = "7c6b5a49-3827-4165-9a8b-7c6d5e4f3a2b";

const movement = {
  accountId: ACCOUNT_A,
  type: "expense",
  amount: "184.90",
  occurredOn: "2026-09-20",
  description: "Mercado do bairro",
};

describe("createTransactionInputSchema", () => {
  it.each(["0.01", "1.00", "184.90", "99999999999999999.99"])("aceita o valor %s", (amount) => {
    expect(createTransactionInputSchema.safeParse({ ...movement, amount }).success).toBe(true);
  });

  it.each(["0.00", "0", "10", "10.5", "10.001", "-10.00", "01.00", "1,00", ""])(
    "recusa o valor %j (contrato: duas casas e maior que zero)",
    (amount) => {
      expect(createTransactionInputSchema.safeParse({ ...movement, amount }).success).toBe(false);
    },
  );

  it("normaliza a descrição e converte vazio em null", () => {
    expect(createTransactionInputSchema.parse({ ...movement, description: "  Feira   livre " }).description).toBe(
      "Feira livre",
    );
    expect(createTransactionInputSchema.parse({ ...movement, description: "   " }).description).toBeNull();
    expect(createTransactionInputSchema.parse({ ...movement, description: undefined }).description).toBeNull();
  });

  it.each(["2026-02-29", "2026-13-01", "20/09/2026"])("recusa a data %s", (occurredOn) => {
    expect(createTransactionInputSchema.safeParse({ ...movement, occurredOn }).success).toBe(false);
  });

  it("recusa tipo transferência e campos fora do contrato", () => {
    expect(createTransactionInputSchema.safeParse({ ...movement, type: "transfer" }).success).toBe(false);
    expect(createTransactionInputSchema.safeParse({ ...movement, tenantId: ACCOUNT_B }).success).toBe(false);
  });
});

describe("createTransferInputSchema", () => {
  const transfer = { fromAccountId: ACCOUNT_A, toAccountId: ACCOUNT_B, amount: "250.00", occurredOn: "2026-09-20" };

  it("aceita contas distintas", () => {
    expect(createTransferInputSchema.safeParse(transfer).success).toBe(true);
  });

  it("recusa origem igual ao destino, sem diferenciar maiúsculas", () => {
    const result = createTransferInputSchema.safeParse({ ...transfer, toAccountId: ACCOUNT_A.toUpperCase() });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["toAccountId"]);
  });
});

describe("transactionCategoryUpdateSchema", () => {
  it.each([{ categoryId: CATEGORY }, { categorizationStatus: "uncertain" }, { categorizationStatus: "unrecognized" }])(
    "aceita %j",
    (body) => {
      expect(transactionCategoryUpdateSchema.safeParse(body).success).toBe(true);
    },
  );

  it.each([
    {},
    { categoryId: CATEGORY, categorizationStatus: "uncertain" },
    { categorizationStatus: "unclassified" },
    { categorizationStatus: "categorized" },
    { categoryId: "nao-e-uuid" },
  ])("recusa %j (exatamente uma forma; sem voltar a sem categoria)", (body) => {
    expect(transactionCategoryUpdateSchema.safeParse(body).success).toBe(false);
  });
});
