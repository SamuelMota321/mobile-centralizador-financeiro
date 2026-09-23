import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useAuth } from "../auth/AuthContext";
import { deactivateAccount, listAccounts } from "../lib/accounts/api";
import {
  ACCOUNT_UNAVAILABLE_MESSAGE,
  accountErrorMessage,
  isAccountUnavailable,
  isUnauthorized,
} from "../lib/accounts/messages";
import type { Account } from "../lib/accounts/types";
import { theme } from "../theme";
import { ACCOUNT_TYPE_LABELS } from "./account-type-labels";
import { AccountFormScreen } from "./AccountFormScreen";

type LoadState = "loading" | "ready" | "error";

type Mode = { kind: "list" } | { kind: "create" } | { kind: "edit"; account: Account };

interface Notice {
  tone: "info" | "error";
  text: string;
}

export function AccountsScreen() {
  const { signOut, handleUnauthorized } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [refreshing, setRefreshing] = useState(false);
  const [mode, setMode] = useState<Mode>({ kind: "list" });
  const [notice, setNotice] = useState<Notice | null>(null);
  // Conta com desativacao em andamento: bloqueia toque duplo e outras acoes nela.
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const page = await listAccounts();
      setAccounts(page.items);
      setState("ready");
    } catch (error) {
      if (isUnauthorized(error)) {
        await handleUnauthorized();
        return;
      }
      setState("error");
    }
  }, [handleUnauthorized]);

  useEffect(() => {
    void load();
  }, [load]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const deactivate = useCallback(
    async (account: Account) => {
      setBusyId(account.id);
      setNotice(null);
      try {
        await deactivateAccount(account.id);
        setNotice({
          tone: "info",
          text: "Conta desativada. Ela deixou de aparecer na lista e o historico foi preservado.",
        });
        await load();
      } catch (error) {
        if (isUnauthorized(error)) {
          await handleUnauthorized();
          return;
        }
        if (isAccountUnavailable(error)) {
          setNotice({ tone: "info", text: ACCOUNT_UNAVAILABLE_MESSAGE });
          await load();
          return;
        }
        setNotice({
          tone: "error",
          text: accountErrorMessage(error, "Nao foi possivel desativar a conta."),
        });
      } finally {
        setBusyId(null);
      }
    },
    [handleUnauthorized, load],
  );

  const confirmDeactivate = useCallback(
    (account: Account) => {
      Alert.alert(
        "Desativar conta",
        `Desativar \u201c${account.name}\u201d? Ela deixa de aparecer na lista e nao podera ser editada nem reativada. O historico e preservado.`,
        [
          { text: "Cancelar", style: "cancel" },
          {
            text: "Desativar",
            style: "destructive",
            onPress: () => void deactivate(account),
          },
        ],
        { cancelable: true },
      );
    },
    [deactivate],
  );

  const finishForm = useCallback(
    (message: string) => {
      setMode({ kind: "list" });
      setNotice({ tone: "info", text: message });
      void load();
    },
    [load],
  );

  if (mode.kind !== "list") {
    return (
      <AccountFormScreen
        account={mode.kind === "edit" ? mode.account : undefined}
        onCancel={() => setMode({ kind: "list" })}
        onDone={finishForm}
      />
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Suas contas</Text>
        <Pressable onPress={() => void signOut()} accessibilityRole="button">
          <Text style={styles.signOut}>Sair</Text>
        </Pressable>
      </View>

      {notice ? (
        <View
          style={[styles.notice, notice.tone === "error" && styles.noticeError]}
          accessibilityLiveRegion="polite"
        >
          <Text style={notice.tone === "error" ? styles.noticeErrorText : styles.noticeText}>
            {notice.text}
          </Text>
          <Pressable onPress={() => setNotice(null)} accessibilityRole="button">
            <Text style={styles.signOut}>Fechar</Text>
          </Pressable>
        </View>
      ) : null}

      {state === "loading" ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.consciencia} />
        </View>
      ) : state === "error" ? (
        <View style={styles.center}>
          <Text style={styles.muted}>Nao foi possivel carregar suas contas.</Text>
          <Pressable style={styles.secondary} onPress={() => void load()}>
            <Text style={styles.secondaryLabel}>Tentar de novo</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={accounts}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.muted}>
                Voce ainda nao tem contas. Crie a primeira abaixo.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const busy = busyId === item.id;
            return (
              <View style={styles.item}>
                <View style={styles.itemRow}>
                  <View style={styles.itemMain}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <Text style={styles.itemMeta}>
                      {ACCOUNT_TYPE_LABELS[item.type]}
                      {item.institutionName ? ` · ${item.institutionName}` : ""}
                      {item.origin === "connected" ? " · conectada" : ""}
                    </Text>
                  </View>
                  <Text style={styles.balance}>{item.initialBalance}</Text>
                </View>

                <View style={styles.actions}>
                  {item.origin === "manual" ? (
                    <Pressable
                      onPress={() => setMode({ kind: "edit", account: item })}
                      disabled={busy}
                      accessibilityRole="button"
                      accessibilityLabel={`Editar ${item.name}`}
                      hitSlop={8}
                    >
                      <Text style={styles.action}>Editar</Text>
                    </Pressable>
                  ) : (
                    <Text style={styles.itemMeta}>Conectada · somente desativacao</Text>
                  )}
                  {busy ? (
                    <ActivityIndicator color={theme.danger} />
                  ) : (
                    <Pressable
                      onPress={() => confirmDeactivate(item)}
                      disabled={busyId !== null}
                      accessibilityRole="button"
                      accessibilityLabel={`Desativar ${item.name}`}
                      hitSlop={8}
                    >
                      <Text style={[styles.action, styles.actionDanger]}>Desativar</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            );
          }}
        />
      )}

      <Pressable
        style={styles.primary}
        onPress={() => setMode({ kind: "create" })}
        accessibilityRole="button"
      >
        <Text style={styles.primaryLabel}>Criar conta</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 64,
    paddingHorizontal: 20,
    paddingBottom: 24,
    backgroundColor: theme.respiro,
  },
  header: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    color: theme.confianca,
  },
  signOut: {
    color: theme.muted,
    textDecorationLine: "underline",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingVertical: 48,
  },
  muted: {
    color: theme.muted,
    textAlign: "center",
  },
  list: {
    gap: 10,
    paddingBottom: 16,
    flexGrow: 1,
  },
  item: {
    gap: 12,
    padding: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surface,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 20,
  },
  action: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.consciencia,
  },
  actionDanger: {
    color: theme.danger,
  },
  notice: {
    gap: 8,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 10,
    backgroundColor: theme.surface,
  },
  noticeError: {
    borderColor: theme.danger,
  },
  noticeText: {
    color: theme.confianca,
  },
  noticeErrorText: {
    color: theme.danger,
  },
  itemMain: {
    flex: 1,
    gap: 2,
  },
  itemName: {
    fontWeight: "600",
    color: theme.confianca,
  },
  itemMeta: {
    fontSize: 13,
    color: theme.muted,
  },
  balance: {
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
    color: theme.confianca,
  },
  primary: {
    alignItems: "center",
    paddingVertical: 14,
    borderRadius: 999,
    backgroundColor: theme.consciencia,
  },
  primaryLabel: {
    color: theme.onAccent,
    fontWeight: "600",
    fontSize: 16,
  },
  secondary: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.border,
  },
  secondaryLabel: {
    color: theme.confianca,
  },
});
