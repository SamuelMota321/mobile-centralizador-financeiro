// Alinhado a CategoryView, CreateCategory e UpdateCategory (@ backend e95d2af).

export type CategoryStatus = "active" | "archived";

/** Categoria pessoal do usuario. Arquivada continua no historico, mas nao e atribuivel. */
export interface Category {
  id: string;
  name: string;
  source: "user";
  status: CategoryStatus;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryPage {
  items: Category[];
  page: number;
  pageSize: number;
  total: number;
}

/**
 * Corpo de POST /categories e PATCH /categories/{id}. O banco exige nome unico por tenant
 * (exato, com diferenca de maiusculas, incluindo arquivadas); a violacao volta como
 * 409 CATEGORY_ALREADY_EXISTS (@ backend e95d2af).
 */
export interface CategoryInput {
  name: string;
}
