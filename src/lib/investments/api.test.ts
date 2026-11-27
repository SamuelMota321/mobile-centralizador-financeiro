import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProblemDetailsError } from "../api/errors";
import { setTokenProvider } from "../api/http-client";
import { listInvestmentMovements, listInvestments } from "./api";
import { movementPageView, portfolioPageView, POSITION_ID, positionView } from "./fixtures";

beforeEach(() => setTokenProvider(() => "token-ficticio"));

const BASE = "http://api.test.local/api/v1";

function stubFetch(status: number, body?: unknown) {
  const fetchMock = vi.fn(async () => new Response(body === undefined ? "" : JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function lastCall(fetchMock: ReturnType<typeof stubFetch>) {
  const [url, init] = fetchMock.mock.calls.at(-1) as unknown as [string, RequestInit];
  return { url, init, headers: new Headers(init.headers) };
}

afterEach(() => vi.unstubAllGlobals());

describe("listInvestments", () => {
  it("lê a carteira paginada com bearer e sem Idempotency-Key", async () => {
    const fetchMock = stubFetch(200, portfolioPageView());
    const result = await listInvestments({ page: 2, pageSize: 20 });
    const call = lastCall(fetchMock);
    expect(call.url).toBe(`${BASE}/investments?page=2&pageSize=20`);
    expect(call.init.method).toBe("GET");
    expect(call.headers.get("authorization")).toBe("Bearer token-ficticio");
    expect(call.headers.has("idempotency-key")).toBe(false);
    expect(result.total).toBe(2);
    expect(result.portfolio.allocation.currencies[0].byClass[0].percentage).toBe("66.7");
  });

  it("preserva total nulo e campos ausentes, sem preencher com zero", async () => {
    stubFetch(
      200,
      portfolioPageView({
        portfolio: { ...portfolioPageView().portfolio, total: null, totalsByCurrency: [] },
        positions: [positionView({ resultAmount: null, investedAmount: null, referenceDate: null })],
      }),
    );
    const result = await listInvestments({});
    expect(result.portfolio.total).toBeNull();
    expect(result.positions[0]).toMatchObject({ resultAmount: null, investedAmount: null, referenceDate: null });
  });

  it("recusa classe de alocação e frescor fora do contrato", async () => {
    stubFetch(200, portfolioPageView({ positions: [positionView({ dataQuality: { availability: "complete", freshness: "fresh" } })] }));
    await expect(listInvestments({})).rejects.toThrow();
  });

  it("recusa valor monetário que não é decimal", async () => {
    stubFetch(200, portfolioPageView({ positions: [positionView({ balance: "R$ 10" })] }));
    await expect(listInvestments({})).rejects.toThrow();
  });

  it("converte 403 em ProblemDetailsError", async () => {
    stubFetch(403, { type: "about:blank", title: "t", status: 403, code: "X", detail: "d" });
    await expect(listInvestments({})).rejects.toBeInstanceOf(ProblemDetailsError);
  });
});

describe("listInvestmentMovements", () => {
  it("lê os movimentos da posição e mantém a moeda ausente como nula", async () => {
    const fetchMock = stubFetch(200, movementPageView());
    const result = await listInvestmentMovements(POSITION_ID, { page: 1, pageSize: 20 });
    expect(lastCall(fetchMock).url).toBe(`${BASE}/investments/${POSITION_ID}/movements?page=1&pageSize=20`);
    expect(result.movements[0].currencyCode).toBeNull();
  });

  it("distingue lista vazia confirmada de indisponibilidade", async () => {
    stubFetch(200, movementPageView({ movements: [], total: 0, availability: "unavailable" }));
    expect(await listInvestmentMovements(POSITION_ID, {})).toMatchObject({ availability: "unavailable", total: 0 });
  });

  it("recusa id que não é UUID antes de chamar a API", async () => {
    const fetchMock = stubFetch(200, movementPageView());
    await expect(listInvestmentMovements("../x", {})).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("converte 404 em ProblemDetailsError", async () => {
    stubFetch(404, { type: "about:blank", title: "t", status: 404, code: "X", detail: "d" });
    await expect(listInvestmentMovements(POSITION_ID, {})).rejects.toMatchObject({ status: 404 });
  });
});
