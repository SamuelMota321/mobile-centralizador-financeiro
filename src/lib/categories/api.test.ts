import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setTokenProvider } from "../api/http-client";
import { ProblemDetailsError } from "../api/errors";
import { createCategory, deactivateCategory, listCategories, renameCategory } from "./api";

const CATEGORY_ID = "3f1c2b4e-8a6d-4c1e-9b2a-7d5e6f8a9b0c";

const view = (overrides: Record<string, unknown> = {}) => ({
  id: CATEGORY_ID,
  name: "Alimentacao",
  source: "user",
  status: "active",
  archivedAt: null,
  createdAt: "2026-09-20T10:00:00.000Z",
  updatedAt: "2026-09-20T10:00:00.000Z",
  ...overrides,
});

function stubFetch(status: number, body?: unknown) {
  const fetchMock = vi.fn(async () => new Response(body === undefined ? "" : JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function lastCall(fetchMock: ReturnType<typeof stubFetch>) {
  const [url, init] = fetchMock.mock.calls.at(-1) as unknown as [string, RequestInit];
  return { url, init, body: init.body ? JSON.parse(String(init.body)) : undefined };
}


beforeEach(() => {
  setTokenProvider(() => "token-ficticio");
});

afterEach(() => {
  setTokenProvider(() => undefined);
});

describe("categorias", () => {
  it("lista ativas e arquivadas", async () => {
    stubFetch(200, { items: [view(), view({ status: "archived", archivedAt: "2026-09-21T10:00:00.000Z" })], page: 1, pageSize: 20, total: 2 });
    const page = await listCategories({});
    expect(page.items.map((item) => item.status)).toEqual(["active", "archived"]);
  });

  it("cria com nome normalizado", async () => {
    const fetchMock = stubFetch(201, view());
    await createCategory({ name: "  Alimentacao   fora " });
    expect(lastCall(fetchMock).body).toEqual({ name: "Alimentacao fora" });
  });

  it("recusa nome vazio ou com mais de 100 caracteres sem chamar a API", async () => {
    const fetchMock = stubFetch(201, view());
    await expect(createCategory({ name: "   " })).rejects.toThrow();
    await expect(createCategory({ name: "a".repeat(101) })).rejects.toThrow();
    await expect(createCategory({ name: "a".repeat(100) })).resolves.toBeDefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("renomeia com PATCH e arquiva com POST sem corpo", async () => {
    const fetchMock = stubFetch(200, view());
    await renameCategory(CATEGORY_ID, { name: "Mercado" });
    expect(lastCall(fetchMock)).toMatchObject({ url: `http://api.test.local/api/v1/categories/${CATEGORY_ID}`, body: { name: "Mercado" } });
    expect(lastCall(fetchMock).init.method).toBe("PATCH");

    await deactivateCategory(CATEGORY_ID);
    expect(lastCall(fetchMock).url).toBe(`http://api.test.local/api/v1/categories/${CATEGORY_ID}/deactivate`);
    expect(lastCall(fetchMock).init.method).toBe("POST");
    expect(lastCall(fetchMock).init.body).toBeUndefined();
  });

  it("converte 409 de categoria arquivada", async () => {
    stubFetch(409, { type: "about:blank", title: "t", status: 409, code: "CATEGORY_ARCHIVED", detail: "d" });
    const error = await renameCategory(CATEGORY_ID, { name: "x" }).catch((e: unknown) => e);
    expect((error as ProblemDetailsError).code).toBe("CATEGORY_ARCHIVED");
  });
});
