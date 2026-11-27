import { describe, expect, it } from "vitest";
import { runInBatches } from "./batch";

describe("runInBatches", () => {
  it("roda em lotes: no máximo `size` ao mesmo tempo", async () => {
    let running = 0;
    let peak = 0;
    const result = await runInBatches(Array.from({ length: 12 }, (_, i) => i), async () => {
      running += 1;
      peak = Math.max(peak, running);
      await new Promise((resolve) => setTimeout(resolve, 5));
      running -= 1;
    }, 5);
    expect(result).toEqual({ done: 12, failed: false, error: undefined });
    expect(peak).toBe(5);
  });

  it("lote com falha termina inteiro, conta os que deram certo e não começa outro", async () => {
    const started: number[] = [];
    const error = new Error("falha");
    const result = await runInBatches([1, 2, 3, 4, 5, 6, 7, 8], async (n) => {
      started.push(n);
      if (n === 2) throw error;
    }, 3);
    expect(result).toMatchObject({ done: 2, failed: true, error });
    expect(started).toEqual([1, 2, 3]);
  });

  it("lista vazia não faz nada", async () => {
    expect(await runInBatches([], async () => undefined)).toEqual({ done: 0, failed: false, error: undefined });
  });
});
