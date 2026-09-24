import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { ProblemDetailsError } from "./api/errors";
import { mustRotateIdempotencyKey, newIdempotencyKey } from "./idempotency";

// expo-crypto e modulo nativo; no Node o teste usa o gerador equivalente.
vi.mock("expo-crypto", () => ({ randomUUID: () => randomUUID() }));

function problem(status: number, code: string) {
  return new ProblemDetailsError({ type: "about:blank", title: "t", status, code, detail: "d" });
}

describe("idempotencia", () => {
  it("gera UUIDs v4 distintos", () => {
    const first = newIdempotencyKey();
    expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(newIdempotencyKey()).not.toBe(first);
  });

  it("troca a chave somente quando o backend a recusa", () => {
    expect(mustRotateIdempotencyKey(problem(409, "IDEMPOTENCY_KEY_REUSED"))).toBe(true);
    expect(mustRotateIdempotencyKey(problem(409, "IDEMPOTENCY_KEY_EXPIRED"))).toBe(true);
    for (const [status, code] of [
      [400, "INVALID_REQUEST"],
      [404, "ACCOUNT_NOT_FOUND"],
      [409, "ACCOUNT_ARCHIVED"],
      [500, "INTERNAL_ERROR"],
    ] as const) {
      expect(mustRotateIdempotencyKey(problem(status, code))).toBe(false);
    }
    expect(mustRotateIdempotencyKey(new Error("rede"))).toBe(false);
  });
});
