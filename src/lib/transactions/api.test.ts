import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setTokenProvider } from "../api/http-client";
import { ProblemDetailsError } from "../api/errors";
import {
  createTransaction,
  createTransfer,
  listTransactions,
  updateTransactionCategory,
} from "./api";

const ACCOUNT_A = "3f1c2b4e-8a6d-4c1e-9b2a-7d5e6f8a9b0c";
const ACCOUNT_B = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";
const KEY = "5d0f6a52-8c1e-4e2b-9f3a-0b1c2d3e4f5a";
const TX_ID = "1b2c3d4e-5f60-4718-8a9b-0c1d2e3f4a5b";

function view(overrides: Record<string, unknown> = {}) {
  return {
    id: TX_ID,
    accountId: ACCOUNT_A,
    type: "expense",
    amount: "42.50",
    occurredOn: "2026-09-20",
    description: "Mercado",
    status: "posted",
    transferId: null,
    transferSide: null,
    categoryId: null,
    categorizationStatus: "unclassified",
    categorizationSource: null,
    createdAt: "2026-09-20T10:00:00.000Z",
    updatedAt: "2026-09-20T10:00:00.000Z",
    ...overrides,
  };
}

function stubFetch(status: number, body?: unknown) {
  const fetchMock = vi.fn(async () =>
    new Response(body === undefined ? "" : JSON.stringify(body), { status }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function lastCall(fetchMock: ReturnType<typeof stubFetch>) {
  const [url, init] = fetchMock.mock.calls.at(-1) as unknown as [string, RequestInit];
  return { url, init, headers: new Headers(init.headers), body: init.body ? JSON.parse(String(init.body)) : undefined };
}

const problemBody = (status: number, code: string) => ({ type: "about:blank", title: "t", status, code, detail: "d" });


beforeEach(() => {
  setTokenProvider(() => "token-ficticio");
});

afterEach(() => {
  setTokenProvider(() => undefined);
});

describe("createTransaction", () => {
  const input = { accountId: ACCOUNT_A, type: "expense" as const, amount: "42.50", occurredOn: "2026-09-20", description: "  Mercado   do  mes " };

  it("envia Idempotency-Key, bearer e descricao normalizada", async () => {
    const fetchMock = stubFetch(201, view());
    await createTransaction(input, { idempotencyKey: KEY });
    const call = lastCall(fetchMock);
    expect(call.url).toBe("http://api.test.local/api/v1/transactions");
    expect(call.init.method).toBe("POST");
    expect(call.headers.get("idempotency-key")).toBe(KEY);
    expect(call.headers.get("authorization")).toBe("Bearer token-ficticio");
    expect(call.body).toEqual({ ...input, description: "Mercado do mes" });
  });

  it("envia descricao vazia como null", async () => {
    const fetchMock = stubFetch(201, view({ description: null }));
    await createTransaction({ ...input, description: "   " }, { idempotencyKey: KEY });
    expect(lastCall(fetchMock).body.description).toBeNull();
  });

  it("recusa chave que nao e UUID e valores invalidos sem chamar a API", async () => {
    const fetchMock = stubFetch(201, view());
    await expect(createTransaction(input, { idempotencyKey: "abc" })).rejects.toThrow();
    for (const amount of ["0.00", "-1.00", "10", "10.5", "1,00"]) {
      await expect(createTransaction({ ...input, amount }, { idempotencyKey: KEY })).rejects.toThrow();
    }
    await expect(
      createTransaction({ ...input, occurredOn: "2026-02-30" }, { idempotencyKey: KEY }),
    ).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("aceita resposta ja categorizada por regra", async () => {
    stubFetch(201, view({ categoryId: ACCOUNT_B, categorizationStatus: "categorized", categorizationSource: "rule" }));
    const result = await createTransaction(input, { idempotencyKey: KEY });
    expect(result.categorizationSource).toBe("rule");
  });

  it("converte conflito de idempotencia em ProblemDetailsError", async () => {
    stubFetch(409, problemBody(409, "IDEMPOTENCY_KEY_REUSED"));
    const error = await createTransaction(input, { idempotencyKey: KEY }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ProblemDetailsError);
    expect((error as ProblemDetailsError).code).toBe("IDEMPOTENCY_KEY_REUSED");
  });
});

describe("createTransfer", () => {
  const input = { fromAccountId: ACCOUNT_A, toAccountId: ACCOUNT_B, amount: "100.00", occurredOn: "2026-09-20" };

  it("envia para /transfers e valida as duas entradas", async () => {
    const fetchMock = stubFetch(201, {
      entries: [
        view({ type: "transfer", transferId: KEY, transferSide: "outgoing", categorizationStatus: "not_applicable" }),
        view({ id: ACCOUNT_B, accountId: ACCOUNT_B, type: "transfer", transferId: KEY, transferSide: "incoming", categorizationStatus: "not_applicable" }),
      ],
    });
    const result = await createTransfer(input, { idempotencyKey: KEY });
    expect(lastCall(fetchMock).url).toBe("http://api.test.local/api/v1/transfers");
    expect(lastCall(fetchMock).headers.get("idempotency-key")).toBe(KEY);
    expect(result.entries.map((entry) => entry.transferSide)).toEqual(["outgoing", "incoming"]);
  });

  it("recusa contas iguais sem chamar a API, inclusive com caixa diferente", async () => {
    const fetchMock = stubFetch(201, {});
    await expect(
      createTransfer({ ...input, toAccountId: ACCOUNT_A.toUpperCase() }, { idempotencyKey: KEY }),
    ).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("falha se a resposta nao tiver exatamente duas entradas", async () => {
    stubFetch(201, { entries: [view()] });
    await expect(createTransfer(input, { idempotencyKey: KEY })).rejects.toThrow();
  });
});

describe("listTransactions", () => {
  it("pagina sem filtros e valida a resposta", async () => {
    const fetchMock = stubFetch(200, { items: [view()], page: 2, pageSize: 50, total: 51 });
    const page = await listTransactions({ page: 2, pageSize: 50 });
    expect(lastCall(fetchMock).url).toBe("http://api.test.local/api/v1/transactions?page=2&pageSize=50");
    expect(page.items).toHaveLength(1);
  });

  it("recusa pageSize acima de 100 sem chamar a API", async () => {
    const fetchMock = stubFetch(200, {});
    await expect(listTransactions({ pageSize: 101 })).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("updateTransactionCategory", () => {
  it.each([
    [{ categoryId: ACCOUNT_B }],
    [{ categorizationStatus: "uncertain" as const }],
    [{ categorizationStatus: "unrecognized" as const }],
  ])("envia PATCH com %j", async (update) => {
    const fetchMock = stubFetch(200, view());
    await updateTransactionCategory(TX_ID, update);
    const call = lastCall(fetchMock);
    expect(call.url).toBe(`http://api.test.local/api/v1/transactions/${TX_ID}/category`);
    expect(call.init.method).toBe("PATCH");
    expect(call.body).toEqual(update);
  });

  it("recusa as duas formas juntas e status nao permitido", async () => {
    const fetchMock = stubFetch(200, view());
    await expect(
      updateTransactionCategory(TX_ID, { categoryId: ACCOUNT_B, categorizationStatus: "uncertain" } as never),
    ).rejects.toThrow();
    await expect(
      updateTransactionCategory(TX_ID, { categorizationStatus: "unclassified" } as never),
    ).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
