// Importa só os pesos usados: o índice do pacote empacotaria todos os arquivos de fonte.
import { Manrope_500Medium } from "@expo-google-fonts/manrope/500Medium";
import { Manrope_600SemiBold } from "@expo-google-fonts/manrope/600SemiBold";
import { Manrope_700Bold } from "@expo-google-fonts/manrope/700Bold";
import { Manrope_800ExtraBold } from "@expo-google-fonts/manrope/800ExtraBold";
import { Newsreader_400Regular } from "@expo-google-fonts/newsreader/400Regular";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "../src/auth/AuthContext";
import { Splash } from "../src/ui/splash";

export default function RootLayout() {
  // Fontes da marca antes da primeira tela: evita trocar de fonte com a tela já visível.
  const [fontsLoaded] = useFonts({
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
    Newsreader_400Regular,
  });

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <StatusBar style="auto" />
          {fontsLoaded ? <Navigator /> : <Splash />}
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/**
 * As seções só existem com sessão e o login só sem ela. Ao sair, a guarda remove as rotas
 * protegidas da pilha: nenhuma tela com dados do tenant anterior permanece montada.
 */
function Navigator() {
  const { status } = useAuth();
  const signedIn = status === "authenticated";
  return (
    <Stack screenOptions={{ headerShown: false, animation: "fade" }}>
      <Stack.Screen name="index" />
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={status === "anonymous"}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
    </Stack>
  );
}
