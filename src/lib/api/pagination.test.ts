import { describe, expect, it, vi } from "vitest";
import { listAllPages } from "./pagination";

function pages(total: number) {
  return vi.fn(async ({ page, pageSize }: { page: number; pageSize: number }) => {
    const start = (page - 1) * pageSize;
    const items = Array.from({ length: Math.max(0, Math.min(pageSize, total - start)) }, (_, i) => start + i);
    return { items, page, pageSize, total };
  });
}

describe("listAllPages", () => {
  it("carrega todas as paginas ate o total", async () => {
    const fetchPage = pages(250);
    const result = await listAllPages(fetchPage);
    expect(result.items).toHaveLength(250);
    expect(result.truncated).toBe(false);
    expect(fetchPage).toHaveBeenCalledTimes(3);
  });

  it("marca como truncado acima do limite", async () => {
    const result = await listAllPages(pages(250), 150);
    expect(result.items).toHaveLength(150);
    expect(result.truncated).toBe(true);
  });

  it("encerra com lista vazia", async () => {
    const fetchPage = pages(0);
    expect(await listAllPages(fetchPage)).toEqual({ items: [], truncated: false });
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });
});
