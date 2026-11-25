import { ActivityIndicator, View } from "react-native";
import { useTheme } from "../theme";

/** Tela de espera enquanto fontes e sessão carregam; não há conteúdo para o esqueleto imitar. */
export function Splash() {
  const { colors } = useTheme();
  return (
    <View
      style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}
    >
      <ActivityIndicator color={colors.primary} accessibilityLabel="Carregando" />
    </View>
  );
}
