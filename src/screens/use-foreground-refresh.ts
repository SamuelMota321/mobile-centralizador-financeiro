import { useEffect, useRef } from "react";
import { AppState } from "react-native";

/**
 * Recarrega a tela quando o app volta ao primeiro plano: uma correcao feita no web
 * aparece ao reabrir o app, sem sincronizacao em tempo real.
 */
export function useForegroundRefresh(refresh: () => void): void {
  const latest = useRef(refresh);
  useEffect(() => {
    latest.current = refresh;
  }, [refresh]);

  useEffect(() => {
    let previous = AppState.currentState;
    const subscription = AppState.addEventListener("change", (next) => {
      if (previous !== "active" && next === "active") latest.current();
      previous = next;
    });
    return () => subscription.remove();
  }, []);
}
