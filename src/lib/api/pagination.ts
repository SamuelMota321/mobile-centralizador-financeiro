import { z } from "zod";

export const pageQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

export interface PageQuery {
  page?: number;
  /** 1 a 100. Default do backend: 20. */
  pageSize?: number;
}

export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

/** Limite de itens carregados para seletores; acima disso o resultado e marcado truncado. */
export const SELECTOR_ITEM_LIMIT = 500;

/**
 * Percorre as paginas ate `total` para alimentar seletores (contas, categorias).
 * Nunca descarta itens em silencio: acima do limite retorna `truncated: true`.
 */
export async function listAllPages<T>(
  fetchPage: (query: { page: number; pageSize: number }) => Promise<Page<T>>,
  limit: number = SELECTOR_ITEM_LIMIT,
): Promise<{ items: T[]; truncated: boolean }> {
  const items: T[] = [];
  for (let page = 1; ; page += 1) {
    const result = await fetchPage({ page, pageSize: 100 });
    items.push(...result.items);
    if (items.length >= result.total || result.items.length === 0) {
      return { items, truncated: false };
    }
    if (items.length >= limit) {
      return { items: items.slice(0, limit), truncated: true };
    }
  }
}
