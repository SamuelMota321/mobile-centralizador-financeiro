import { Stack } from "expo-router";

// Seções do app. Trocar de seção troca de rota sem animação de pilha: as abas são
// destinos de mesmo nível, não etapas de um caminho.
export default function AppLayout() {
  return <Stack screenOptions={{ headerShown: false, animation: "none" }} />;
}
