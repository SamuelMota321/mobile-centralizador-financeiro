import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../auth/AuthContext";
import { makeStyles, type } from "../theme";
import { BrandLockup } from "../ui/brand";
import { Button, Notice } from "../ui/controls";

export function SignInScreen() {
  const { signIn, signingIn, error } = useAuth();
  const styles = useStyles();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 16 }]}>
      <BrandLockup />

      <View style={styles.intro}>
        {/* Voz institucional: única aplicação de Newsreader no app. */}
        <Text style={styles.title} accessibilityRole="header">
          Clareza para cuidar do que é seu.
        </Text>
        <Text style={styles.lead}>
          Reúna suas contas em uma leitura única, rastreável e honesta. O Coinciente organiza;
          ele não movimenta dinheiro nem faz recomendações de investimento.
        </Text>
      </View>

      <View style={styles.actions}>
        {error ? <Notice tone="error" text={error} /> : null}
        <Button label="Entrar" onPress={() => void signIn()} loading={signingIn} />
        <Text style={styles.footnote}>Demonstração acadêmica com dados fictícios.</Text>
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  screen: {
    flex: 1,
    justifyContent: "space-between",
    paddingHorizontal: 24,
    backgroundColor: c.background,
  },
  intro: { gap: 16 },
  title: { ...type.display, color: c.foreground },
  lead: { ...type.body, fontSize: 16, lineHeight: 25, color: c.bodyText },
  actions: { gap: 12 },
  footnote: { ...type.micro, fontFamily: "Manrope_500Medium", color: c.muted, textAlign: "center" },
}));
