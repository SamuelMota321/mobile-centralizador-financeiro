// Alinhado a CategoryView, CreateCategory e UpdateCategory (@ backend fa9b62a).

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
 * (exato, com diferenca de maiusculas, incluindo arquivadas); o backend @ fa9b62a nao
 * mapeia a violacao e responde 500 — por isso os clientes verificam antes de enviar.
 */
export interface CategoryInput {
  name: string;
}
