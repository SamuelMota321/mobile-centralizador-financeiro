import { useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text } from "react-native";
import { useAuth } from "../auth/AuthContext";
import { formatCivilDate } from "../lib/civil-date";
import { updateTransactionCategory } from "../lib/transactions/api";
import type { Transaction, TransactionCategoryUpdate } from "../lib/transactions/types";
import { theme } from "../theme";
import { classifyCategorizeError } from "./category-logic";
import { ChoiceGroup, Field, formStyles as styles } from "./movement-form-parts";
import { type CategoryOption, signedAmount } from "./movement-presentation";

interface Props {
  transaction: Transaction;
  /** Somente categorias ativas: arquivadas nunca sao oferecidas. */
  activeCategories: CategoryOption[];
  truncated: boolean;
  onCancel: () => void;
  /** Recebe a TransactionView devolvida pela API, nunca uma suposicao local. */
  onDone: (updated: Transaction, message: string) => void;
  /** A lista (categorias ou movimentacoes) mudou: volta e recarrega com a mensagem. */
  onStale: (message: string) => void;
  onGoToCategories: () => void;
}

type Pending = "category" | "uncertain" | "unrecognized" | null;

export function CategorizeScreen({
  transaction,
  activeCategories,
  truncated,
  onCancel,
  onDone,
  onStale,
  onGoToCategories,
}: Props) {
  const { handleUnauthorized } = useAuth();
  const initial = activeCategories.some((category) => category.id === transaction.categoryId)
    ? (transaction.categoryId ?? "")
    : "";
  const [categoryId, setCategoryId] = useState(initial);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending>(null);
  const inFlight = useRef(false);

  async function submit(intent: Exclude<Pending, null>) {
    if (inFlight.current) return;
    setFormError(null);
    if (intent === "category" && !categoryId) {
      setFieldError("Escolha uma categoria ativa.");
      return;
    }
    const update: TransactionCategoryUpdate =
      intent === "category" ? { categoryId } : { categorizationStatus: intent };

    inFlight.current = true;
    setPending(intent);
    setFieldError(null);
    try {
      const updated = await updateTransactionCategory(transaction.id, update);
      onDone(
        updated,
        intent === "category"
          ? "Categoria atualizada."
          : intent === "uncertain"
            ? "Movimentacao marcada como categoria incerta."
            : "Movimentacao marcada como nao reconhecida.",
      );
    } catch (error) {
      const failure = classifyCategorizeError(error);
      if (failure.kind === "unauthorized") {
        await handleUnauthorized();
      } else if (failure.kind === "refresh") {
        onStale(failure.message);
      } else {
        setFormError(failure.message);
      }
    } finally {
      inFlight.current = false;
      setPending(null);
    }
  }

  const busy = pending !== null;

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title} accessibilityRole="header">
        {transaction.categorizationStatus === "unclassified" ? "Categorizar" : "Corrigir categoria"}
      </Text>
      <Text style={styles.helper}>
        {transaction.description ?? "Sem descricao"} · {formatCivilDate(transaction.occurredOn)} ·{" "}
        {signedAmount(transaction).text}
      </Text>

      {activeCategories.length === 0 ? (
        <>
          <Text style={styles.helper}>Voce ainda nao tem categorias ativas.</Text>
          <Pressable style={styles.secondary} onPress={onGoToCategories} accessibilityRole="button">
            <Text style={styles.secondaryLabel}>Criar uma categoria</Text>
          </Pressable>
        </>
      ) : (
        <Field label="Categoria" error={fieldError ?? undefined}>
          <ChoiceGroup
            label="Categoria"
            options={activeCategories.map((category) => ({ value: category.id, label: category.name }))}
            selected={categoryId}
            onSelect={setCategoryId}
            disabled={busy}
          />
          {truncated ? (
            <Text style={styles.helper}>Apenas as primeiras categorias aparecem nesta lista.</Text>
          ) : null}
        </Field>
      )}

      <Text style={styles.helper}>
        Se nao souber a categoria agora, marque como incerta ou nao reconhecida. Voce pode
        corrigir depois.
      </Text>

      {formError ? (
        <Text style={styles.formError} accessibilityLiveRegion="polite">
          {formError}
        </Text>
      ) : null}

      {activeCategories.length > 0 ? (
        <Pressable
          style={[styles.primary, busy && styles.primaryDisabled]}
          onPress={() => void submit("category")}
          disabled={busy}
          accessibilityRole="button"
          accessibilityState={{ disabled: busy, busy: pending === "category" }}
        >
          {pending === "category" ? (
            <ActivityIndicator color={theme.onAccent} />
          ) : (
            <Text style={styles.primaryLabel}>Aplicar categoria</Text>
          )}
        </Pressable>
      ) : null}

      <Pressable
        style={styles.secondary}
        onPress={() => void submit("uncertain")}
        disabled={busy}
        accessibilityRole="button"
        accessibilityState={{ disabled: busy, busy: pending === "uncertain" }}
      >
        <Text style={styles.secondaryLabel}>Marcar como incerta</Text>
      </Pressable>

      <Pressable
        style={styles.secondary}
        onPress={() => void submit("unrecognized")}
        disabled={busy}
        accessibilityRole="button"
        accessibilityState={{ disabled: busy, busy: pending === "unrecognized" }}
      >
        <Text style={styles.secondaryLabel}>Marcar como nao reconhecida</Text>
      </Pressable>

      <Pressable onPress={onCancel} disabled={busy} accessibilityRole="button" hitSlop={8}>
        <Text style={[styles.helper, { textAlign: "center", textDecorationLine: "underline" }]}>
          Cancelar
        </Text>
      </Pressable>
    </ScrollView>
  );
}
