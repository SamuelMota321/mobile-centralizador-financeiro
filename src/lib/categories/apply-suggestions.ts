import { listAllPages } from "../api/pagination";
import { createCategoryRule, listCategoryRules } from "../category-rules/api";
import { createCategory, listCategories } from "./api";
import { categoriesToCreate, rulesToCreate, SUGGESTED_CATEGORIES } from "./suggestions";

/** Resultado parcial: em falha, diz quantos entraram e devolve o erro para a tela classificar. */
export type ApplyResult<T> = { ok: true; created: number } & T | { ok: false; created: number; error: unknown };

/** Cria as categorias sugeridas que faltam, uma por vez. Repetir é seguro. */
export async function createSuggestedCategories(): Promise<ApplyResult<{ skipped: number }>> {
  let created = 0;
  try {
    const { items } = await listAllPages((query) => listCategories(query));
    const names = categoriesToCreate(items);
    for (const name of names) {
      await createCategory({ name });
      created += 1;
    }
    return { ok: true, created, skipped: SUGGESTED_CATEGORIES.length - names.length };
  } catch (error) {
    return { ok: false, created, error };
  }
}

/** Cria as regras do pacote que faltam ("descrição contém"), só para categorias ativas. */
export async function applyRulePack(): Promise<ApplyResult<{ missingCategories: string[] }>> {
  let created = 0;
  try {
    const [categories, rules] = await Promise.all([
      listAllPages((query) => listCategories(query)),
      listAllPages((query) => listCategoryRules(query)),
    ]);
    const { toCreate, missingCategories } = rulesToCreate(categories.items, rules.items);
    for (const rule of toCreate) {
      await createCategoryRule({
        categoryId: rule.categoryId,
        conditionField: "description",
        conditionOperator: "contains",
        conditionValue: rule.conditionValue,
        priority: rule.priority,
      });
      created += 1;
    }
    return { ok: true, created, missingCategories };
  } catch (error) {
    return { ok: false, created, error };
  }
}
