import { useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput } from "react-native";
import { useAuth } from "../auth/AuthContext";
import { formatCivilDate, todayCivilDate } from "../lib/civil-date";
import { newIdempotencyKey } from "../lib/idempotency";
import { formatMoney } from "../lib/money";
import { createTransaction } from "../lib/transactions/api";
import type { MovementType } from "../lib/transactions/types";
import { theme } from "../theme";
import {
  accountChoices,
  ChoiceGroup,
  Field,
  formStyles as styles,
  selectedAccount,
} from "./movement-form-parts";
import { classifySubmitError, type FieldErrors, parseMovementFields } from "./movement-input";
import { accountLabel, type AccountOption } from "./movement-presentation";

const TYPE_OPTIONS: { value: MovementType; label: string }[] = [
  { value: "expense", label: "Despesa" },
  { value: "income", label: "Receita" },
];

interface Props {
  accounts: AccountOption[];
  onCancel: () => void;
  /** Volta para a lista, que recarrega e exibe a mensagem. */
  onDone: (message: string) => void;
  /** A conta escolhida deixou de estar ativa: recarrega a lista de contas. */
  onAccountsStale: () => void;
}

/** Receita ou despesa manual. */
export function MovementFormScreen({ accounts, onCancel, onDone, onAccountsStale }: Props) {
  const { handleUnauthorized } = useAuth();

  const [accountId, setAccountId] = useState(accounts.length === 1 ? accounts[0].id : "");
  const [type, setType] = useState<MovementType>("expense");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(() => formatCivilDate(todayCivilDate()));
  const [description, setDescription] = useState("");

  // Uma chave por formulario: a mesma em qualquer reenvio apos falha (o backend so a
  // registra quando cria a movimentacao); nova somente quando o backend a recusa. Apos
  // sucesso a tela fecha e o proximo formulario nasce com outra chave.
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey);
  // Bloqueia o toque duplo antes do re-render que desabilita o botao.
  const inFlight = useRef(false);

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const currentAccount = selectedAccount(accountId, accounts);

  async function submit() {
    if (inFlight.current) return;
    setFormError(null);

    const parsed = parseMovementFields({
      accountId: currentAccount,
      type,
      amount,
      date,
      description,
    });
    if (!parsed.ok) {
      setFieldErrors(parsed.fieldErrors);
      return;
    }

    inFlight.current = true;
    setSubmitting(true);
    setFieldErrors({});
    try {
      const transaction = await createTransaction(parsed.input, { idempotencyKey });
      const label = parsed.input.type === "income" ? "Receita" : "Despesa";
      const rule =
        transaction.categorizationSource === "rule"
          ? " A categoria foi aplicada por uma regra pessoal."
          : "";
      onDone(
        `${label} de ${formatMoney(transaction.amount)} registrada em ${accountLabel(transaction.accountId, accounts)}.${rule}`,
      );
    } catch (error) {
      const failure = classifySubmitError(error, "Nao foi possivel registrar a movimentacao.");
      if (failure.kind === "unauthorized") {
        await handleUnauthorized();
      } else if (failure.kind === "fields") {
        setFieldErrors(failure.fieldErrors);
      } else if (failure.kind === "accountUnavailable") {
        setFormError(failure.message);
        onAccountsStale();
      } else {
        setFormError(failure.message);
        if (failure.rotateKey) setIdempotencyKey(newIdempotencyKey());
      }
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title} accessibilityRole="header">
        Receita ou despesa
      </Text>

      <Field label="Conta" error={fieldErrors.accountId}>
        <ChoiceGroup
          label="Conta"
          options={accountChoices(accounts)}
          selected={currentAccount}
          onSelect={setAccountId}
          disabled={submitting}
        />
      </Field>

      <Field label="Tipo" error={fieldErrors.type}>
        <ChoiceGroup
          label="Tipo"
          options={TYPE_OPTIONS}
          selected={type}
          onSelect={setType}
          disabled={submitting}
        />
      </Field>

      <Field label="Valor (R$)" error={fieldErrors.amount}>
        <TextInput
          style={[styles.input, styles.amountInput]}
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          placeholder="0,00"
          placeholderTextColor={theme.muted}
          accessibilityLabel="Valor em reais"
          editable={!submitting}
        />
      </Field>

      <Field label="Data" error={fieldErrors.occurredOn}>
        <TextInput
          style={styles.input}
          value={date}
          onChangeText={setDate}
          keyboardType="numbers-and-punctuation"
          placeholder="DD/MM/AAAA"
          placeholderTextColor={theme.muted}
          accessibilityLabel="Data, no formato dia, mes e ano"
          maxLength={10}
          editable={!submitting}
        />
      </Field>

      <Field label="Descricao (opcional)" error={fieldErrors.description}>
        <TextInput
          style={styles.input}
          value={description}
          onChangeText={setDescription}
          accessibilityLabel="Descricao, opcional"
          editable={!submitting}
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
          <Text style={styles.primaryLabel}>Registrar movimentacao</Text>
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
