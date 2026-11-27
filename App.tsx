// Importa só os pesos usados: o índice do pacote empacotaria todos os arquivos de fonte.
import { Manrope_500Medium } from "@expo-google-fonts/manrope/500Medium";
import { Manrope_600SemiBold } from "@expo-google-fonts/manrope/600SemiBold";
import { Manrope_700Bold } from "@expo-google-fonts/manrope/700Bold";
import { Manrope_800ExtraBold } from "@expo-google-fonts/manrope/800ExtraBold";
import { Newsreader_400Regular } from "@expo-google-fonts/newsreader/400Regular";
import { useFonts } from "expo-font";
import { StatusBar } from "expo-status-bar";
import { useCallback, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "./src/auth/AuthContext";
import { AccountsScreen } from "./src/screens/AccountsScreen";
import { CategoriesScreen } from "./src/screens/CategoriesScreen";
import { InvestmentsScreen } from "./src/screens/InvestmentsScreen";
import { MovementsScreen } from "./src/screens/MovementsScreen";
import { OverviewScreen } from "./src/screens/OverviewScreen";
import { PatrimonyScreen } from "./src/screens/PatrimonyScreen";
import { RulesScreen } from "./src/screens/RulesScreen";
import { SignInScreen } from "./src/screens/SignInScreen";
import type { MovementFilters } from "./src/screens/movement-presentation";
import { overviewPreviewEnabled } from "./src/lib/overview/flag";
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
  const [section, setSection] = useState<Section>(overviewPreviewEnabled() ? "visao-geral" : "movimentacoes");
  // Filtros com que Movimentações abre quando chega de Categorias ("Ver lançamentos", "Revisar").
  const [movementsPreset, setMovementsPreset] = useState<Partial<MovementFilters> | null>(null);
  // "Criar conta" e "Criar categoria" dos Primeiros passos abrem a tela já no formulário de criação.
  const [startCreating, setStartCreating] = useState(false);
  const navigate = useCallback((next: Section) => {
    setMovementsPreset(null);
    setStartCreating(false);
    setSection(next);
  }, []);
  const createIn = useCallback((next: "contas" | "categorias") => {
    setMovementsPreset(null);
    setStartCreating(true);
    setSection(next);
  }, []);
  const openMovements = useCallback((preset: Partial<MovementFilters>) => {
    setMovementsPreset(preset);
    setSection("movimentacoes");
  }, []);

  if (status === "loading") return <Splash />;
  if (status !== "authenticated") return <SignInScreen />;

  // Ao sair, Root troca para SignInScreen e desmonta as telas: nenhum dado do tenant
  // anterior permanece em estado.
  switch (section) {
    case "visao-geral":
      return <OverviewScreen onNavigate={navigate} />;
    case "movimentacoes":
      return <MovementsScreen key={movementsPreset ? "preset" : "default"} onNavigate={navigate} onCreateIn={createIn} initialFilters={movementsPreset ?? undefined} />;
    case "contas":
      return <AccountsScreen onNavigate={navigate} startCreating={startCreating} />;
    case "categorias":
      return <CategoriesScreen onNavigate={navigate} onOpenMovements={openMovements} startCreating={startCreating} />;
    case "regras":
      return <RulesScreen onNavigate={navigate} />;
    case "patrimonio":
      return <PatrimonyScreen onNavigate={navigate} />;
    case "investimentos":
      return <InvestmentsScreen onNavigate={navigate} />;
  }
}
