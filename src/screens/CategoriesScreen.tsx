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
import { isUnauthorized } from "../lib/accounts/messages";
import { deactivateCategory, listCategories } from "../lib/categories/api";
import type { Category } from "../lib/categories/types";
import { theme } from "../theme";
import { CATEGORY_STATUS_LABELS, classifyCategoryError } from "./category-logic";
import { CategoryFormScreen } from "./CategoryFormScreen";
import { PAGE_SIZE } from "./movement-presentation";
import { type Section, SectionTabs } from "./SectionTabs";
import { useForegroundRefresh } from "./use-foreground-refresh";

type LoadState = "loading" | "ready" | "error";

type Mode = { kind: "list" } | { kind: "create" } | { kind: "rename"; category: Category };

interface Notice {
  tone: "info" | "error";
  text: string;
}

/** Acrescenta a proxima pagina sem repetir ids deslocados por uma criacao recente. */
function appendCategories(current: Category[], next: Category[]): Category[] {
  const seen = new Set(current.map((item) => item.id));
  return [...current, ...next.filter((item) => !seen.has(item.id))];
}

export function CategoriesScreen({ onNavigate }: { onNavigate: (section: Section) => void }) {
  const { signOut, handleUnauthorized } = useAuth();
  const [items, setItems] = useState<Category[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [state, setState] = useState<LoadState>("loading");
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [mode, setMode] = useState<Mode>({ kind: "list" });
  const [notice, setNotice] = useState<Notice | null>(null);
  // Categoria com arquivamento em andamento: bloqueia toque duplo.
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const first = await listCategories({ page: 1, pageSize: PAGE_SIZE });
      setItems(first.items);
      setTotal(first.total);
      setPage(1);
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

  useForegroundRefresh(() => void load());

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const hasMore = page * PAGE_SIZE < total;

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const next = await listCategories({ page: page + 1, pageSize: PAGE_SIZE });
      setItems((current) => appendCategories(current, next.items));
      setTotal(next.total);
      setPage(next.page);
    } catch (error) {
      if (isUnauthorized(error)) {
        await handleUnauthorized();
        return;
      }
      setNotice({ tone: "error", text: "Nao foi possivel carregar mais categorias." });
    } finally {
      setLoadingMore(false);
    }
  }, [handleUnauthorized, hasMore, loadingMore, page]);

  const archive = useCallback(
    async (category: Category) => {
      setBusyId(category.id);
      setNotice(null);
      try {
        await deactivateCategory(category.id);
        setNotice({
          tone: "info",
          text: "Categoria arquivada. Ela continua no historico, mas nao pode mais ser atribuida.",
        });
        await load();
      } catch (error) {
        const failure = classifyCategoryError(error, "Nao foi possivel arquivar a categoria.");
        if (failure.kind === "unauthorized") {
          await handleUnauthorized();
          return;
        }
        setNotice({ tone: failure.kind === "unavailable" ? "info" : "error", text: failure.message });
        if (failure.kind === "unavailable") await load();
      } finally {
        setBusyId(null);
      }
    },
    [handleUnauthorized, load],
  );

  const confirmArchive = useCallback(
    (category: Category) => {
      Alert.alert(
        "Arquivar categoria",
        `Arquivar \u201c${category.name}\u201d? Ela continua visivel no historico das movimentacoes, mas nao podera ser atribuida de novo nem reativada.`,
        [
          { text: "Cancelar", style: "cancel" },
          { text: "Arquivar", style: "destructive", onPress: () => void archive(category) },
        ],
        { cancelable: true },
      );
    },
    [archive],
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
      <CategoryFormScreen
        category={mode.kind === "rename" ? mode.category : undefined}
        onCancel={() => setMode({ kind: "list" })}
        onDone={finishForm}
      />
    );
  }

  return (
    <View style={styles.container}>
      <SectionTabs current="categorias" onNavigate={onNavigate} />
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">
          Categorias
        </Text>
        <Pressable onPress={() => void signOut()} accessibilityRole="button" hitSlop={8}>
          <Text style={styles.link}>Sair</Text>
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
          <Pressable onPress={() => setNotice(null)} accessibilityRole="button" hitSlop={8}>
            <Text style={styles.link}>Fechar</Text>
          </Pressable>
        </View>
      ) : null}

      {state === "loading" ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.consciencia} accessibilityLabel="Carregando" />
        </View>
      ) : state === "error" ? (
        <View style={styles.center}>
          <Text style={styles.muted}>Nao foi possivel carregar suas categorias.</Text>
          <Pressable
            style={styles.secondary}
            onPress={() => {
              setState("loading");
              void load();
            }}
            accessibilityRole="button"
          >
            <Text style={styles.secondaryLabel}>Tentar de novo</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.muted}>
                Suas categorias sao pessoais: nenhuma vem pronta. Crie a primeira para
                organizar suas movimentacoes.
              </Text>
            </View>
          }
          ListFooterComponent={
            hasMore ? (
              <Pressable
                style={styles.secondary}
                onPress={() => void loadMore()}
                disabled={loadingMore}
                accessibilityRole="button"
                accessibilityState={{ busy: loadingMore }}
              >
                {loadingMore ? (
                  <ActivityIndicator color={theme.consciencia} />
                ) : (
                  <Text style={styles.secondaryLabel}>Carregar mais</Text>
                )}
              </Pressable>
            ) : null
          }
          renderItem={({ item, index }) => {
            const archived = item.status === "archived";
            const busy = busyId === item.id;
            return (
              <View
                style={[
                  styles.item,
                  index === 0 && styles.itemFirst,
                  index === items.length - 1 && styles.itemLast,
                ]}
              >
                <View style={styles.itemRow}>
                  <Text style={[styles.itemName, archived && styles.itemNameArchived]}>
                    {item.name}
                  </Text>
                  <Text style={styles.status}>{CATEGORY_STATUS_LABELS[item.status]}</Text>
                </View>
                {archived ? (
                  <Text style={styles.itemMeta}>
                    Continua no historico; nao pode mais ser atribuida.
                  </Text>
                ) : (
                  <View style={styles.actions}>
                    <Pressable
                      onPress={() => setMode({ kind: "rename", category: item })}
                      disabled={busy}
                      accessibilityRole="button"
                      accessibilityLabel={`Renomear ${item.name}`}
                      hitSlop={10}
                    >
                      <Text style={styles.action}>Renomear</Text>
                    </Pressable>
                    {busy ? (
                      <ActivityIndicator color={theme.danger} />
                    ) : (
                      <Pressable
                        onPress={() => confirmArchive(item)}
                        disabled={busyId !== null}
                        accessibilityRole="button"
                        accessibilityLabel={`Arquivar ${item.name}`}
                        hitSlop={10}
                      >
                        <Text style={[styles.action, styles.actionDanger]}>Arquivar</Text>
                      </Pressable>
                    )}
                  </View>
                )}
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
        <Text style={styles.primaryLabel}>Criar categoria</Text>
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
  link: {
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
    paddingBottom: 16,
    flexGrow: 1,
  },
  // Style guide: bordas discretas entre linhas no lugar de um cartao por item.
  item: {
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: theme.border,
    backgroundColor: theme.surface,
  },
  itemFirst: {
    borderTopWidth: 1,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  itemLast: {
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    marginBottom: 12,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 12,
  },
  itemName: {
    flex: 1,
    fontWeight: "600",
    color: theme.confianca,
  },
  // Arquivada fica secundaria, mas legivel; o status tambem aparece em texto.
  itemNameArchived: {
    color: theme.muted,
  },
  itemMeta: {
    fontSize: 13,
    color: theme.muted,
  },
  status: {
    fontSize: 13,
    fontWeight: "600",
    color: theme.muted,
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
  primary: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
    borderRadius: 999,
    backgroundColor: theme.consciencia,
  },
  primaryLabel: {
    color: theme.onAccent,
    fontWeight: "600",
    fontSize: 16,
  },
  secondary: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 20,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.border,
  },
  secondaryLabel: {
    color: theme.confianca,
  },
});
