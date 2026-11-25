import { Redirect } from "expo-router";
import { useAuth } from "../src/auth/AuthContext";
import { Splash } from "../src/ui/splash";

// Ponto de entrada: manda para a primeira seção ou para o login conforme a sessão.
export default function Index() {
  const { status } = useAuth();
  if (status === "loading") return <Splash />;
  return <Redirect href={status === "authenticated" ? "/movimentacoes" : "/sign-in"} />;
}
