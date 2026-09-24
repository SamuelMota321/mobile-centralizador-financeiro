import { useRef, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { isUnauthorized } from "../lib/accounts/messages";
import { listAllPages } from "../lib/api/pagination";
import { createCategory, listCategories, renameCategory } from "../lib/categories/api";
import type { Category } from "../lib/categories/types";
import { Button, Notice } from "../ui/controls";
import { TextField } from "../ui/fields";
import { FormScreen } from "../ui/screens";
import {
  classifyCategoryError,
  DUPLICATE_NAME_MESSAGE,
  hasNameConflict,
  parseCategoryName,
} from "./category-logic";

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
      ? "Não foi possível renomear a categoria."
      : "Não foi possível criar a categoria.";
    try {
      if (await nameTaken(parsed.name, category?.id)) {
        setFieldError(DUPLICATE_NAME_MESSAGE);
        return;
      }
      if (category) {
        await renameCategory(category.id, { name: parsed.name });
        onDone("Categoria renomeada. As movimentações passam a mostrar o novo nome.");
      } else {
        await createCategory({ name: parsed.name });
        onDone("Categoria criada. Ela já pode ser atribuída às suas movimentações.");
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
    <FormScreen
      title={renaming ? "Renomear categoria" : "Nova categoria"}
      description={
        renaming
          ? "As movimentações já categorizadas passam a mostrar o novo nome."
          : "Categorias são pessoais: nenhuma vem pronta. Use nomes que façam sentido para você."
      }
      onCancel={onCancel}
      cancelDisabled={submitting}
      footer={
        <Button
          label={renaming ? "Salvar nome" : "Criar categoria"}
          onPress={() => void submit()}
          loading={submitting}
        />
      }
    >
      <TextField
        label="Nome"
        value={name}
        onChangeText={setName}
        maxLength={100}
        placeholder="Ex.: Alimentação"
        error={fieldError ?? undefined}
        editable={!submitting}
        autoFocus
      />
      {formError ? <Notice tone="error" text={formError} /> : null}
    </FormScreen>
  );
}

/**
 * Verifica todas as categorias (a lista na tela é paginada). Se a listagem falhar por
 * outro motivo que não sessão, o envio segue e o backend decide.
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
