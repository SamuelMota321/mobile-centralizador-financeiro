import { describe, expect, it, vi } from "vitest";
import { apiRequest, setTokenProvider } from "./http-client";

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
