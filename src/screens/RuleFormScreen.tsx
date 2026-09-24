import { useRef, useState } from "react";
import { Text, View } from "react-native";
import { useAuth } from "../auth/AuthContext";
import { createCategoryRule, updateCategoryRule } from "../lib/category-rules/api";
import { RULE_CONDITION_FIELDS, type CategoryRule, type RuleConditionField } from "../lib/category-rules/types";
import { makeStyles, radius, type } from "../theme";
import { Button, Notice } from "../ui/controls";
import { ChoiceGroup, Field, TextField } from "../ui/fields";
import { FormScreen } from "../ui/screens";
import {
  buildRulePatch,
  changeField,
  classifyRuleError,
  EMPTY_RULE_VALUES,
  FIELD_LABELS,
  type FieldErrors,
  isDirty,
  type NamedOption,
  OPERATOR_LABELS,
  operatorsFor,
  parseRuleForm,
  ruleCondition,
  type RuleFormValues,
  TYPE_VALUE_LABELS,
  valuesFromRule,
} from "./rule-logic";

interface Props {
  /** Presente: edita esta regra (ativa ou inativa). Ausente: cria uma nova. */
  rule?: CategoryRule;
  /** Somente categorias e contas ativas são oferecidas. */
  categories: NamedOption[];
  accounts: NamedOption[];
  onCancel: () => void;
  onDone: (message: string) => void;
  /** Regra, categoria ou conta indisponível: volta para a lista, que recarrega. */
  onStale: (message: string) => void;
}

export function RuleFormScreen({ rule, categories, accounts, onCancel, onDone, onStale }: Props) {
  const { handleUnauthorized } = useAuth();
  const styles = useStyles();
  const editing = rule !== undefined;
  const [values, setValues] = useState<RuleFormValues>(rule ? valuesFromRule(rule) : EMPTY_RULE_VALUES);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const inFlight = useRef(false);

  const field = (RULE_CONDITION_FIELDS as readonly string[]).includes(values.conditionField)
    ? (values.conditionField as RuleConditionField)
    : "description";
  const operators = operatorsFor(field);
  const operator = operators.find((option) => option === values.conditionOperator) ?? operators[0];
  const dirty = rule ? isDirty(rule, values) : true;
  const set = (key: keyof RuleFormValues) => (value: string) => setValues({ ...values, [key]: value });

  const categoryName = categories.find((category) => category.id === values.categoryId)?.name;
  const preview =
    values.conditionValue.trim() && categoryName
      ? `${ruleCondition(
          { conditionField: field, conditionOperator: operator, conditionValue: values.conditionValue.trim() },
          accounts,
        )} → ${categoryName}`
      : null;

  async function submit() {
    if (inFlight.current) return;
    setFormError(null);
    const parsed = parseRuleForm({ ...values, conditionOperator: operator });
    if (!parsed.ok) {
      setFieldErrors(parsed.fieldErrors);
      return;
    }

    const patch = rule ? buildRulePatch(rule, parsed.input) : null;
    if (rule && !patch) {
      setFormError("Nenhuma alteração para salvar.");
      return;
    }

    inFlight.current = true;
    setSubmitting(true);
    setFieldErrors({});
    const fallback = editing ? "Não foi possível salvar a regra." : "Não foi possível criar a regra.";
    try {
      if (rule && patch) {
        await updateCategoryRule(rule.id, patch);
        onDone("Regra atualizada. Ela vale para as próximas movimentações; as já registradas não mudam.");
      } else {
        await createCategoryRule(parsed.input);
        onDone("Regra criada. Ela vale para as próximas movimentações; as já registradas não mudam.");
      }
    } catch (error) {
      const failure = classifyRuleError(error, fallback);
      if (failure.kind === "unauthorized") {
        await handleUnauthorized();
      } else if (failure.kind === "stale") {
        onStale(failure.message);
      } else if (failure.kind === "fields") {
        if (failure.clearCategory) setValues((current) => ({ ...current, categoryId: "" }));
        setFieldErrors(failure.fieldErrors);
      } else {
        setFormError(failure.message);
      }
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  }

  return (
    <FormScreen
      title={editing ? "Editar regra" : "Nova regra"}
      description="Uma condição por regra. Ela categoriza as próximas movimentações que combinarem."
      onCancel={onCancel}
      cancelDisabled={submitting}
      footer={
        <Button
          label={editing ? "Salvar regra" : "Criar regra"}
          onPress={() => void submit()}
          loading={submitting}
          disabled={!dirty}
        />
      }
    >
      <Field label="Quando" error={fieldErrors.conditionField}>
        <ChoiceGroup
          label="Quando"
          options={RULE_CONDITION_FIELDS.map((value) => ({ value, label: FIELD_LABELS[value] }))}
          selected={field}
          onSelect={(next) => setValues(changeField(values, next))}
          disabled={submitting}
        />
      </Field>

      <Field label="Comparação" error={fieldErrors.conditionOperator}>
        <ChoiceGroup
          label="Comparação"
          options={operators.map((value) => ({ value, label: OPERATOR_LABELS[value] }))}
          selected={operator}
          onSelect={set("conditionOperator")}
          disabled={submitting}
        />
      </Field>

      {field === "description" ? (
        <TextField
          label="Texto"
          value={values.conditionValue}
          onChangeText={set("conditionValue")}
          placeholder="Ex.: mercado"
          autoCapitalize="none"
          error={fieldErrors.conditionValue}
          editable={!submitting}
        />
      ) : (
        <Field
          label={field === "type" ? "Tipo de movimentação" : "Conta"}
          error={fieldErrors.conditionValue}
        >
          <ChoiceGroup
            label={field === "type" ? "Tipo de movimentação" : "Conta"}
            options={
              field === "type"
                ? Object.entries(TYPE_VALUE_LABELS).map(([value, label]) => ({ value, label }))
                : accounts.map((account) => ({ value: account.id, label: account.name }))
            }
            selected={field === "type" ? values.conditionValue.toLowerCase() : values.conditionValue}
            onSelect={set("conditionValue")}
            disabled={submitting}
          />
        </Field>
      )}

      <Field label="Aplicar a categoria" error={fieldErrors.categoryId}>
        <ChoiceGroup
          label="Aplicar a categoria"
          options={categories.map((category) => ({ value: category.id, label: category.name }))}
          selected={categories.some((category) => category.id === values.categoryId) ? values.categoryId : ""}
          onSelect={set("categoryId")}
          disabled={submitting}
        />
      </Field>

      <TextField
        label="Prioridade"
        value={values.priority}
        onChangeText={set("priority")}
        keyboardType="number-pad"
        help="Número inteiro, 0 ou mais. A maior vence."
        style={{ fontVariant: ["tabular-nums"] }}
        error={fieldErrors.priority}
        editable={!submitting}
      />

      {preview ? (
        <View style={styles.preview} accessibilityLiveRegion="polite">
          <Text style={styles.previewLabel}>Como a regra fica</Text>
          <Text style={styles.previewText}>{preview}</Text>
        </View>
      ) : null}

      {editing && !dirty ? <Text style={styles.hint}>Altere algum campo para salvar.</Text> : null}
      {formError ? <Notice tone={formError.startsWith("Nenhuma") ? "info" : "error"} text={formError} /> : null}
    </FormScreen>
  );
}

const useStyles = makeStyles((c) => ({
  preview: {
    gap: 2,
    padding: 14,
    borderRadius: radius.control,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: c.primary,
    backgroundColor: c.primaryTint,
  },
  previewLabel: { ...type.micro, color: c.muted },
  previewText: { ...type.bodySmall, fontFamily: "Manrope_700Bold", color: c.foreground },
  hint: { ...type.micro, fontFamily: "Manrope_500Medium", color: c.muted },
}));
