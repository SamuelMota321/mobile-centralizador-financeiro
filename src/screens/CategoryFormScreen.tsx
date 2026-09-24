import { useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput } from "react-native";
import { useAuth } from "../auth/AuthContext";
import { isUnauthorized } from "../lib/accounts/messages";
import { listAllPages } from "../lib/api/pagination";
import { createCategory, listCategories, renameCategory } from "../lib/categories/api";
import type { Category } from "../lib/categories/types";
import { theme } from "../theme";
import {
  classifyCategoryError,
  DUPLICATE_NAME_MESSAGE,
  hasNameConflict,
  parseCategoryName,
} from "./category-logic";
import { Field, formStyles as styles } from "./movement-form-parts";

interface Props {
  /** Presente: renomeia esta categoria ativa. Ausente: cria uma nova. */
  category?: Category;
  onCancel: () => void;
  onDone: (message: string) => void;
}

export function CategoryFormScreen({ category, onCancel, onDone }: Props) {
  const { handleUnauthorized } = useAuth();
  const renaming = category !== undefined;
  const [name, setName] = useState(category?.name ?? "");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const inFlight = useRef(false);

  async function submit() {
    if (inFlight.current) return;
    setFormError(null);
    const parsed = parseCategoryName(name, [], category?.id);
    if (!parsed.ok) {
      setFieldError(parsed.message);
      return;
    }

    inFlight.current = true;
    setSubmitting(true);
    setFieldError(null);
    const fallback = renaming
      ? "Nao foi possivel renomear a categoria."
      : "Nao foi possivel criar a categoria.";
    try {
      if (await nameTaken(parsed.name, category?.id)) {
        setFieldError(DUPLICATE_NAME_MESSAGE);
        return;
      }
      if (category) {
        await renameCategory(category.id, { name: parsed.name });
        onDone("Categoria renomeada. As movimentacoes passam a mostrar o novo nome.");
      } else {
        await createCategory({ name: parsed.name });
        onDone("Categoria criada. Ela ja pode ser atribuida as suas movimentacoes.");
      }
    } catch (error) {
      const failure = classifyCategoryError(error, fallback);
      if (failure.kind === "unauthorized") {
        await handleUnauthorized();
      } else if (failure.kind === "unavailable") {
        onDone(failure.message);
      } else if (failure.kind === "field") {
        setFieldError(failure.message);
      } else {
        setFormError(failure.message);
      }
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title} accessibilityRole="header">
        {renaming ? "Renomear categoria" : "Nova categoria"}
      </Text>
      {renaming ? null : (
        <Text style={styles.helper}>
          Suas categorias sao pessoais: nenhuma vem pronta. Voce pode renomear ou arquivar
          depois.
        </Text>
      )}

      <Field label="Nome da categoria" error={fieldError ?? undefined}>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          maxLength={100}
          accessibilityLabel="Nome da categoria"
          editable={!submitting}
          autoFocus
        />
      </Field>

      {formError ? (
        <Text style={styles.formError} accessibilityLiveRegion="polite">
          {formError}
        </Text>
      ) : null}

      <Pressable
        style={[styles.primary, submitting && styles.primaryDisabled]}
        onPress={() => void submit()}
        disabled={submitting}
        accessibilityRole="button"
        accessibilityState={{ disabled: submitting, busy: submitting }}
      >
        {submitting ? (
          <ActivityIndicator color={theme.onAccent} />
        ) : (
          <Text style={styles.primaryLabel}>{renaming ? "Salvar nome" : "Criar categoria"}</Text>
        )}
      </Pressable>

      <Pressable
        style={styles.secondary}
        onPress={onCancel}
        disabled={submitting}
        accessibilityRole="button"
      >
        <Text style={styles.secondaryLabel}>Cancelar</Text>
      </Pressable>
    </ScrollView>
  );
}

/**
 * Verifica todas as categorias (a lista na tela e paginada). Se a listagem falhar por
 * outro motivo que nao sessao, o envio segue e o backend decide.
 */
async function nameTaken(name: string, exceptId: string | undefined): Promise<boolean> {
  try {
    const { items } = await listAllPages((query) => listCategories(query));
    return hasNameConflict(name, items, exceptId);
  } catch (error) {
    if (isUnauthorized(error)) throw error;
    return false;
  }
}
