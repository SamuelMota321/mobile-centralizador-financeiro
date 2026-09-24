// Importa só os pesos usados: o índice do pacote empacotaria todos os arquivos de fonte.
import { Manrope_500Medium } from "@expo-google-fonts/manrope/500Medium";
import { Manrope_600SemiBold } from "@expo-google-fonts/manrope/600SemiBold";
import { Manrope_700Bold } from "@expo-google-fonts/manrope/700Bold";
import { Manrope_800ExtraBold } from "@expo-google-fonts/manrope/800ExtraBold";
import { Newsreader_400Regular } from "@expo-google-fonts/newsreader/400Regular";
import { useFonts } from "expo-font";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "./src/auth/AuthContext";
import { AccountsScreen } from "./src/screens/AccountsScreen";
import { CategoriesScreen } from "./src/screens/CategoriesScreen";
import { MovementsScreen } from "./src/screens/MovementsScreen";
import { SignInScreen } from "./src/screens/SignInScreen";
import { useTheme } from "./src/theme";
import type { Section } from "./src/ui/screens";

export default function App() {
  // Fontes da marca antes da primeira tela: evita trocar de fonte com a tela já visível.
  const [fontsLoaded] = useFonts({
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
    Newsreader_400Regular,
  });

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="auto" />
        {fontsLoaded ? <Root /> : <Splash />}
      </AuthProvider>
    </SafeAreaProvider>
  );
}

function Splash() {
  const { colors } = useTheme();
  return (
    <View
      style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}
    >
      <ActivityIndicator color={colors.primary} accessibilityLabel="Carregando" />
    </View>
  );
}

function Root() {
  const { status } = useAuth();
  const [section, setSection] = useState<Section>("movimentacoes");

  if (status === "loading") return <Splash />;
  if (status !== "authenticated") return <SignInScreen />;

  // Ao sair, Root troca para SignInScreen e desmonta as telas: nenhum dado do tenant
  // anterior permanece em estado.
  switch (section) {
    case "movimentacoes":
      return <MovementsScreen onNavigate={setSection} />;
    case "contas":
      return <AccountsScreen onNavigate={setSection} />;
    case "categorias":
      return <CategoriesScreen onNavigate={setSection} />;
  }
}
