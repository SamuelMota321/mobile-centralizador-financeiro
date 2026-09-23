import * as SecureStore from "expo-secure-store";

const SESSION_KEY = "coinciente.session";

export interface StoredSession {
  accessToken: string;
  /** Epoch em milissegundos. */
  expiresAt: number;
}

export async function loadSession(): Promise<StoredSession | null> {
  const raw = await SecureStore.getItemAsync(SESSION_KEY);
  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof (parsed as StoredSession).accessToken === "string" &&
      typeof (parsed as StoredSession).expiresAt === "number"
    ) {
      return parsed as StoredSession;
    }
  } catch {
    // Conteudo corrompido: tratado como ausencia de sessao.
  }

  await clearSession();
  return null;
}

export async function saveSession(session: StoredSession): Promise<void> {
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
}

export async function clearSession(): Promise<void> {
  await SecureStore.deleteItemAsync(SESSION_KEY);
}

export function isExpired(session: StoredSession): boolean {
  return session.expiresAt <= Date.now();
}
