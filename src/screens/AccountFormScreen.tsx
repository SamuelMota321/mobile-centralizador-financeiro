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
import { createAccount, PossibleDuplicateAccountError } from "../lib/accounts/api";
import { manualAccountInputSchema } from "../lib/accounts/schema";
import { ProblemDetailsError, PROBLEM_CODES } from "../lib/api/errors";
import { ACCOUNT_TYPES, type AccountType, type DuplicateCandidate } from "../lib/accounts/types";
import { theme } from "../theme";
import { ACCOUNT_TYPE_LABELS } from "./account-type-labels";

interface Props {
  onCancel: () => void;
  onCreated: () => void;
}

export function AccountFormScreen({ onCancel, onCreated }: Props) {
  const { handleUnauthorized } = useAuth();

  const [name, setName] = useState("");
  const [type, setType] = useState<AccountType>("checking");
  const [institutionName, setInstitutionName] = useState("");
  const [initialBalance, setInitialBalance] = useState("");
  const [initialBalanceAsOf, setInitialBalanceAsOf] = useState("");

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [duplicates, setDuplicates] = useState<DuplicateCandidate[] | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(confirmPossibleDuplicate: boolean) {
    setSubmitting(true);
    setFormError(null);
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

    try {
      await createAccount(parsed.data);
      onCreated();
    } catch (error) {
      if (error instanceof PossibleDuplicateAccountError) {
        setDuplicates(error.candidates);
      } else if (
        error instanceof ProblemDetailsError &&
        error.code === PROBLEM_CODES.authenticationRequired
      ) {
        await handleUnauthorized();
      } else if (error instanceof ProblemDetailsError) {
        setFormError(error.message);
      } else {
        setFormError("Nao foi possivel criar a conta.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Nova conta</Text>

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
            se esta conta manual deve existir separadamente.
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
            <Text style={styles.primaryLabel}>Criar assim mesmo</Text>
          </Pressable>
        </View>
      ) : null}

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
          <Text style={styles.primaryLabel}>Criar conta</Text>
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
