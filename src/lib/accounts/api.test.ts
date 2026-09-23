import { afterEach, describe, expect, it, vi } from "vitest";
import { ProblemDetailsError } from "../api/errors";
import { setTokenProvider } from "../api/http-client";
import {
  deactivateAccount,
  listAccounts,
  PossibleDuplicateAccountError,
  updateAccount,
} from "./api";

const ACCOUNT_ID = "3f1c2b4e-8a6d-4c1e-9b2a-7d5e6f8a9b0c";

const accountView = {
  id: ACCOUNT_ID,
  name: "Reserva",
  type: "savings",
  origin: "manual",
  institutionName: null,
  initialBalance: "100.00",
  initialBalanceAsOf: "2026-09-10",
  currencyCode: "BRL",
  archivedAt: null,
  createdAt: "2026-09-10T10:00:00.000Z",
  updatedAt: "2026-09-11T10:00:00.000Z",
};

function stubFetch(status: number, body?: unknown) {
  const fetchMock = vi.fn(async () =>
    new Response(body === undefined ? "" : JSON.stringify(body), { status }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function lastCall(fetchMock: ReturnType<typeof stubFetch>) {
  const [url, init] = fetchMock.mock.calls.at(-1) as unknown as [string, RequestInit];
  return { url, init, headers: new Headers(init.headers) };
}

function problemBody(status: number, code: string, extra: Record<string, unknown> = {}) {
  return { type: "about:blank", title: "t", status, code, detail: "d", ...extra };
}

afterEach(() => {
  setTokenProvider(() => undefined);
});

describe("token da sessao", () => {
  it("envia o bearer do provedor ativo", async () => {
    setTokenProvider(() => "token-ficticio");
    const fetchMock = stubFetch(200, { items: [], page: 1, pageSize: 20, total: 0 });
    await listAccounts();
    expect(lastCall(fetchMock).headers.get("authorization")).toBe("Bearer token-ficticio");
  });

  it("nao envia Authorization depois do logout", async () => {
    setTokenProvider(() => undefined);
    const fetchMock = stubFetch(401, problemBody(401, "AUTHENTICATION_REQUIRED"));
    const error = await listAccounts().catch((e: unknown) => e);
    expect(lastCall(fetchMock).headers.has("authorization")).toBe(false);
    expect(error).toBeInstanceOf(ProblemDetailsError);
    expect((error as ProblemDetailsError).status).toBe(401);
  });
});

describe("updateAccount", () => {
  it("envia PATCH somente com os campos informados", async () => {
    setTokenProvider(() => "token-ficticio");
    const fetchMock = stubFetch(200, accountView);
    const result = await updateAccount(ACCOUNT_ID, { name: "Reserva" });

    const { url, init } = lastCall(fetchMock);
    expect(url).toBe(`http://api.test.local/api/v1/accounts/${ACCOUNT_ID}`);
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(String(init.body))).toEqual({ name: "Reserva" });
    expect(result.name).toBe("Reserva");
  });

  it("recusa id invalido e PATCH vazio sem chamar a API", async () => {
    const fetchMock = stubFetch(200, accountView);
    await expect(updateAccount("../1", { name: "x" })).rejects.toThrow();
    await expect(updateAccount(ACCOUNT_ID, {})).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("converte o 409 de duplicidade em erro com candidatas", async () => {
    stubFetch(
      409,
      problemBody(409, "POSSIBLE_CONNECTED_ACCOUNT_DUPLICATE", {
        candidates: [
          { id: ACCOUNT_ID, name: "Conta", type: "checking", origin: "connected", institutionName: null },
        ],
      }),
    );
    const error = await updateAccount(ACCOUNT_ID, { name: "Conta" }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(PossibleDuplicateAccountError);
  });

  it("converte 404 em ProblemDetailsError com o codigo do contrato", async () => {
    stubFetch(404, problemBody(404, "ACCOUNT_NOT_FOUND"));
    const error = await updateAccount(ACCOUNT_ID, { name: "x" }).catch((e: unknown) => e);
    expect((error as ProblemDetailsError).code).toBe("ACCOUNT_NOT_FOUND");
  });

  it("falha quando a resposta foge do contrato", async () => {
    stubFetch(200, { ...accountView, initialBalance: 100 });
    await expect(updateAccount(ACCOUNT_ID, { name: "x" })).rejects.toThrow();
  });
});

describe("deactivateAccount", () => {
  it("envia POST sem corpo para a rota de desativacao", async () => {
    const fetchMock = stubFetch(200, { ...accountView, archivedAt: "2026-09-12T10:00:00.000Z" });
    const result = await deactivateAccount(ACCOUNT_ID);

    const { url, init } = lastCall(fetchMock);
    expect(url).toBe(`http://api.test.local/api/v1/accounts/${ACCOUNT_ID}/deactivate`);
    expect(init.method).toBe("POST");
    expect(init.body).toBeUndefined();
    expect(result.archivedAt).not.toBeNull();
  });
});
