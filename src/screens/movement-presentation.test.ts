import { describe, expect, it } from "vitest";
import type { Transaction } from "../lib/transactions/types";
import {
  accountLabel,
  ACCOUNT_FALLBACK_LABEL,
  appendPage,
  canCategorize,
  CATEGORY_FALLBACK_LABEL,
  categorizationLabel,
  categorizationTone,
  movementDirection,
  replaceItem,
  signedAmount,
  typeLabel,
} from "./movement-presentation";

const ACCOUNT_ID = "3f1c2b4e-8a6d-4c1e-9b2a-7d5e6f8a9b0c";

function item(id: string): Transaction {
  return {
    id,
    accountId: ACCOUNT_ID,
    type: "expense",
    amount: "10.00",
    occurredOn: "2026-09-20",
    description: null,
    status: "posted",
    transferId: null,
    transferSide: null,
    categoryId: null,
    categorizationStatus: "unclassified",
    categorizationSource: null,
    createdAt: "2026-09-20T12:00:00.000Z",
    updatedAt: "2026-09-20T12:00:00.000Z",
  };
}

describe("accountLabel", () => {
  it("resolve o nome sem diferenciar caixa do UUID", () => {
    expect(accountLabel(ACCOUNT_ID.toUpperCase(), [{ id: ACCOUNT_ID, name: "Carteira" }])).toBe(
      "Carteira",
    );
  });

  it("usa fallback neutro para conta ausente ou lista indisponível", () => {
    expect(accountLabel(ACCOUNT_ID, [])).toBe(ACCOUNT_FALLBACK_LABEL);
    expect(accountLabel(ACCOUNT_ID, null)).toBe(ACCOUNT_FALLBACK_LABEL);
  });
});

describe("typeLabel e signedAmount", () => {
  it.each([
    [{ type: "income", transferSide: null }, "Receita", "+ R$ 1.234,56"],
    [{ type: "expense", transferSide: null }, "Despesa", "\u2212 R$ 1.234,56"],
    [{ type: "transfer", transferSide: "outgoing" }, "Transferência entre contas — saída", "\u2212 R$ 1.234,56"],
    [{ type: "transfer", transferSide: "incoming" }, "Transferência entre contas — entrada", "+ R$ 1.234,56"],
  ] as const)("%j", (transaction, label, amount) => {
    expect(typeLabel(transaction)).toBe(label);
    expect(signedAmount({ ...transaction, amount: "1234.56" }).text).toBe(amount);
  });

  it("nunca usa vocabulário de operação bancária", () => {
    const label = typeLabel({ type: "transfer", transferSide: "outgoing" }).toLowerCase();
    for (const word of ["enviar", "pix", "pagar", "bancaria", "bancária"]) {
      expect(label).not.toContain(word);
    }
  });
});

describe("categorizationLabel", () => {
  const CATEGORY_ID = "7c6b5a49-3827-4165-9a8b-7c6d5e4f3a2b";
  const categories = [{ id: CATEGORY_ID, name: "Mercado", status: "active" as const }];

  it.each([
    ["unclassified", null, "Sem categoria"],
    ["categorized", "manual", "Mercado · definida por você"],
    ["categorized", "rule", "Mercado · aplicada por regra"],
    ["uncertain", null, "Categoria incerta"],
    ["unrecognized", null, "Não reconhecida"],
    ["not_applicable", null, "Não se aplica"],
  ] as const)("%s/%s", (categorizationStatus, categorizationSource, expected) => {
    const categoryId = categorizationStatus === "categorized" ? CATEGORY_ID : null;
    expect(
      categorizationLabel({ categorizationStatus, categorizationSource, categoryId }, categories),
    ).toBe(expected);
  });

  it("mantém legível a categoria arquivada", () => {
    expect(
      categorizationLabel(
        { categorizationStatus: "categorized", categorizationSource: "manual", categoryId: CATEGORY_ID },
        [{ id: CATEGORY_ID, name: "Mercado", status: "archived" }],
      ),
    ).toBe("Mercado (arquivada) · definida por você");
  });

  it("usa fallback neutro quando a categoria não é encontrada", () => {
    for (const list of [[], null]) {
      expect(
        categorizationLabel(
          { categorizationStatus: "categorized", categorizationSource: "rule", categoryId: CATEGORY_ID },
          list,
        ),
      ).toBe(`${CATEGORY_FALLBACK_LABEL} · aplicada por regra`);
    }
  });
});

describe("canCategorize", () => {
  it.each([
    ["income", "posted", true],
    ["expense", "posted", true],
    ["transfer", "posted", false],
    ["expense", "voided", false],
  ] as const)("%s/%s -> %s", (type, status, expected) => {
    expect(canCategorize({ type, status })).toBe(expected);
  });
});

describe("replaceItem", () => {
  it("troca somente a linha confirmada pela API", () => {
    const updated = { ...item("b"), categorizationStatus: "uncertain" as const };
    const result = replaceItem([item("a"), item("b")], updated);
    expect(result.map((entry) => entry.categorizationStatus)).toEqual(["unclassified", "uncertain"]);
  });
});

describe("appendPage", () => {
  it("acrescenta a página seguinte sem repetir itens deslocados", () => {
    const result = appendPage([item("a"), item("b")], [item("b"), item("c")]);
    expect(result.map((entry) => entry.id)).toEqual(["a", "b", "c"]);
  });
});

describe("categorizationTone e movementDirection", () => {
  it.each([
    ["categorized", "positive"],
    ["uncertain", "warning"],
    ["unrecognized", "warning"],
    ["unclassified", "neutral"],
    ["not_applicable", "neutral"],
  ] as const)("%s -> %s", (categorizationStatus, tone) => {
    expect(categorizationTone({ categorizationStatus })).toBe(tone);
  });

  it("distingue entrada, saída e transferência", () => {
    expect(movementDirection({ type: "income", transferSide: null })).toBe("in");
    expect(movementDirection({ type: "expense", transferSide: null })).toBe("out");
    expect(movementDirection({ type: "transfer", transferSide: "outgoing" })).toBe("transfer");
  });
});
