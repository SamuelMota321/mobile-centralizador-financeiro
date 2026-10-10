import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, BackHandler, Text, View } from "react-native";
import { PluggyConnect } from "react-native-pluggy-connect";
import { useAuth } from "../auth/AuthContext";
import {
  completePluggyConnection,
  disconnectConnection,
  getConnection,
  startPluggySession,
} from "../lib/connections/api";
import type { Connection } from "../lib/connections/types";
import { makeStyles, radius, type } from "../theme";
import { Button, Notice, type NoticeTone, StatusChip } from "../ui/controls";
import { FormScreen } from "../ui/screens";
import {
  canCheckAgain,
  canDisconnect,
  classifyConnectionError,
  consentSummary,
  formatTimestamp,
  itemIdFromSuccess,
  needsReconnect,
  statusView,
} from "./connect-logic";

interface Props {
  onCancel: () => void;
  /** Volta para a lista de Contas, que exibe a mensagem com o tom informado. */
  onDone: (message: string, tone: NoticeTone) => void;
}

interface FlowNotice {
  tone: NoticeTone;
  text: string;
}

/**
 * - intro: explica o que sera autorizado e oferece "Conectar".
 * - widget: o widget esta aberto com o token desta tentativa (so em memoria).
 * - completing/completeFailed: o banco devolveu o item e o backend esta registrando; em
 *   falha, "Tentar de novo" reenvia o mesmo itemId (seguro no backend).
 * - connection: detalhe da conexao devolvida pelo backend.
 */
type Phase =
  | { kind: "intro"; notice?: FlowNotice }
  | { kind: "widget"; connectToken: string }
  | { kind: "completing"; itemId: string }
  | { kind: "completeFailed"; itemId: string; notice: FlowNotice }
  | { kind: "connection"; connection: Connection; notice?: FlowNotice };

/**
 * Conexao com banco pelo Pluggy (Sandbox). O token limitado, o item e a conexao vivem so no
 * estado desta tela; nada e persistido no aparelho. O OAuth abre em WebView dentro do app
 * (`forceOauthInBrowser={false}`): o retorno por deep link depende de o backend informar o
 * `oauthRedirectUri` ao criar o token, o que ainda nao acontece.
 */
export function ConnectScreen({ onCancel, onDone }: Props) {
  const { handleUnauthorized } = useAuth();
  const styles = useStyles();
  const [phase, setPhase] = useState<Phase>({ kind: "intro" });
  const [busy, setBusy] = useState(false);
  // O widget dispara onClose tambem depois do sucesso; so o fechamento sem item e cancelamento.
  const itemReceived = useRef(false);

  const start = useCallback(async () => {
    setBusy(true);
    try {
      const session = await startPluggySession();
      itemReceived.current = false;
      setPhase({ kind: "widget", connectToken: session.connectToken });
    } catch (error) {
      const failure = classifyConnectionError(error, "Não foi possível iniciar a conexão.");
      if (failure.kind === "unauthorized") {
        await handleUnauthorized();
        return;
      }
      setPhase({ kind: "intro", notice: { tone: "error", text: failure.message } });
    } finally {
      setBusy(false);
    }
  }, [handleUnauthorized]);

  const complete = useCallback(
    async (itemId: string) => {
      setPhase({ kind: "completing", itemId });
      setBusy(true);
      try {
        const connection = await completePluggyConnection(itemId);
        setPhase({ kind: "connection", connection, notice: { tone: "success", text: "Conexão registrada." } });
      } catch (error) {
        const failure = classifyConnectionError(error, "Não foi possível registrar a conexão.");
        if (failure.kind === "unauthorized") {
          await handleUnauthorized();
          return;
        }
        setPhase({ kind: "completeFailed", itemId, notice: { tone: "error", text: failure.message } });
      } finally {
        setBusy(false);
      }
    },
    [handleUnauthorized],
  );

  const update = useCallback(
    async (connection: Connection, call: typeof getConnection, fallback: string, success?: string) => {
      setBusy(true);
      try {
        const next = await call(connection.id);
        setPhase({ kind: "connection", connection: next, notice: success ? { tone: "success", text: success } : undefined });
      } catch (error) {
        const failure = classifyConnectionError(error, fallback);
        if (failure.kind === "unauthorized") {
          await handleUnauthorized();
          return;
        }
        setPhase({ kind: "connection", connection, notice: { tone: "error", text: failure.message } });
      } finally {
        setBusy(false);
      }
    },
    [handleUnauthorized],
  );

  const confirmDisconnect = useCallback(
    (connection: Connection) => {
      Alert.alert(
        "Remover conexão",
        "A autorização será revogada e a coleta de novos dados deste banco vai parar. Para voltar a coletar, será preciso conectar de novo.",
        [
          { text: "Cancelar", style: "cancel" },
          {
            text: "Remover",
            style: "destructive",
            onPress: () =>
              void update(
                connection,
                disconnectConnection,
                "Não foi possível remover a conexão.",
                "Conexão removida. A coleta de novos dados parou.",
              ),
          },
        ],
        { cancelable: true },
      );
    },
    [update],
  );

  const cancelWidget = useCallback(() => {
    setPhase({ kind: "intro", notice: { tone: "info", text: "Conexão cancelada. Nada foi registrado." } });
  }, []);

  // Voltar do Android fecha o widget como cancelamento, sem sair da tela.
  useEffect(() => {
    if (phase.kind !== "widget") return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      cancelWidget();
      return true;
    });
    return () => subscription.remove();
  }, [phase.kind, cancelWidget]);

  if (phase.kind === "widget") {
    return (
      <View style={styles.widget}>
        <PluggyConnect
          connectToken={phase.connectToken}
          includeSandbox
          language="pt"
          theme="light"
          forceOauthInBrowser={false}
          onSuccess={(data: unknown) => {
            itemReceived.current = true;
            const itemId = itemIdFromSuccess(data);
            if (itemId) void complete(itemId);
            else
              setPhase({
                kind: "intro",
                notice: { tone: "error", text: "O banco não devolveu uma conexão válida. Tente conectar de novo." },
              });
          }}
          onError={() => {
            // A mensagem do provedor nao e exibida.
            itemReceived.current = true;
            setPhase({
              kind: "intro",
              notice: { tone: "error", text: "O banco ou o Pluggy recusou a conexão. Nada foi registrado. Tente de novo." },
            });
          }}
          onClose={() => {
            if (!itemReceived.current) cancelWidget();
          }}
        />
      </View>
    );
  }

  if (phase.kind === "completing") {
    return (
      <FormScreen title="Registrando a conexão" onCancel={onCancel} cancelDisabled footer={null}>
        <Notice tone="info" text="O banco autorizou. Estamos confirmando os dados com o servidor." />
      </FormScreen>
    );
  }

  if (phase.kind === "completeFailed") {
    const { itemId } = phase;
    return (
      <FormScreen
        title="A conexão não foi registrada"
        onCancel={onCancel}
        cancelDisabled={busy}
        footer={
          <>
            <Button label="Tentar de novo" onPress={() => void complete(itemId)} loading={busy} />
            <Button label="Começar de novo" variant="text" onPress={() => setPhase({ kind: "intro" })} disabled={busy} />
          </>
        }
      >
        <Notice tone={phase.notice.tone} text={phase.notice.text} />
      </FormScreen>
    );
  }

  if (phase.kind === "connection") {
    const { connection } = phase;
    const view = statusView(connection.status);
    const consent = consentSummary(connection);
    const finish = () => onDone(`Conexão com o banco: ${view.label.toLowerCase()}.`, view.noticeTone);
    return (
      <FormScreen
        title="Conexão com o banco"
        onCancel={finish}
        cancelDisabled={busy}
        footer={
          <>
            {canCheckAgain(connection.status) ? (
              <Button
                label="Verificar de novo"
                onPress={() => void update(connection, getConnection, "Não foi possível consultar a conexão.")}
                loading={busy}
              />
            ) : null}
            {needsReconnect(connection.status) ? (
              <Button label="Conectar de novo" onPress={() => setPhase({ kind: "intro" })} disabled={busy} />
            ) : null}
            {canDisconnect(connection.status) ? (
              <Button
                label="Remover conexão"
                variant="secondary"
                onPress={() => confirmDisconnect(connection)}
                disabled={busy}
              />
            ) : null}
            <Button label="Voltar para Contas" variant="text" onPress={finish} disabled={busy} />
          </>
        }
      >
        {phase.notice ? <Notice tone={phase.notice.tone} text={phase.notice.text} /> : null}
        <View style={styles.statusLine}>
          <StatusChip tone={view.tone} label={view.label} />
        </View>
        <Notice tone={view.noticeTone} text={view.explanation} />
        <View style={styles.summary}>
          <SummaryRow
            label="Dados autorizados"
            value={consent.products.length > 0 ? consent.products.join(", ") : "Nenhum ainda"}
          />
          {consent.permissionCount > 0 ? (
            <SummaryRow label="Permissões Open Finance" value={String(consent.permissionCount)} />
          ) : null}
          {consent.grantedAt ? <SummaryRow label="Autorizada em" value={consent.grantedAt} /> : null}
          {consent.expiresAt ? <SummaryRow label="Autorização válida até" value={consent.expiresAt} /> : null}
          <SummaryRow label="Última atualização" value={formatTimestamp(connection.updatedAt)} />
        </View>
        <Text style={styles.help}>
          A importação das movimentações desta conexão ainda não está disponível nesta versão.
        </Text>
      </FormScreen>
    );
  }

  return (
    <FormScreen
      title="Conectar banco"
      description="Autorize a leitura dos dados de um banco pelo Open Finance, em ambiente de testes (Sandbox)."
      onCancel={onCancel}
      cancelDisabled={busy}
      footer={<Button label="Conectar banco" onPress={() => void start()} loading={busy} />}
    >
      <View style={styles.section}>
        <Text style={styles.sectionTitle} accessibilityRole="header">
          O que você vai autorizar
        </Text>
        {TERMS.map((term) => (
          <Text key={term} style={styles.term}>
            {`•  ${term}`}
          </Text>
        ))}
      </View>
      {phase.notice ? <Notice tone={phase.notice.tone} text={phase.notice.text} /> : null}
    </FormScreen>
  );
}

const TERMS = [
  "Leitura dos dados que você escolher no banco, como contas, saldos e movimentações.",
  "Os dados ficam só na sua conta do Coinciente.",
  "Nunca movimentar dinheiro, fazer pagamentos ou Pix.",
  "Sua senha do banco é digitada na janela do Pluggy e não passa pelo Coinciente.",
  "Você pode remover a conexão quando quiser; a coleta de novos dados para.",
];

function SummaryRow({ label, value }: { label: string; value: string }) {
  const styles = useStyles();
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  widget: { flex: 1, backgroundColor: c.surface },
  section: { gap: 8 },
  sectionTitle: { ...type.sectionTitle, color: c.foreground },
  term: { ...type.body, color: c.foreground },
  help: { ...type.bodySmall, color: c.muted },
  statusLine: { flexDirection: "row" },
  summary: {
    gap: 10,
    padding: 16,
    borderWidth: 1,
    borderColor: c.line,
    borderRadius: radius.panel,
    backgroundColor: c.surface,
  },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  summaryLabel: { ...type.bodySmall, color: c.muted, flexShrink: 1 },
  summaryValue: { ...type.label, color: c.foreground, flexShrink: 1, textAlign: "right" },
}));
