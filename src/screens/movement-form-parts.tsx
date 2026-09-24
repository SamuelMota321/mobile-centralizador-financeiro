import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { theme } from "../theme";
import type { AccountOption } from "./movement-presentation";

export function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <View style={formStyles.field}>
      <Text style={formStyles.label}>{label}</Text>
      {children}
      {error ? (
        <Text style={formStyles.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

/** Escolha unica entre opcoes, exposta como radio para leitores de tela. */
export function ChoiceGroup<T extends string>({
  label,
  options,
  selected,
  onSelect,
  disabled,
}: {
  label: string;
  options: { value: T; label: string }[];
  selected: T | "";
  onSelect: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <View style={formStyles.choices} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {options.map((option) => {
        const checked = option.value === selected;
        return (
          <Pressable
            key={option.value}
            onPress={() => onSelect(option.value)}
            disabled={disabled}
            style={[formStyles.chip, checked && formStyles.chipActive]}
            accessibilityRole="radio"
            accessibilityState={{ checked, disabled }}
          >
            <Text style={[formStyles.chipLabel, checked && formStyles.chipLabelActive]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function accountChoices(accounts: AccountOption[]) {
  return accounts.map((account) => ({ value: account.id, label: account.name }));
}

/** Conta que saiu da lista de ativas deixa de contar como selecionada. */
export function selectedAccount(accountId: string, accounts: AccountOption[]): string {
  return accounts.some((account) => account.id === accountId) ? accountId : "";
}

export const formStyles = StyleSheet.create({
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
  helper: {
    color: theme.muted,
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
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 8,
    backgroundColor: theme.surface,
    color: theme.confianca,
  },
  amountInput: {
    fontVariant: ["tabular-nums"],
  },
  choices: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    minHeight: 44,
    justifyContent: "center",
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
    fontSize: 14,
    color: theme.muted,
  },
  chipLabelActive: {
    color: theme.confianca,
    fontWeight: "600",
  },
  error: {
    color: theme.danger,
    fontSize: 13,
  },
  formError: {
    padding: 14,
    borderWidth: 1,
    borderColor: theme.danger,
    borderRadius: 10,
    backgroundColor: theme.surface,
    color: theme.danger,
  },
  primary: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
    borderRadius: 999,
    backgroundColor: theme.consciencia,
  },
  primaryDisabled: {
    opacity: 0.6,
  },
  primaryLabel: {
    color: theme.onAccent,
    fontWeight: "600",
    fontSize: 16,
  },
  secondary: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.border,
  },
  secondaryLabel: {
    color: theme.confianca,
  },
});
