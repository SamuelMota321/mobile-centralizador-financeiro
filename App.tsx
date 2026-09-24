import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { AuthProvider, useAuth } from "./src/auth/AuthContext";
import { AccountsScreen } from "./src/screens/AccountsScreen";
import { CategoriesScreen } from "./src/screens/CategoriesScreen";
import { MovementsScreen } from "./src/screens/MovementsScreen";
import type { Section } from "./src/screens/SectionTabs";
import { SignInScreen } from "./src/screens/SignInScreen";
import { theme } from "./src/theme";

export default function App() {
  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <Root />
    </AuthProvider>
  );
}

function Root() {
  const { status } = useAuth();
  const [section, setSection] = useState<Section>("contas");

  if (status === "loading") {
    return (
      <View style={styles.splash}>
        <ActivityIndicator color={theme.consciencia} />
      </View>
    );
  }

  if (status !== "authenticated") return <SignInScreen />;

  // Ao sair, Root troca para SignInScreen e desmonta as telas: nenhum dado do tenant
  // anterior permanece em estado.
  switch (section) {
    case "contas":
      return <AccountsScreen onNavigate={setSection} />;
    case "movimentacoes":
      return <MovementsScreen onNavigate={setSection} />;
    case "categorias":
      return <CategoriesScreen onNavigate={setSection} />;
  }
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.respiro,
  },
});
