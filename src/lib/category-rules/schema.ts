import { z } from "zod";
import { MOVEMENT_TYPES } from "../transactions/types";
import { OPERATORS_BY_FIELD, RULE_CONDITION_FIELDS, RULE_OPERATORS } from "./types";

// Espelha o dominio do backend (@ backend fa9b62a): uma condicao por regra; `type`
// aceita income/expense e `accountId` um UUID, ambos somente com `equals`.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const conditionValueSchema = z
  .string()
  .transform((value) => value.replace(/\s+/g, " ").trim())
  .pipe(z.string().min(1, "Informe o valor da condicao"));

const prioritySchema = z
  .number("Informe a prioridade")
  .int("Use um numero inteiro")
  .min(0, "Use zero ou mais");

interface ConditionCandidate {
  conditionField?: (typeof RULE_CONDITION_FIELDS)[number];
  conditionOperator?: (typeof RULE_OPERATORS)[number];
  conditionValue?: string;
}

function checkCondition(value: ConditionCandidate, ctx: z.RefinementCtx): void {
  const { conditionField: field, conditionOperator: operator, conditionValue } = value;
  if (field && operator && !OPERATORS_BY_FIELD[field].includes(operator)) {
    ctx.addIssue({
      code: "custom",
      path: ["conditionOperator"],
      message: "Este campo aceita somente \"e igual a\"",
    });
  }
  if (field === "type" && conditionValue !== undefined) {
    if (!(MOVEMENT_TYPES as readonly string[]).includes(conditionValue.toLowerCase())) {
      ctx.addIssue({ code: "custom", path: ["conditionValue"], message: "Escolha receita ou despesa" });
    }
  }
  if (field === "accountId" && conditionValue !== undefined && !UUID.test(conditionValue)) {
    ctx.addIssue({ code: "custom", path: ["conditionValue"], message: "Escolha uma conta" });
  }
}

export const categoryRuleInputSchema = z
  .object({
    categoryId: z.uuid("Escolha uma categoria"),
    conditionField: z.enum(RULE_CONDITION_FIELDS),
    conditionOperator: z.enum(RULE_OPERATORS),
    conditionValue: conditionValueSchema,
    priority: prioritySchema,
  })
  .strict()
  .superRefine(checkCondition);

/**
 * PATCH parcial. A validacao cruzada de campo/operador/valor so e possivel com os tres
 * presentes; o formulario de edicao envia a condicao completa quando qualquer parte muda.
 */
export const categoryRuleUpdateSchema = z
  .object({
    categoryId: z.uuid("Escolha uma categoria").optional(),
    conditionField: z.enum(RULE_CONDITION_FIELDS).optional(),
    conditionOperator: z.enum(RULE_OPERATORS).optional(),
    conditionValue: conditionValueSchema.optional(),
    priority: prioritySchema.optional(),
  })
  .strict()
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: "Nenhuma alteracao para salvar",
  })
  .superRefine(checkCondition);

export const categoryRuleSchema = z.object({
  id: z.string(),
  categoryId: z.string(),
  conditionField: z.enum(RULE_CONDITION_FIELDS),
  conditionOperator: z.enum(RULE_OPERATORS),
  conditionValue: z.string(),
  priority: z.number().int(),
  status: z.enum(["active", "inactive", "removed"]),
  removedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const categoryRulePageSchema = z.object({
  items: z.array(categoryRuleSchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
});
