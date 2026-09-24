import { z } from "zod";
import { apiRequest } from "../api/http-client";
import { pageQuerySchema, type PageQuery } from "../api/pagination";
import { toProblemError } from "../api/problem-error";
import {
  categoryRuleInputSchema,
  categoryRulePageSchema,
  categoryRuleSchema,
  categoryRuleUpdateSchema,
} from "./schema";
import type {
  CategoryRule,
  CategoryRuleInput,
  CategoryRulePage,
  CategoryRuleUpdate,
} from "./types";

const uuidSchema = z.uuid();
const RULES_PATH = "/category-rules";

/** GET /api/v1/category-rules — inclui removidas; ordem: prioridade desc, mais antiga primeiro. */
export async function listCategoryRules(
  query: PageQuery = {},
): Promise<CategoryRulePage> {
  const { page, pageSize } = pageQuerySchema.parse(query);
  return request(RULES_PATH, { method: "GET", query: { page, pageSize } }, categoryRulePageSchema);
}

/** POST /api/v1/category-rules */
export async function createCategoryRule(
  input: CategoryRuleInput,
): Promise<CategoryRule> {
  const body = categoryRuleInputSchema.parse(input);
  return request(RULES_PATH, { method: "POST", body }, categoryRuleSchema);
}

/** PATCH /api/v1/category-rules/{id} */
export async function updateCategoryRule(
  ruleId: string,
  update: CategoryRuleUpdate,
): Promise<CategoryRule> {
  const id = uuidSchema.parse(ruleId);
  const body = categoryRuleUpdateSchema.parse(update);
  return request(`${RULES_PATH}/${id}`, { method: "PATCH", body }, categoryRuleSchema);
}

/** POST /api/v1/category-rules/{id}/activate */
export async function activateCategoryRule(
  ruleId: string,
): Promise<CategoryRule> {
  const id = uuidSchema.parse(ruleId);
  return request(`${RULES_PATH}/${id}/activate`, { method: "POST" }, categoryRuleSchema);
}

/** POST /api/v1/category-rules/{id}/deactivate */
export async function deactivateCategoryRule(
  ruleId: string,
): Promise<CategoryRule> {
  const id = uuidSchema.parse(ruleId);
  return request(`${RULES_PATH}/${id}/deactivate`, { method: "POST" }, categoryRuleSchema);
}

/**
 * DELETE /api/v1/category-rules/{id} — remocao definitiva do ciclo de vida (sem reativacao).
 * O OpenAPI documenta 200 com a regra removida (a especificacao cita "200/204").
 */
export async function removeCategoryRule(
  ruleId: string,
): Promise<CategoryRule> {
  const id = uuidSchema.parse(ruleId);
  return request(`${RULES_PATH}/${id}`, { method: "DELETE" }, categoryRuleSchema);
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
