import { useRef, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { formatCivilDate, todayCivilDate } from "../lib/civil-date";
import { newIdempotencyKey } from "../lib/idempotency";
import { formatMoney } from "../lib/money";
import { createTransfer } from "../lib/transactions/api";
import { Button, Notice } from "../ui/controls";
import { ChoiceGroup, Field, TextField } from "../ui/fields";
import { FormScreen } from "../ui/screens";
import { accountChoices, selectedAccount } from "./movement-form-helpers";
import { classifySubmitError, type FieldErrors, parseTransferFields } from "./movement-input";
import { accountLabel, type AccountOption } from "./movement-presentation";

interface Props {
  accounts: AccountOption[];
  onCancel: () => void;
  onDone: (message: string) => void;
  onAccountsStale: () => void;
}

/** Transferência entre contas do próprio usuário: registro contábil, nada é movimentado (RN-005). */
export function TransferFormScreen({ accounts, onCancel, onDone, onAccountsStale }: Props) {
  const { handleUnauthorized } = useAuth();

  const [fromAccountId, setFromAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(() => formatCivilDate(todayCivilDate()));
  const [description, setDescription] = useState("");

  // Mesmas regras de chave do formulário de receita/despesa.
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
        `Registro contábil criado: saída de ${value} em ${accountLabel(outgoing.accountId, accounts)} e entrada do mesmo valor em ${accountLabel(incoming.accountId, accounts)}.`,
      );
    } catch (error) {
      const failure = classifySubmitError(error, "Não foi possível registrar a transferência.");
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
    <FormScreen
      title="Transferência entre contas"
      description="Registra que um valor passou de uma conta sua para outra conta sua. É apenas um registro no Coinciente: nenhum dinheiro é movimentado."
      onCancel={onCancel}
      cancelDisabled={submitting}
      footer={<Button label="Registrar transferência" onPress={() => void submit()} loading={submitting} />}
    >
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

      <TextField
        label="Valor (R$)"
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
        placeholder="0,00"
        accessibilityLabel="Valor em reais"
        style={{ fontVariant: ["tabular-nums"] }}
        error={fieldErrors.amount}
        editable={!submitting}
      />

      <TextField
        label="Data"
        value={date}
        onChangeText={setDate}
        keyboardType="numbers-and-punctuation"
        placeholder="DD/MM/AAAA"
        maxLength={10}
        accessibilityLabel="Data, no formato dia, mês e ano"
        error={fieldErrors.occurredOn}
        editable={!submitting}
      />

      <TextField
        label="Descrição (opcional)"
        value={description}
        onChangeText={setDescription}
        error={fieldErrors.description}
        editable={!submitting}
      />

      {formError ? <Notice tone="error" text={formError} /> : null}
    </FormScreen>
  );
}
