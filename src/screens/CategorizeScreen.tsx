import { useRef, useState } from "react";
import { Text, View } from "react-native";
import { useAuth } from "../auth/AuthContext";
import { formatCivilDate } from "../lib/civil-date";
import { updateTransactionCategory } from "../lib/transactions/api";
import type { Transaction, TransactionCategoryUpdate } from "../lib/transactions/types";
import { makeStyles, radius, type } from "../theme";
import { Button, Notice } from "../ui/controls";
import { ChoiceGroup, Field } from "../ui/fields";
import { FormScreen } from "../ui/screens";
import { classifyCategorizeError } from "./category-logic";
import { type CategoryOption, signedAmount } from "./movement-presentation";

interface Props {
  transaction: Transaction;
  /** Somente categorias ativas: arquivadas nunca são oferecidas. */
  activeCategories: CategoryOption[];
  truncated: boolean;
  onCancel: () => void;
  /** Recebe a TransactionView devolvida pela API, nunca uma suposição local. */
  onDone: (updated: Transaction, message: string) => void;
  /** A lista (categorias ou movimentações) mudou: volta e recarrega com a mensagem. */
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
  const styles = useStyles();
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
            ? "Movimentação marcada como categoria incerta."
            : "Movimentação marcada como não reconhecida.",
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
  const hasCategories = activeCategories.length > 0;

  return (
    <FormScreen
      title={transaction.categorizationStatus === "unclassified" ? "Categorizar" : "Corrigir categoria"}
      description="Se não souber agora, marque como incerta ou não reconhecida e corrija depois."
      onCancel={onCancel}
      cancelDisabled={busy}
      footer={
        <>
          {hasCategories ? (
            <Button
              label="Aplicar categoria"
              onPress={() => void submit("category")}
              loading={pending === "category"}
              disabled={busy}
            />
          ) : null}
          <View style={styles.secondaryActions}>
            <View style={styles.flex}>
              <Button
                variant="secondary"
                label="Incerta"
                accessibilityLabel="Marcar como categoria incerta"
                onPress={() => void submit("uncertain")}
                loading={pending === "uncertain"}
                disabled={busy}
                compact
              />
            </View>
            <View style={styles.flex}>
              <Button
                variant="secondary"
                label="Não reconhecida"
                accessibilityLabel="Marcar como não reconhecida"
                onPress={() => void submit("unrecognized")}
                loading={pending === "unrecognized"}
                disabled={busy}
                compact
              />
            </View>
          </View>
        </>
      }
    >
      <View style={styles.summary} accessible>
        <Text style={styles.summaryTitle} numberOfLines={2}>
          {transaction.description ?? "Sem descrição"}
        </Text>
        <Text style={styles.summaryMeta}>
          {formatCivilDate(transaction.occurredOn)} · {signedAmount(transaction).text}
        </Text>
      </View>

      {hasCategories ? (
        <Field
          label="Categoria"
          error={fieldError ?? undefined}
          help={truncated ? "Apenas as primeiras categorias aparecem nesta lista." : undefined}
        >
          <ChoiceGroup
            label="Categoria"
            options={activeCategories.map((category) => ({ value: category.id, label: category.name }))}
            selected={categoryId}
            onSelect={setCategoryId}
            disabled={busy}
          />
        </Field>
      ) : (
        <Notice
          tone="info"
          text="Você ainda não tem categorias ativas. Crie uma para organizar esta movimentação."
          action={{ label: "Criar uma categoria", onPress: onGoToCategories }}
        />
      )}

      {formError ? <Notice tone="error" text={formError} /> : null}
    </FormScreen>
  );
}

const useStyles = makeStyles((c) => ({
  summary: {
    gap: 4,
    padding: 16,
    borderRadius: radius.panel,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.surface,
  },
  summaryTitle: { ...type.body, fontFamily: "Manrope_700Bold", color: c.foreground },
  summaryMeta: { ...type.bodySmall, color: c.muted, fontVariant: ["tabular-nums"] },
  secondaryActions: { flexDirection: "row", gap: 10 },
  flex: { flex: 1 },
}));
