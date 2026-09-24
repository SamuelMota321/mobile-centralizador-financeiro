import { useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput } from "react-native";
import { useAuth } from "../auth/AuthContext";
import { formatCivilDate, todayCivilDate } from "../lib/civil-date";
import { newIdempotencyKey } from "../lib/idempotency";
import { formatMoney } from "../lib/money";
import { createTransfer } from "../lib/transactions/api";
import { theme } from "../theme";
import {
  accountChoices,
  ChoiceGroup,
  Field,
  formStyles as styles,
  selectedAccount,
} from "./movement-form-parts";
import { classifySubmitError, type FieldErrors, parseTransferFields } from "./movement-input";
import { accountLabel, type AccountOption } from "./movement-presentation";

interface Props {
  accounts: AccountOption[];
  onCancel: () => void;
  onDone: (message: string) => void;
  onAccountsStale: () => void;
}

/** Transferencia entre contas do proprio usuario: registro contabil, nada e movimentado (RN-005). */
export function TransferFormScreen({ accounts, onCancel, onDone, onAccountsStale }: Props) {
  const { handleUnauthorized } = useAuth();

  const [fromAccountId, setFromAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(() => formatCivilDate(todayCivilDate()));
  const [description, setDescription] = useState("");

  // Mesmas regras de chave do formulario de receita/despesa.
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey);
  const inFlight = useRef(false);

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const currentFrom = selectedAccount(fromAccountId, accounts);
  const currentTo = selectedAccount(toAccountId, accounts);

  async function submit() {
    if (inFlight.current) return;
    setFormError(null);

    const parsed = parseTransferFields({
      fromAccountId: currentFrom,
      toAccountId: currentTo,
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
      const transfer = await createTransfer(parsed.input, { idempotencyKey });
      const outgoing =
        transfer.entries.find((entry) => entry.transferSide === "outgoing") ?? transfer.entries[0];
      const incoming =
        transfer.entries.find((entry) => entry.transferSide === "incoming") ?? transfer.entries[1];
      const value = formatMoney(outgoing.amount);
      onDone(
        `Registro contabil criado: saida de ${value} em ${accountLabel(outgoing.accountId, accounts)} e entrada de ${value} em ${accountLabel(incoming.accountId, accounts)}.`,
      );
    } catch (error) {
      const failure = classifySubmitError(error, "Nao foi possivel registrar a transferencia.");
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

  const choices = accountChoices(accounts);

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title} accessibilityRole="header">
        Transferencia entre contas
      </Text>
      <Text style={styles.helper}>
        Registra que um valor passou de uma conta sua para outra conta sua. E apenas um
        registro no Coinciente: nenhum dinheiro e movimentado.
      </Text>

      <Field label="Conta de origem" error={fieldErrors.fromAccountId}>
        <ChoiceGroup
          label="Conta de origem"
          options={choices}
          selected={currentFrom}
          onSelect={setFromAccountId}
          disabled={submitting}
        />
      </Field>

      <Field label="Conta de destino" error={fieldErrors.toAccountId}>
        <ChoiceGroup
          label="Conta de destino"
          options={choices}
          selected={currentTo}
          onSelect={setToAccountId}
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
          <Text style={styles.primaryLabel}>Registrar transferencia</Text>
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
