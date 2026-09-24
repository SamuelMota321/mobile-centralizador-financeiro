import { z } from "zod";
import { apiRequest } from "../api/http-client";
import { pageQuerySchema, type PageQuery } from "../api/pagination";
import { toProblemError } from "../api/problem-error";
import { categoryInputSchema, categoryPageSchema, categorySchema } from "./schema";
import type { Category, CategoryInput, CategoryPage } from "./types";

const uuidSchema = z.uuid();

/** GET /api/v1/categories — ativas e arquivadas; ordem do servidor: mais recentes primeiro. */
export async function listCategories(
  query: PageQuery = {},
): Promise<CategoryPage> {
  const { page, pageSize } = pageQuerySchema.parse(query);
  return request(
    "/categories",
    { method: "GET", query: { page, pageSize } },
    categoryPageSchema,
  );
}

/** POST /api/v1/categories */
export async function createCategory(
  input: CategoryInput,
): Promise<Category> {
  const body = categoryInputSchema.parse(input);
  return request("/categories", { method: "POST", body }, categorySchema);
}

/** PATCH /api/v1/categories/{id} — somente categorias ativas podem ser renomeadas. */
export async function renameCategory(
  categoryId: string,
  input: CategoryInput,
): Promise<Category> {
  const id = uuidSchema.parse(categoryId);
  const body = categoryInputSchema.parse(input);
  return request(`/categories/${id}`, { method: "PATCH", body }, categorySchema);
}

/** POST /api/v1/categories/{id}/deactivate — arquiva; nao ha exclusao fisica. */
export async function deactivateCategory(
  categoryId: string,
): Promise<Category> {
  const id = uuidSchema.parse(categoryId);
  return request(`/categories/${id}/deactivate`, { method: "POST" }, categorySchema);
}

async function request<T>(
  path: string,
  options: { method: string; body?: unknown; query?: Record<string, number> },
  schema: z.ZodType<T>,
): Promise<T> {
  try {
    const raw = await apiRequest<unknown>(path, options);
    return schema.parse(raw);
  } catch (error) {
    throw toProblemError(error);
  }
}
