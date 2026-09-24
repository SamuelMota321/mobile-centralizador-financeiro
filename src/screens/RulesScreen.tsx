import { useCallback, useEffect, useState } from "react";
import { Alert, FlatList, RefreshControl, Text, View } from "react-native";
import { useAuth } from "../auth/AuthContext";
import { listAccounts } from "../lib/accounts/api";
import { isUnauthorized } from "../lib/accounts/messages";
import { listAllPages } from "../lib/api/pagination";
import { listCategories } from "../lib/categories/api";
import {
  activateCategoryRule,
  deactivateCategoryRule,
  listCategoryRules,
  removeCategoryRule,
} from "../lib/category-rules/api";
import type { CategoryRule } from "../lib/category-rules/types";
import { makeStyles, type, useTheme } from "../theme";
import { Button, EmptyState, Notice, type NoticeTone, SkeletonList, StatusChip } from "../ui/controls";
import { IconCategories, IconPlus, IconRules } from "../ui/icons";
import { AppScreen, type Section, useListStyles } from "../ui/screens";
import { PAGE_SIZE } from "./movement-presentation";
import { RuleFormScreen } from "./RuleFormScreen";
import {
  type CategoryOption,
  classifyRuleError,
  type NamedOption,
  ruleCategory,
  ruleCondition,
  STATUS_LABELS,
} from "./rule-logic";
import { useForegroundRefresh } from "./use-foreground-refresh";

type LoadState = "loading" | "ready" | "error";

type Mode = { kind: "list" } | { kind: "create" } | { kind: "edit"; rule: CategoryRule };

interface NoticeState {
  tone: NoticeTone;
  text: string;
}

/** Acrescenta a próxima página sem repetir ids deslocados por uma criação recente. */
function appendRules(current: CategoryRule[], next: CategoryRule[]): CategoryRule[] {
  const seen = new Set(current.map((item) => item.id));
  return [...current, ...next.filter((item) => !seen.has(item.id))];
}

export function RulesScreen({ onNavigate }: { onNavigate: (section: Section) => void }) {
  const { handleUnauthorized } = useAuth();
  const styles = useStyles();
  const list = useListStyles();
  const { colors } = useTheme();
  const [items, setItems] = useState<CategoryRule[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [state, setState] = useState<LoadState>("loading");
  const [categories, setCategories] = useState<CategoryOption[] | null>(null);
  const [accounts, setAccounts] = useState<NamedOption[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [mode, setMode] = useState<Mode>({ kind: "list" });
  const [notice, setNotice] = useState<NoticeState | null>(null);
  // Regra com ação em andamento: bloqueia toque duplo e outras ações.
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [rulesResult, categoriesResult, accountsResult] = await Promise.allSettled([
      listCategoryRules({ page: 1, pageSize: PAGE_SIZE }),
      listAllPages((query) => listCategories(query)),
      listAllPages((query) => listAccounts(query)),
    ]);

    if (
      [rulesResult, categoriesResult, accountsResult].some(
        (result) => result.status === "rejected" && isUnauthorized(result.reason),
      )
    ) {
      await handleUnauthorized();
      return;
    }

    setCategories(
      categoriesResult.status === "fulfilled"
        ? categoriesResult.value.items.map(({ id, name, status }) => ({ id, name, status }))
        : null,
    );
    setAccounts(
      accountsResult.status === "fulfilled"
        ? accountsResult.value.items.map(({ id, name }) => ({ id, name }))
        : null,
    );

    if (rulesResult.status === "rejected") {
      setState("error");
      return;
    }
    setItems(rulesResult.value.items);
    setTotal(rulesResult.value.total);
    setPage(1);
    setState("ready");
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
      const next = await listCategoryRules({ page: page + 1, pageSize: PAGE_SIZE });
      setItems((current) => appendRules(current, next.items));
      setTotal(next.total);
      setPage(next.page);
    } catch (error) {
      if (isUnauthorized(error)) {
        await handleUnauthorized();
        return;
      }
      setNotice({ tone: "error", text: "Não foi possível carregar mais regras." });
    } finally {
      setLoadingMore(false);
    }
  }, [handleUnauthorized, hasMore, loadingMore, page]);

  /** Ativar, desativar e remover: a lista só muda depois que a API confirma. */
  const runLifecycle = useCallback(
    async (rule: CategoryRule, action: "activate" | "deactivate" | "remove") => {
      setBusyId(rule.id);
      setNotice(null);
      const operations = {
        activate: {
          call: activateCategoryRule,
          success: "Regra ativada. Ela volta a valer para novas movimentações.",
          fallback: "Não foi possível ativar a regra.",
        },
        deactivate: {
          call: deactivateCategoryRule,
          success: "Regra desativada. Ela deixa de ser aplicada até ser ativada de novo.",
          fallback: "Não foi possível desativar a regra.",
        },
        remove: {
          call: removeCategoryRule,
          success: "Regra removida. Ela continua visível como removida e não pode ser reativada.",
          fallback: "Não foi possível remover a regra.",
        },
      } as const;
      const operation = operations[action];
      try {
        await operation.call(rule.id);
        setNotice({ tone: "success", text: operation.success });
        await load();
      } catch (error) {
        const failure = classifyRuleError(error, operation.fallback);
        if (failure.kind === "unauthorized") {
          await handleUnauthorized();
          return;
        }
        if (failure.kind === "stale") {
          setNotice({ tone: "info", text: failure.message });
          await load();
          return;
        }
        setNotice({
          tone: "error",
          text: failure.kind === "message" ? failure.message : `${operation.fallback} Tente de novo.`,
        });
      } finally {
        setBusyId(null);
      }
    },
    [handleUnauthorized, load],
  );

  const confirmRemove = useCallback(
    (rule: CategoryRule) => {
      Alert.alert(
        "Remover regra",
        "Ela deixa de ser aplicada e continua visível como removida, mas não poderá ser reativada nem editada. As movimentações já categorizadas por ela não mudam.",
        [
          { text: "Cancelar", style: "cancel" },
          { text: "Remover", style: "destructive", onPress: () => void runLifecycle(rule, "remove") },
        ],
        { cancelable: true },
      );
    },
    [runLifecycle],
  );

  const backToList = useCallback(
    (tone: NoticeTone) => (message: string) => {
      setMode({ kind: "list" });
      setNotice({ tone, text: message });
      void load();
    },
    [load],
  );

  const activeCategories = (categories ?? []).filter((category) => category.status === "active");
  const canCreate = state === "ready" && categories !== null && accounts !== null && activeCategories.length > 0;

  if (mode.kind !== "list" && categories !== null && accounts !== null) {
    return (
      <RuleFormScreen
        rule={mode.kind === "edit" ? mode.rule : undefined}
        categories={activeCategories}
        accounts={accounts}
        onCancel={() => setMode({ kind: "list" })}
        onDone={backToList("success")}
        onStale={backToList("info")}
      />
    );
  }

  const subtitle =
    state !== "ready"
      ? undefined
      : total === 0
        ? "Categorize automaticamente as próximas movimentações."
        : `${total} ${total === 1 ? "regra" : "regras"} · da maior para a menor prioridade`;

  const header = (
    <View style={styles.header}>
      {notice ? (
        <Notice
          tone={notice.tone}
          text={notice.text}
          action={{ label: "Fechar", onPress: () => setNotice(null) }}
        />
      ) : null}
      {/* Explicação permanente da precedência: a interface explica, o backend decide. */}
      <Notice
        tone="info"
        text="Quando uma movimentação nova combina com mais de uma regra ativa, vale a de maior prioridade; em empate, a mais antiga. Sua escolha manual sempre prevalece. As regras não alteram movimentações já registradas."
      />
      {state === "ready" && (categories === null || accounts === null) ? (
        <Notice
          tone="warning"
          text={`Não foi possível carregar suas ${categories === null ? "categorias" : "contas"}. Os nomes podem aparecer como indisponíveis e a criação de regras fica pausada.`}
          action={{ label: "Tentar de novo", onPress: () => void load() }}
        />
      ) : null}
      {state === "ready" && categories !== null && activeCategories.length === 0 ? (
        <EmptyState
          icon={(color) => <IconCategories size={24} color={color} />}
          title="Crie uma categoria primeiro"
          text="Uma regra aplica uma categoria sua. Você precisa de ao menos uma categoria ativa para criar regras."
          action={<Button label="Ir para Categorias" onPress={() => onNavigate("categorias")} />}
        />
      ) : null}
    </View>
  );

  return (
    <AppScreen
      section="regras"
      onNavigate={onNavigate}
      title="Regras"
      subtitle={subtitle}
      footer={
        canCreate ? (
          <Button
            label="Nova regra"
            onPress={() => setMode({ kind: "create" })}
            icon={(color) => <IconPlus size={20} color={color} />}
          />
        ) : null
      }
    >
      {state === "loading" ? (
        <View style={list.list}>
          <SkeletonList rows={4} />
        </View>
      ) : state === "error" ? (
        <View style={list.list}>
          <EmptyState
            icon={(color) => <IconRules size={24} color={color} />}
            title="Não foi possível carregar suas regras"
            text="Pode ser uma falha momentânea de conexão. Suas regras não foram alteradas."
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
          ListHeaderComponent={header}
          ListEmptyComponent={
            canCreate ? (
              <EmptyState
                icon={(color) => <IconRules size={24} color={color} />}
                title="Nenhuma regra ainda"
                text="Uma regra pessoal diz, por exemplo: se a descrição contém “mercado”, use Alimentação. Toque em Nova regra para criar a primeira."
              />
            ) : null
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
            const removed = item.status === "removed";
            const busy = busyId === item.id;
            const category = ruleCategory(item, categories);
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
                  <Text style={[styles.sentence, removed && styles.muted]}>
                    {ruleCondition(item, accounts)} →{" "}
                    <Text style={styles.category}>{category.name}</Text>
                    {category.archived ? " (arquivada)" : ""}
                  </Text>
                  <StatusChip tone={item.status === "active" ? "positive" : "neutral"} label={STATUS_LABELS[item.status]} />
                </View>
                <Text style={styles.meta}>
                  Prioridade {item.priority}
                  {category.archived && !removed
                    ? " · Não será aplicada enquanto a categoria estiver arquivada."
                    : ""}
                  {removed ? " · Somente leitura" : ""}
                </Text>
                {removed ? null : (
                  <View style={styles.actions}>
                    <Button
                      variant="text"
                      label="Editar"
                      accessibilityLabel={`Editar a regra ${ruleCondition(item, accounts)}`}
                      onPress={() => setMode({ kind: "edit", rule: item })}
                      disabled={busyId !== null || categories === null || accounts === null}
                    />
                    <Button
                      variant="text"
                      label={item.status === "active" ? "Desativar" : "Ativar"}
                      onPress={() => void runLifecycle(item, item.status === "active" ? "deactivate" : "activate")}
                      disabled={busyId !== null}
                      loading={busy}
                    />
                    <Button
                      variant="textDanger"
                      label="Remover"
                      accessibilityLabel={`Remover a regra ${ruleCondition(item, accounts)}`}
                      onPress={() => confirmRemove(item)}
                      disabled={busyId !== null}
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
  header: { gap: 8, paddingBottom: 12 },
  more: { paddingTop: 12 },
  item: { gap: 6 },
  row: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  sentence: { ...type.body, color: c.foreground, flex: 1 },
  category: { fontFamily: "Manrope_800ExtraBold" },
  // Removida fica secundária, mas legível; o status também aparece em texto.
  muted: { color: c.muted },
  meta: { ...type.micro, fontFamily: "Manrope_500Medium", color: c.muted, fontVariant: ["tabular-nums"] },
  actions: { flexDirection: "row", flexWrap: "wrap", columnGap: 20 },
}));
