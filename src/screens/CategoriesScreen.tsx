import { useCallback, useEffect, useState } from "react";
import { Alert, FlatList, RefreshControl, Text, View } from "react-native";
import { useAuth } from "../auth/AuthContext";
import { isUnauthorized } from "../lib/accounts/messages";
import { deactivateCategory, listCategories } from "../lib/categories/api";
import type { Category } from "../lib/categories/types";
import { makeStyles, type, useTheme } from "../theme";
import { Button, EmptyState, Notice, type NoticeTone, SkeletonList, StatusChip } from "../ui/controls";
import { IconCategories, IconPlus } from "../ui/icons";
import { AppScreen, type Section, useListStyles } from "../ui/screens";
import { CATEGORY_STATUS_LABELS, classifyCategoryError } from "./category-logic";
import { CategoryFormScreen } from "./CategoryFormScreen";
import { PAGE_SIZE } from "./movement-presentation";
import { useForegroundRefresh } from "./use-foreground-refresh";

type LoadState = "loading" | "ready" | "error";

type Mode = { kind: "list" } | { kind: "create" } | { kind: "rename"; category: Category };

interface NoticeState {
  tone: NoticeTone;
  text: string;
}

/** Acrescenta a próxima página sem repetir ids deslocados por uma criação recente. */
function appendCategories(current: Category[], next: Category[]): Category[] {
  const seen = new Set(current.map((item) => item.id));
  return [...current, ...next.filter((item) => !seen.has(item.id))];
}

export function CategoriesScreen({ onNavigate }: { onNavigate: (section: Section) => void }) {
  const { handleUnauthorized } = useAuth();
  const styles = useStyles();
  const list = useListStyles();
  const { colors } = useTheme();
  const [items, setItems] = useState<Category[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [state, setState] = useState<LoadState>("loading");
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [mode, setMode] = useState<Mode>({ kind: "list" });
  const [notice, setNotice] = useState<NoticeState | null>(null);
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
      setNotice({ tone: "error", text: "Não foi possível carregar mais categorias." });
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
          tone: "success",
          text: "Categoria arquivada. Ela continua no histórico, mas não pode mais ser atribuída.",
        });
        await load();
      } catch (error) {
        const failure = classifyCategoryError(error, "Não foi possível arquivar a categoria.");
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
        `Arquivar “${category.name}”? Ela continua visível no histórico das movimentações, mas não poderá ser atribuída de novo nem reativada.`,
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
      setNotice({ tone: "success", text: message });
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

  const subtitle =
    state !== "ready"
      ? undefined
      : total === 0
        ? "Organize suas movimentações com categorias pessoais."
        : `${total} ${total === 1 ? "categoria" : "categorias"} · ativas e arquivadas`;

  return (
    <AppScreen
      section="categorias"
      onNavigate={onNavigate}
      title="Categorias"
      subtitle={subtitle}
      footer={
        state === "ready" ? (
          <Button
            label="Nova categoria"
            onPress={() => setMode({ kind: "create" })}
            icon={(color) => <IconPlus size={20} color={color} />}
          />
        ) : null
      }
    >
      {notice ? (
        <View style={list.notices}>
          <Notice
            tone={notice.tone}
            text={notice.text}
            action={{ label: "Fechar", onPress: () => setNotice(null) }}
          />
        </View>
      ) : null}

      {state === "loading" ? (
        <View style={list.list}>
          <SkeletonList rows={5} />
        </View>
      ) : state === "error" ? (
        <View style={list.list}>
          <EmptyState
            icon={(color) => <IconCategories size={24} color={color} />}
            title="Não foi possível carregar suas categorias"
            text="Pode ser uma falha momentânea de conexão. Suas categorias não foram alteradas."
            action={
              <Button
                variant="secondary"
                label="Tentar de novo"
                onPress={() => {
                  setState("loading");
                  void load();
                }}
              />
            }
          />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={list.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void refresh()}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon={(color) => <IconCategories size={24} color={color} />}
              title="Nenhuma categoria ainda"
              text="Categorias ajudam a entender para onde vai o dinheiro. Nenhuma vem pronta: crie a primeira e atribua às suas movimentações."
            />
          }
          ListFooterComponent={
            hasMore ? (
              <View style={styles.more}>
                <Button
                  variant="secondary"
                  label="Carregar mais"
                  onPress={() => void loadMore()}
                  loading={loadingMore}
                />
              </View>
            ) : null
          }
          renderItem={({ item, index }) => {
            const archived = item.status === "archived";
            const busy = busyId === item.id;
            return (
              <View
                style={[
                  list.item,
                  index === 0 && list.itemFirst,
                  index === items.length - 1 && list.itemLast,
                  styles.item,
                ]}
              >
                <View style={styles.row}>
                  <Text style={[styles.name, archived && styles.nameArchived]}>{item.name}</Text>
                  <StatusChip
                    tone={archived ? "neutral" : "positive"}
                    label={CATEGORY_STATUS_LABELS[item.status]}
                  />
                </View>
                {archived ? (
                  <Text style={styles.meta}>Continua no histórico; não pode mais ser atribuída.</Text>
                ) : (
                  <View style={styles.actions}>
                    <Button
                      variant="text"
                      label="Renomear"
                      accessibilityLabel={`Renomear ${item.name}`}
                      onPress={() => setMode({ kind: "rename", category: item })}
                      disabled={busy}
                    />
                    <Button
                      variant="textDanger"
                      label="Arquivar"
                      accessibilityLabel={`Arquivar ${item.name}`}
                      onPress={() => confirmArchive(item)}
                      disabled={busyId !== null}
                      loading={busy}
                    />
                  </View>
                )}
              </View>
            );
          }}
        />
      )}
    </AppScreen>
  );
}

const useStyles = makeStyles((c) => ({
  more: { paddingTop: 12 },
  item: { gap: 6 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  name: { ...type.body, fontFamily: "Manrope_700Bold", color: c.foreground, flex: 1 },
  // Arquivada fica secundária, mas legível; o status também aparece em texto.
  nameArchived: { fontFamily: "Manrope_600SemiBold", color: c.muted },
  meta: { ...type.micro, fontFamily: "Manrope_500Medium", color: c.muted },
  actions: { flexDirection: "row", gap: 20 },
}));
