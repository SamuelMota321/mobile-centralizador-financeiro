import { useState } from "react";
import { Alert, Pressable, Text } from "react-native";
import { selectTheme } from "../theme-preference";
import { makeStyles, type, useTheme } from "../theme";

export function ThemeSwitch() {
  const { scheme } = useTheme();
  const styles = useStyles();
  const [saving, setSaving] = useState(false);
  const next = scheme === "dark" ? "light" : "dark";

  async function switchTheme() {
    setSaving(true);
    try {
      await selectTheme(next);
    } catch {
      Alert.alert("Tema não salvo", "O tema mudou nesta sessão, mas não foi possível salvar a escolha no dispositivo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Pressable
      onPress={() => void switchTheme()}
      disabled={saving}
      accessibilityRole="switch"
      accessibilityLabel="Tema escuro"
      accessibilityState={{ checked: scheme === "dark", disabled: saving }}
      hitSlop={4}
      style={({ pressed }) => [styles.control, pressed && styles.pressed]}
    >
      <Text style={styles.label}>{scheme === "dark" ? "Escuro" : "Claro"}</Text>
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  control: {
    minHeight: 44,
    minWidth: 60,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  label: { ...type.label, color: c.primary },
  pressed: { opacity: 0.7 },
}));
