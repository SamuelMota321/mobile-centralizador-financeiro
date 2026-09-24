import type { ReactNode } from "react";
import { Pressable, Text, TextInput, type TextInputProps, View } from "react-native";
import { makeStyles, radius, type, useTheme } from "../theme";
import { IconAlert } from "./icons";

export function Field({
  label,
  error,
  help,
  children,
}: {
  label: string;
  error?: string;
  help?: string;
  children: ReactNode;
}) {
  const styles = useFieldStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
      {help && !error ? <Text style={styles.help}>{help}</Text> : null}
      {error ? (
        <View style={styles.errorRow} accessibilityLiveRegion="polite">
          <IconAlert size={16} color={colors.negative} />
          <Text style={styles.error}>{error}</Text>
        </View>
      ) : null}
    </View>
  );
}

export function TextField({
  label,
  error,
  help,
  ...input
}: TextInputProps & { label: string; error?: string; help?: string }) {
  const styles = useFieldStyles();
  const { colors } = useTheme();
  return (
    <Field label={label} error={error} help={help}>
      <TextInput
        {...input}
        accessibilityLabel={input.accessibilityLabel ?? label}
        placeholderTextColor={colors.muted}
        selectionColor={colors.primary}
        style={[styles.input, error ? styles.inputError : null, input.style]}
      />
    </Field>
  );
}

/** Escolha única entre opções, exposta como rádio para leitores de tela. */
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
  const styles = useFieldStyles();
  return (
    <View style={styles.choices} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {options.map((option) => {
        const checked = option.value === selected;
        return (
          <Pressable
            key={option.value}
            onPress={() => onSelect(option.value)}
            disabled={disabled}
            accessibilityRole="radio"
            accessibilityState={{ checked, disabled }}
            style={({ pressed }) => [
              styles.chip,
              checked && styles.chipActive,
              pressed && styles.chipPressed,
            ]}
          >
            <Text style={[styles.chipLabel, checked && styles.chipLabelActive]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const useFieldStyles = makeStyles((c) => ({
  field: { gap: 8 },
  label: { ...type.label, color: c.bodyText },
  help: { ...type.micro, fontFamily: "Manrope_500Medium", color: c.muted },
  errorRow: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  error: { ...type.label, color: c.negative, flex: 1 },
  input: {
    ...type.body,
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: c.inputBorder,
    borderRadius: radius.control,
    backgroundColor: c.surface,
    color: c.foreground,
  },
  inputError: { borderColor: c.negative },
  choices: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 14,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.surface,
  },
  chipActive: { borderColor: c.primary, backgroundColor: c.primaryTint },
  chipPressed: { opacity: 0.85 },
  chipLabel: { ...type.bodySmall, color: c.bodyText },
  chipLabelActive: { fontFamily: "Manrope_700Bold", color: c.foreground },
}));
