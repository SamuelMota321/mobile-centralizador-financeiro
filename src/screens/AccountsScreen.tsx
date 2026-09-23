import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useAuth } from "../auth/AuthContext";
import { listAccounts } from "../lib/accounts/api";
import { ProblemDetailsError, PROBLEM_CODES } from "../lib/api/errors";
import type { Account } from "../lib/accounts/types";
import { theme } from "../theme";
import { ACCOUNT_TYPE_LABELS } from "./account-type-labels";
import { AccountFormScreen } from "./AccountFormScreen";

type LoadState = "loading" | "ready" | "error";

export function AccountsScreen() {
  const { signOut, handleUnauthorized } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      const page = await listAccounts();
      setAccounts(page.items);
      setState("ready");
    } catch (error) {
      if (
        error instanceof ProblemDetailsError &&
        error.code === PROBLEM_CODES.authenticationRequired
      ) {
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

  if (creating) {
    return (
      <AccountFormScreen
        onCancel={() => setCreating(false)}
        onCreated={() => {
          setCreating(false);
          void load();
        }}
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
          renderItem={({ item }) => (
            <View style={styles.item}>
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
          )}
        />
      )}

      <Pressable
        style={styles.primary}
        onPress={() => setCreating(true)}
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surface,
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
