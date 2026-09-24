import { isUnauthorized } from "../lib/accounts/messages";
import { PROBLEM_CODES, ProblemDetailsError } from "../lib/api/errors";
import { categoryNameSchema } from "../lib/categories/schema";
import type { Category, CategoryStatus } from "../lib/categories/types";
import { transactionsErrorMessage } from "../lib/transactions/messages";

export const CATEGORY_STATUS_LABELS: Record<CategoryStatus, string> = {
  active: "Ativa",
  archived: "Arquivada",
};

export const DUPLICATE_NAME_MESSAGE =
  "Voce ja tem uma categoria com este nome (inclusive arquivada). Use outro nome.";

/**
 * Espelha o indice unico do banco (tenant_id, name): comparacao exata do nome ja
 * normalizado, diferenciando maiusculas e incluindo arquivadas. O backend @ fa9b62a
 * responde 500 para a violacao, por isso a tela verifica antes de enviar.
 */
export function hasNameConflict(
  normalizedName: string,
  categories: Pick<Category, "id" | "name">[],
  exceptId?: string,
): boolean {
  return categories.some(
    (category) => category.id !== exceptId && category.name === normalizedName,
  );
}

export type ParsedName = { ok: true; name: string } | { ok: false; message: string };

export function parseCategoryName(
  raw: string,
  categories: Pick<Category, "id" | "name">[],
  exceptId?: string,
): ParsedName {
  const parsed = categoryNameSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: `${parsed.error.issues[0]?.message ?? "Informe um nome valido"}.` };
  }
  if (hasNameConflict(parsed.data, categories, exceptId)) {
    return { ok: false, message: DUPLICATE_NAME_MESSAGE };
  }
  return { ok: true, name: parsed.data };
}

export type CategoryFailure =
  | { kind: "unauthorized" }
  | { kind: "unavailable"; message: string }
  | { kind: "field"; message: string }
  | { kind: "message"; message: string };

/** Falhas ao criar, renomear ou arquivar uma categoria. */
export function classifyCategoryError(error: unknown, fallback: string): CategoryFailure {
  if (isUnauthorized(error)) return { kind: "unauthorized" };
  if (error instanceof ProblemDetailsError) {
    if (
      error.code === PROBLEM_CODES.categoryNotFound ||
      error.code === PROBLEM_CODES.categoryArchived
    ) {
      return { kind: "unavailable", message: transactionsErrorMessage(error, fallback) };
    }
    if (error.status === 400) {
      // 400 sem `errors[]` na renomeacao indica categoria arquivada (InvalidCategoryState).
      return (error.problem.errors ?? []).some((item) => item.path === "name")
        ? { kind: "field", message: "Use um nome entre 1 e 100 caracteres." }
        : {
            kind: "unavailable",
            message: "Esta categoria nao pode ser alterada. Se ela foi arquivada, atualize a lista.",
          };
    }
    if (error.code === PROBLEM_CODES.identityContextUnavailable) {
      return { kind: "message", message: transactionsErrorMessage(error, fallback) };
    }
  }
  // Inclui o 500 do nome repetido por corrida entre dois envios.
  return {
    kind: "message",
    message: `${fallback} Se ja existe uma categoria com este nome, use outro. Tente de novo.`,
  };
}

export type CategorizeFailure =
  | { kind: "unauthorized" }
  /** A lista de categorias ou de movimentacoes precisa ser recarregada. */
  | { kind: "refresh"; message: string }
  | { kind: "message"; message: string };

const CATEGORIZE_FALLBACK = "Nao foi possivel atualizar a categoria. Tente de novo.";

export function classifyCategorizeError(error: unknown): CategorizeFailure {
  if (isUnauthorized(error)) return { kind: "unauthorized" };
  if (error instanceof ProblemDetailsError) {
    switch (error.code) {
      case PROBLEM_CODES.categoryArchived:
        return {
          kind: "refresh",
          message:
            "Esta categoria foi arquivada e nao pode mais ser atribuida. A lista foi atualizada; escolha outra.",
        };
      case PROBLEM_CODES.categoryNotFound:
      case PROBLEM_CODES.transactionNotFound:
      case PROBLEM_CODES.transactionCategorizationNotAllowed:
        return { kind: "refresh", message: transactionsErrorMessage(error, CATEGORIZE_FALLBACK) };
      case PROBLEM_CODES.identityContextUnavailable:
        return { kind: "message", message: transactionsErrorMessage(error, CATEGORIZE_FALLBACK) };
    }
  }
  return { kind: "message", message: CATEGORIZE_FALLBACK };
}
