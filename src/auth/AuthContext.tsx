import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { auth0Config } from "./config";
import {
  clearSession,
  isExpired,
  loadSession,
  saveSession,
  type StoredSession,
} from "./session-store";
import { setTokenProvider } from "../lib/api/http-client";
import { SessionEpoch } from "./session-epoch";

WebBrowser.maybeCompleteAuthSession();

type AuthStatus = "loading" | "anonymous" | "authenticated";

interface AuthContextValue {
  status: AuthStatus;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  /** Invalida a sessao local. Usado quando o backend recusa o token. */
  handleUnauthorized: () => Promise<void>;
  signingIn: boolean;
  error: string | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const redirectUri = AuthSession.makeRedirectUri({ scheme: auth0Config.scheme });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const discovery = AuthSession.useAutoDiscovery(auth0Config.issuer);
  const [epoch] = useState(() => new SessionEpoch());
  const [sessionNumber, setSessionNumber] = useState(0);

  const applySession = useCallback((session: StoredSession | null) => {
    // Toda troca de sessão invalida o que a sessão anterior ainda tinha em andamento.
    setSessionNumber(epoch.advance());
    if (session && !isExpired(session)) {
      setTokenProvider(() => session.accessToken);
      setStatus("authenticated");
      return;
    }
    setTokenProvider(() => undefined);
    setStatus("anonymous");
  }, [epoch]);

  useEffect(() => {
    let active = true;
    void (async () => {
      const session = await loadSession();
      if (!active) return;
      if (session && isExpired(session)) {
        await clearSession();
        applySession(null);
        return;
      }
      applySession(session);
    })();
    return () => {
      active = false;
    };
  }, [applySession]);

  const signIn = useCallback(async () => {
    if (!discovery) return;
    setSigningIn(true);
    setError(null);

    try {
      const request = new AuthSession.AuthRequest({
        clientId: auth0Config.clientId,
        redirectUri,
        responseType: AuthSession.ResponseType.Code,
        scopes: ["openid", "profile", "email"],
        usePKCE: true,
        extraParams: { audience: auth0Config.audience },
      });

      const result = await request.promptAsync(discovery);
      if (result.type !== "success") {
        // Cancelamento do usuario nao e erro a ser exibido.
        if (result.type === "error") {
          setError("Não foi possível entrar. Tente de novo.");
        }
        return;
      }

      const tokens = await AuthSession.exchangeCodeAsync(
        {
          clientId: auth0Config.clientId,
          code: result.params.code,
          redirectUri,
          extraParams: { code_verifier: request.codeVerifier ?? "" },
        },
        discovery,
      );

      const expiresInSeconds = tokens.expiresIn ?? 0;
      const session: StoredSession = {
        accessToken: tokens.accessToken,
        expiresAt: Date.now() + expiresInSeconds * 1000,
      };

      await saveSession(session);
      applySession(session);
    } catch {
      setError("Não foi possível entrar. Tente de novo.");
    } finally {
      setSigningIn(false);
    }
  }, [applySession, discovery]);

  const signOut = useCallback(async () => {
    await clearSession();
    applySession(null);

    // Encerra tambem a sessao no navegador do sistema; sem isso o proximo
    // login reentraria com a mesma identidade sem perguntar nada.
    const logoutUrl =
      `${auth0Config.issuer}/v2/logout` +
      `?client_id=${encodeURIComponent(auth0Config.clientId)}` +
      `&returnTo=${encodeURIComponent(redirectUri)}`;

    try {
      await WebBrowser.openAuthSessionAsync(logoutUrl, redirectUri);
    } catch {
      // A sessao local ja foi apagada; falha aqui nao deve travar o logout.
    }
  }, [applySession]);

  /**
   * Presa ao número da sessão em que foi criada: um 401 que chega depois de logout ou
   * troca de usuário vem de uma tela antiga e não pode encerrar a sessão atual.
   */
  const handleUnauthorized = useCallback(async () => {
    if (!epoch.isCurrent(sessionNumber)) return;
    await clearSession();
    applySession(null);
  }, [applySession, epoch, sessionNumber]);

  const value = useMemo(
    () => ({ status, signIn, signOut, handleUnauthorized, signingIn, error }),
    [status, signIn, signOut, handleUnauthorized, signingIn, error],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth precisa estar dentro de AuthProvider.");
  }
  return context;
}
