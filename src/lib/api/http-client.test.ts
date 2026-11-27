import { afterEach, describe, expect, it, vi } from "vitest";
import { apiRequest, REQUEST_TIMEOUT_MS, RequestTimeoutError, retryAfterMs, setTokenProvider } from "./http-client";

function stubFetch(status: number, body?: unknown) {
  const fetchMock = vi.fn(async () =>
    new Response(body === undefined ? "" : JSON.stringify(body), { status }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function lastRequest(fetchMock: ReturnType<typeof stubFetch>) {
  const [url, init] = fetchMock.mock.calls.at(-1) as unknown as [string, RequestInit];
  return { url, init, headers: new Headers(init.headers) };
}

describe("apiRequest", () => {
  it("serializa o corpo como JSON e só define content-type quando há corpo", async () => {
    setTokenProvider(() => undefined);
    const fetchMock = stubFetch(200, {});
    await apiRequest("/accounts", { method: "POST", body: { name: "Conta" } });
    const withBody = lastRequest(fetchMock);
    expect(withBody.init.body).toBe('{"name":"Conta"}');
    expect(withBody.headers.get("content-type")).toBe("application/json");

    await apiRequest("/accounts/x/deactivate", { method: "POST" });
    const withoutBody = lastRequest(fetchMock);
    expect(withoutBody.init.body).toBeUndefined();
    expect(withoutBody.headers.has("content-type")).toBe(false);
  });

  it("envia FormData sem serializar e deixa o runtime definir o content-type", async () => {
    setTokenProvider(() => "token-ficticio");
    const fetchMock = stubFetch(201, {});
    const form = new FormData();
    form.append("file", "conteudo");

    await apiRequest("/ingestions/ofx/previews", { method: "POST", body: form });
    const request = lastRequest(fetchMock);
    expect(request.url).toBe("http://api.test.local/api/v1/ingestions/ofx/previews");
    expect(request.init.body).toBe(form);
    expect(request.headers.has("content-type")).toBe(false);
    expect(request.headers.get("authorization")).toBe("Bearer token-ficticio");
  });
});

describe("nova tentativa em leituras", () => {
  afterEach(() => vi.useRealTimers());

  function sequence(...steps: (number | Error)[]) {
    setTokenProvider(() => undefined);
    const fetchMock = vi.fn(async () => {
      const step = steps.shift() ?? 200;
      if (step instanceof Error) throw step;
      return new Response(step === 200 ? '{"ok":true}' : "", { status: step });
    });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  it("GET repete em 429 e 503 e depois funciona", async () => {
    vi.useFakeTimers();
    const fetchMock = sequence(429, 503, 200);
    const promise = apiRequest<{ ok: boolean }>("/accounts");
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(2500);
    await expect(promise).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("GET repete em falha de rede", async () => {
    vi.useFakeTimers();
    const fetchMock = sequence(new TypeError("Network request failed"), 200);
    const promise = apiRequest("/accounts");
    await vi.advanceTimersByTimeAsync(1000);
    await expect(promise).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("desiste depois de 3 repetições e devolve o erro", async () => {
    vi.useFakeTimers();
    const fetchMock = sequence(429, 429, 429, 429);
    const assertion = expect(apiRequest("/accounts")).rejects.toMatchObject({ status: 429 });
    await vi.advanceTimersByTimeAsync(1000 + 2500 + 5000);
    await assertion;
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("não repete 401 nem escritas", async () => {
    const unauthorized = sequence(401);
    await expect(apiRequest("/accounts")).rejects.toMatchObject({ status: 401 });
    expect(unauthorized).toHaveBeenCalledTimes(1);

    const write = sequence(503);
    await expect(apiRequest("/transactions", { method: "POST", body: { a: 1 } })).rejects.toMatchObject({ status: 503 });
    expect(write).toHaveBeenCalledTimes(1);

    const failedWrite = sequence(new TypeError("Network request failed"));
    await expect(apiRequest("/transactions", { method: "PATCH", body: {} })).rejects.toBeInstanceOf(TypeError);
    expect(failedWrite).toHaveBeenCalledTimes(1);
  });

  it("Retry-After em segundos vale com teto; datas são ignoradas", () => {
    expect(retryAfterMs("3")).toBe(3000);
    expect(retryAfterMs("999")).toBe(8000);
    expect(retryAfterMs("Wed, 21 Oct 2026 07:28:00 GMT")).toBeNull();
    expect(retryAfterMs(null)).toBeNull();
  });
});

describe("tempo limite das leituras", () => {
  afterEach(() => vi.useRealTimers());

  /** fetch que nunca responde e só termina quando o sinal aborta, como uma conexão aberta e muda. */
  function hanging() {
    const fetchMock = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  it("leitura que não responde vira RequestTimeoutError no tempo limite e não repete", async () => {
    vi.useFakeTimers();
    setTokenProvider(() => undefined);
    const fetchMock = hanging();
    const assertion = expect(apiRequest("/accounts")).rejects.toBeInstanceOf(RequestTimeoutError);
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS);
    await assertion;
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("resposta dentro do prazo não é afetada (o relógio é limpo)", async () => {
    vi.useFakeTimers();
    setTokenProvider(() => undefined);
    vi.stubGlobal("fetch", vi.fn(async () => new Response('{"ok":true}', { status: 200 })));
    await expect(apiRequest("/accounts")).resolves.toEqual({ ok: true });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("escrita não ganha tempo limite (abortar um POST aceito pelo servidor poderia duplicar)", async () => {
    setTokenProvider(() => undefined);
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      expect(init?.signal).toBeUndefined();
      return new Response("{}", { status: 201 });
    });
    vi.stubGlobal("fetch", fetchMock);
    await apiRequest("/transactions", { method: "POST", body: { a: 1 } });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
