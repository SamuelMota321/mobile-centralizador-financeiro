import { z } from "zod";

// Mesma normalizacao do backend: espacos colapsados; 1 a 100 caracteres.
export const categoryNameSchema = z
  .string()
  .transform((value) => value.replace(/\s+/g, " ").trim())
  .pipe(
    z
      .string()
      .min(1, "Informe um nome para a categoria")
      .max(100, "Use até 100 caracteres"),
  );

export const categoryInputSchema = z.object({ name: categoryNameSchema }).strict();

export const categorySchema = z.object({
  id: z.string(),
  name: z.string(),
  source: z.literal("user"),
  status: z.enum(["active", "archived"]),
  archivedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const categoryPageSchema = z.object({
  items: z.array(categorySchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
});
