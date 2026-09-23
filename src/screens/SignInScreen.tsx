import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useAuth } from "../auth/AuthContext";
import { theme } from "../theme";

export function SignInScreen() {
  const { signIn, signingIn, error } = useAuth();

  return (
    <View style={styles.container}>
      <Text style={styles.brand}>COINCIENTE</Text>
      <Text style={styles.title}>Clareza para cuidar do que e seu.</Text>
      <Text style={styles.lead}>
        Reuna suas contas em uma leitura unica, rastreavel e honesta.
      </Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        onPress={() => void signIn()}
        disabled={signingIn}
        accessibilityRole="button"
      >
        {signingIn ? (
          <ActivityIndicator color={theme.onAccent} />
        ) : (
          <Text style={styles.buttonLabel}>Entrar</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    gap: 16,
    padding: 32,
    backgroundColor: theme.respiro,
  },
  brand: {
    fontSize: 12,
    letterSpacing: 2,
    color: theme.muted,
  },
  title: {
    fontSize: 30,
    color: theme.confianca,
  },
  lead: {
    fontSize: 16,
    lineHeight: 24,
    color: theme.muted,
  },
  error: {
    color: theme.danger,
  },
  button: {
    marginTop: 8,
    alignSelf: "flex-start",
    minWidth: 140,
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 999,
    backgroundColor: theme.consciencia,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonLabel: {
    color: theme.onAccent,
    fontWeight: "600",
    fontSize: 16,
  },
});
