import { useState } from "react";
import { View } from "react-native";
import { useAuth } from "../auth/AuthContext";
import {
  createAccount,
  PossibleDuplicateAccountError,
  updateAccount,
} from "../lib/accounts/api";
import {
  ACCOUNT_UNAVAILABLE_MESSAGE,
  accountErrorMessage,
  fieldErrorsFromProblem,
  isAccountUnavailable,
  isUnauthorized,
} from "../lib/accounts/messages";
import { buildAccountPatch } from "../lib/accounts/patch";
import { manualAccountInputSchema } from "../lib/accounts/schema";
import {
  ACCOUNT_TYPES,
  type Account,
  type AccountType,
  type DuplicateCandidate,
} from "../lib/accounts/types";
import { formatCivilDate, parseBrazilianDate } from "../lib/civil-date";
import { makeStyles } from "../theme";
import { Button, Notice } from "../ui/controls";
import { ChoiceGroup, Field, TextField } from "../ui/fields";
import { FormScreen } from "../ui/screens";
import { ACCOUNT_TYPE_LABELS } from "./account-type-labels";

interface Props {
  /** Presente: edita esta conta manual. Ausente: cria uma conta nova. */
  account?: Account;
  onCancel: () => void;
  /** Volta para a lista, que recarrega e exibe a mensagem. */
  onDone: (message: string) => void;
}

export function AccountFormScreen({ account, onCancel, onDone }: Props) {
  const { handleUnauthorized } = useAuth();
  const styles = useStyles();
  const editing = account !== undefined;

  const [name, setName] = useState(account?.name ?? "");
  const [accountType, setAccountType] = useState<AccountType>(account?.type ?? "checking");
  const [institutionName, setInstitutionName] = useState(account?.institutionName ?? "");
  const [initialBalance, setInitialBalance] = useState(account?.initialBalance ?? "");
  // Entrada em DD/MM/AAAA, como nos demais formulários; o contrato recebe AAAA-MM-DD.
  const [balanceDate, setBalanceDate] = useState(
    account ? formatCivilDate(account.initialBalanceAsOf) : "",
  );

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [duplicates, setDuplicates] = useState<DuplicateCandidate[] | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(confirmPossibleDuplicate: boolean) {
    setSubmitting(true);
    setFormError(null);
    setInfo(null);
    setFieldErrors({});

    const parsed = manualAccountInputSchema.safeParse({
      name,
      type: accountType,
      institutionName,
      initialBalance,
      initialBalanceAsOf: parseBrazilianDate(balanceDate) ?? balanceDate,
      confirmPossibleDuplicate,
    });

    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "");
        if (key && !errors[key]) errors[key] = issue.message;
      }
      setFieldErrors(errors);
      setSubmitting(false);
      return;
    }

    const fallback = editing ? "Não foi possível salvar a conta." : "Não foi possível criar a conta.";

    try {
      if (account) {
        const patch = buildAccountPatch(account, parsed.data);
        if (!patch) {
          setInfo("Nenhuma alteração para salvar.");
          return;
        }
        if (confirmPossibleDuplicate) patch.confirmPossibleDuplicate = true;
        await updateAccount(account.id, patch);
        onDone("Conta atualizada.");
      } else {
        await createAccount(parsed.data);
        onDone("Conta criada. Ela já pode receber movimentações.");
      }
    } catch (error) {
      if (error instanceof PossibleDuplicateAccountError) {
        setDuplicates(error.candidates);
      } else if (isUnauthorized(error)) {
        await handleUnauthorized();
      } else if (isAccountUnavailable(error)) {
        onDone(ACCOUNT_UNAVAILABLE_MESSAGE);
      } else {
        const serverFieldErrors = fieldErrorsFromProblem(error);
        if (Object.keys(serverFieldErrors).length > 0) {
          setFieldErrors(serverFieldErrors);
        } else {
          setFormError(accountErrorMessage(error, fallback));
        }
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <FormScreen
      title={editing ? "Editar conta" : "Nova conta manual"}
      description={
        editing
          ? undefined
          : "Registre uma conta que não está conectada. O saldo inicial vale a partir da data de referência."
      }
      onCancel={onCancel}
      cancelDisabled={submitting}
      footer={
        <Button
          label={editing ? "Salvar alterações" : "Criar conta"}
          onPress={() => void submit(false)}
          loading={submitting}
        />
      }
    >
      <TextField
        label="Nome"
        value={name}
        onChangeText={setName}
        maxLength={100}
        placeholder="Ex.: Conta do dia a dia"
        error={fieldErrors.name}
        editable={!submitting}
      />

      <Field label="Tipo" error={fieldErrors.type}>
        <ChoiceGroup
          label="Tipo"
          options={ACCOUNT_TYPES.map((value) => ({ value, label: ACCOUNT_TYPE_LABELS[value] }))}
          selected={accountType}
          onSelect={setAccountType}
          disabled={submitting}
        />
      </Field>

      <TextField
        label="Instituição (opcional)"
        value={institutionName}
        onChangeText={setInstitutionName}
        maxLength={120}
        error={fieldErrors.institutionName}
        editable={!submitting}
      />

      <TextField
        label="Saldo inicial (R$)"
        value={initialBalance}
        onChangeText={setInitialBalance}
        keyboardType="numbers-and-punctuation"
        placeholder="0.00"
        style={styles.tabular}
        error={fieldErrors.initialBalance}
        editable={!submitting}
      />

      <TextField
        label="Data de referência do saldo"
        value={balanceDate}
        onChangeText={setBalanceDate}
        keyboardType="numbers-and-punctuation"
        placeholder="DD/MM/AAAA"
        maxLength={10}
        accessibilityLabel="Data de referência do saldo, no formato dia, mês e ano"
        error={fieldErrors.initialBalanceAsOf}
        editable={!submitting}
      />

      {duplicates ? (
        <View style={styles.duplicates}>
          <Notice
            tone="warning"
            text={`Já existe conta conectada com nome, tipo e instituição equivalentes: ${duplicates
              .map((candidate) =>
                candidate.institutionName ? `${candidate.name} · ${candidate.institutionName}` : candidate.name,
              )
              .join("; ")}. Confirme se esta conta manual deve ${editing ? "continuar separada" : "existir separadamente"}.`}
          />
          <Button
            variant="secondary"
            label={editing ? "Salvar assim mesmo" : "Criar assim mesmo"}
            onPress={() => void submit(true)}
            disabled={submitting}
          />
        </View>
      ) : null}

      {info ? <Notice tone="info" text={info} /> : null}
      {formError ? <Notice tone="error" text={formError} /> : null}
    </FormScreen>
  );
}

const useStyles = makeStyles(() => ({
  tabular: { fontVariant: ["tabular-nums"] },
  duplicates: { gap: 10 },
}));
