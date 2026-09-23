import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
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
import { theme } from "../theme";
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
  const editing = account !== undefined;

  const [name, setName] = useState(account?.name ?? "");
  const [type, setType] = useState<AccountType>(account?.type ?? "checking");
  const [institutionName, setInstitutionName] = useState(account?.institutionName ?? "");
  const [initialBalance, setInitialBalance] = useState(account?.initialBalance ?? "");
  const [initialBalanceAsOf, setInitialBalanceAsOf] = useState(
    account?.initialBalanceAsOf ?? "",
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
      type,
      institutionName,
      initialBalance,
      initialBalanceAsOf,
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

    const fallback = editing
      ? "Nao foi possivel salvar a conta."
      : "Nao foi possivel criar a conta.";

    try {
      if (account) {
        const patch = buildAccountPatch(account, parsed.data);
        if (!patch) {
          setInfo("Nenhuma alteracao para salvar.");
          return;
        }
        if (confirmPossibleDuplicate) patch.confirmPossibleDuplicate = true;
        await updateAccount(account.id, patch);
        onDone("Conta atualizada.");
      } else {
        await createAccount(parsed.data);
        onDone("Conta criada.");
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
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>{editing ? "Editar conta" : "Nova conta"}</Text>

      <Field label="Nome" error={fieldErrors.name}>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          maxLength={100}
        />
      </Field>

      <Field label="Tipo" error={fieldErrors.type}>
        <View style={styles.types}>
          {ACCOUNT_TYPES.map((option) => (
            <Pressable
              key={option}
              onPress={() => setType(option)}
              style={[styles.chip, type === option && styles.chipActive]}
              accessibilityRole="button"
            >
              <Text style={[styles.chipLabel, type === option && styles.chipLabelActive]}>
                {ACCOUNT_TYPE_LABELS[option]}
              </Text>
            </Pressable>
          ))}
        </View>
      </Field>

      <Field label="Instituicao (opcional)" error={fieldErrors.institutionName}>
        <TextInput
          style={styles.input}
          value={institutionName}
          onChangeText={setInstitutionName}
          maxLength={120}
        />
      </Field>

      <Field label="Saldo inicial" error={fieldErrors.initialBalance}>
        <TextInput
          style={styles.input}
          value={initialBalance}
          onChangeText={setInitialBalance}
          keyboardType="numbers-and-punctuation"
          placeholder="0.00"
          placeholderTextColor={theme.muted}
        />
      </Field>

      <Field label="Data de referencia" error={fieldErrors.initialBalanceAsOf}>
        <TextInput
          style={styles.input}
          value={initialBalanceAsOf}
          onChangeText={setInitialBalanceAsOf}
          placeholder="AAAA-MM-DD"
          placeholderTextColor={theme.muted}
          autoCapitalize="none"
        />
      </Field>

      {duplicates ? (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>
            Ja existe conta conectada com nome, tipo e instituicao equivalentes. Confirme
            se esta conta manual deve {editing ? "continuar separada" : "existir separadamente"}.
          </Text>
          {duplicates.map((candidate) => (
            <Text key={candidate.id} style={styles.candidate}>
              {candidate.name}
              {candidate.institutionName ? ` · ${candidate.institutionName}` : ""}
            </Text>
          ))}
          <Pressable
            style={styles.primary}
            onPress={() => void submit(true)}
            disabled={submitting}
          >
            <Text style={styles.primaryLabel}>
              {editing ? "Salvar assim mesmo" : "Criar assim mesmo"}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {info ? <Text style={styles.noticeText}>{info}</Text> : null}
      {formError ? <Text style={styles.error}>{formError}</Text> : null}

      <Pressable
        style={styles.primary}
        onPress={() => void submit(false)}
        disabled={submitting}
        accessibilityRole="button"
      >
        {submitting ? (
          <ActivityIndicator color={theme.onAccent} />
        ) : (
          <Text style={styles.primaryLabel}>
            {editing ? "Salvar alteracoes" : "Criar conta"}
          </Text>
        )}
      </Pressable>

      <Pressable style={styles.secondary} onPress={onCancel} accessibilityRole="button">
        <Text style={styles.secondaryLabel}>Cancelar</Text>
      </Pressable>
    </ScrollView>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
    padding: 20,
    paddingTop: 64,
    paddingBottom: 48,
    backgroundColor: theme.respiro,
    flexGrow: 1,
  },
  title: {
    fontSize: 24,
    color: theme.confianca,
  },
  field: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: theme.muted,
  },
  input: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 8,
    backgroundColor: theme.surface,
    color: theme.confianca,
  },
  types: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surface,
  },
  chipActive: {
    borderColor: theme.consciencia,
    backgroundColor: theme.clareza,
  },
  chipLabel: {
    fontSize: 13,
    color: theme.muted,
  },
  chipLabelActive: {
    color: theme.confianca,
    fontWeight: "600",
  },
  notice: {
    gap: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 10,
    backgroundColor: theme.surface,
  },
  noticeText: {
    color: theme.confianca,
  },
  candidate: {
    color: theme.muted,
  },
  error: {
    color: theme.danger,
    fontSize: 13,
  },
  primary: {
    alignItems: "center",
    paddingVertical: 14,
    borderRadius: 999,
    backgroundColor: theme.consciencia,
  },
  primaryLabel: {
    color: theme.onAccent,
    fontWeight: "600",
    fontSize: 16,
  },
  secondary: {
    alignItems: "center",
    paddingVertical: 12,
  },
  secondaryLabel: {
    color: theme.muted,
  },
});
