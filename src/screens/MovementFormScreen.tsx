import { useRef, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { formatCivilDate, todayCivilDate } from "../lib/civil-date";
import { newIdempotencyKey } from "../lib/idempotency";
import { formatMoney } from "../lib/money";
import { createTransaction } from "../lib/transactions/api";
import type { MovementType } from "../lib/transactions/types";
import { Button, Notice } from "../ui/controls";
import { ChoiceGroup, Field, TextField } from "../ui/fields";
import { FormScreen } from "../ui/screens";
import { accountChoices, selectedAccount } from "./movement-form-helpers";
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
  const [movementType, setMovementType] = useState<MovementType>("expense");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(() => formatCivilDate(todayCivilDate()));
  const [description, setDescription] = useState("");

  // Uma chave por formulário: a mesma em qualquer reenvio após falha (o backend só a
  // registra quando cria a movimentação); nova somente quando o backend a recusa. Após
  // sucesso a tela fecha e o próximo formulário nasce com outra chave.
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey);
  // Bloqueia o toque duplo antes do re-render que desabilita o botão.
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
      type: movementType,
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
      const failure = classifySubmitError(error, "Não foi possível registrar a movimentação.");
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
    <FormScreen
      title="Receita ou despesa"
      description="A movimentação aparece no histórico assim que o registro é confirmado."
      onCancel={onCancel}
      cancelDisabled={submitting}
      footer={<Button label="Registrar movimentação" onPress={() => void submit()} loading={submitting} />}
    >
      <Field label="Tipo" error={fieldErrors.type}>
        <ChoiceGroup
          label="Tipo"
          options={TYPE_OPTIONS}
          selected={movementType}
          onSelect={setMovementType}
          disabled={submitting}
        />
      </Field>

      <Field label="Conta" error={fieldErrors.accountId}>
        <ChoiceGroup
          label="Conta"
          options={accountChoices(accounts)}
          selected={currentAccount}
          onSelect={setAccountId}
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
        placeholder="Ex.: Mercado do bairro"
        error={fieldErrors.description}
        editable={!submitting}
      />

      {formError ? <Notice tone="error" text={formError} /> : null}
    </FormScreen>
  );
}
