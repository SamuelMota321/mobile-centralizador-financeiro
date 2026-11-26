import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { makeStyles, radius, type, useTheme } from "../theme";

/** Busca de lista: filtra o que já foi carregado, no aparelho. */
export function SearchField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor={colors.muted}
      accessibilityLabel={placeholder}
      returnKeyType="search"
      autoCorrect={false}
      maxLength={80}
      style={styles.search}
    />
  );
}

/** Chips de escolha única em linha rolável; o selecionado é anunciado como tal. */
export function FilterChips<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const styles = useStyles();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chips}
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            hitSlop={4}
            style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && styles.pressed]}
          >
            <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** Cabeçalho de grupo de lista, ex.: "Bancos (2)". */
export function GroupHeader({ label, count }: { label: string; count: number }) {
  const styles = useStyles();
  return (
    <View style={styles.groupHead}>
      <Text style={styles.groupLabel} accessibilityRole="header">
        {label} <Text style={styles.groupCount}>({count})</Text>
      </Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  search: {
    ...type.body,
    minHeight: 48,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: c.inputBorder,
    borderRadius: radius.control,
    backgroundColor: c.surface,
    color: c.foreground,
  },
  chips: { gap: 8, paddingVertical: 2 },
  chip: {
    minHeight: 40,
    justifyContent: "center",
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: c.line,
    borderRadius: radius.pill,
    backgroundColor: c.surface,
  },
  chipSelected: { borderColor: c.primary, backgroundColor: c.primaryTint },
  chipLabel: { ...type.label, color: c.bodyText },
  chipLabelSelected: { color: c.foreground },
  pressed: { opacity: 0.88 },
  groupHead: { paddingTop: 16, paddingBottom: 8 },
  groupLabel: { ...type.label, color: c.foreground },
  groupCount: { color: c.muted },
}));
