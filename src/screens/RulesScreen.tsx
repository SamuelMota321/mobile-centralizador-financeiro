import { useCallback, useEffect, useState } from "react";
import { Alert, FlatList, RefreshControl, Text, View } from "react-native";
import { useAuth } from "../auth/AuthContext";
import { listAccounts } from "../lib/accounts/api";
import { isUnauthorized } from "../lib/accounts/messages";
import { listAllPages } from "../lib/api/pagination";
import { listCategories } from "../lib/categories/api";
import { applyRulePack } from "../lib/categories/apply-suggestions";
import { rulesToCreate, splitSuggestedRules } from "../lib/categories/suggestions";
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
import { RuleFormScreen } from "./RuleFormScreen";
import { RulePackSection } from "./RulePackSection";
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

export function RulesScreen({ onNavigate }: { onNavigate: (section: Section) => void }) {
  const { handleUnauthorized } = useAuth();
  const styles = useStyles();
  const list = useListStyles();
  const { colors } = useTheme();
  const [items, setItems] = useState<CategoryRule[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [state, setState] = useState<LoadState>("loading");
  const [categories, setCategories] = useState<CategoryOption[] | null>(null);
  const [accounts, setAccounts] = useState<NamedOption[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [mode, setMode] = useState<Mode>({ kind: "list" });
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [applyingPack, setApplyingPack] = useState(false);
  // Regra com ação em andamento: bloqueia toque duplo e outras ações.
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [rulesResult, categoriesResult, accountsResult] = await Promise.allSettled([
      // Todas as regras (até 500): as sugeridas são agrupadas, o que pede a lista inteira.
      listAllPages((query) => listCategoryRules(query)),
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
    setTruncated(rulesResult.value.truncated);
    setState("ready");
  }, [handleUnauthorized]);

  const addRulePack = useCallback(async () => {
    setApplyingPack(true);
    const result = await applyRulePack();
    setApplyingPack(false);
    if (!result.ok && isUnauthorized(result.error)) {
      await handleUnauthorized();
      return;
    }
    if (result.ok) {
      const missing = result.missingCategories.length > 0 ? ` Ficaram de fora as de ${result.missingCategories.join(", ")}: essas categorias não existem ou estão arquivadas.` : "";
      setNotice({
        tone: result.created > 0 ? "success" : "info",
        text: (result.created > 0 ? `${result.created} ${result.created === 1 ? "regra adicionada" : "regras adicionadas"}.` : "Todas as regras do pacote já existem para as suas categorias.") + missing,
      });
    } else {
      setNotice({ tone: "error", text: `Não foi possível adicionar o pacote inteiro. ${result.created > 0 ? `${result.created} regras entraram; ` : ""}toque de novo para criar as que faltam.` });
    }
    await load();
  }, [handleUnauthorized, load]);

  useEffect(() => {
    void load();
  }, [load]);

  useForegroundRefresh(() => void load());

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

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
      : items.length === 0
        ? "Categorize automaticamente as próximas movimentações."
        : `${items.length} ${items.length === 1 ? "regra" : "regras"} · da maior para a menor prioridade`;

  // Só exibição: as regras do pacote ficam num grupo recolhido; as da pessoa aparecem abertas.
  const { personal, suggested, suggestedCount } = splitSuggestedRules(items, categories);
  const pack = categories ? rulesToCreate(categories, items) : null;
  const missingFromPack = pack?.toCreate.length ?? 0;

  const renderRule = (item: CategoryRule, first: boolean, last: boolean) => {
            const removed = item.status === "removed";
            const busy = busyId === item.id;
            const category = ruleCategory(item, categories);
            return (
              <View
                style={[
                  list.item,
                  first && list.itemFirst,
                  last && list.itemLast,
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
  };

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
          data={personal}
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
            canCreate && suggestedCount === 0 ? (
              <EmptyState
                icon={(color) => <IconRules size={24} color={color} />}
                title="Nenhuma regra ainda"
                text="Uma regra pessoal diz, por exemplo: se a descrição contém “mercado”, use Alimentação. Toque em Nova regra para criar a primeira."
              />
            ) : null
          }
          ListFooterComponent={
            <View style={styles.footer}>
              {truncated ? <Notice tone="info" text="Você tem mais de 500 regras: a lista mostra só as primeiras." /> : null}
              {state === "ready" && categories !== null ? (
                <RulePackSection
                  canApply={activeCategories.length > 0}
                  applying={applyingPack}
                  onApply={() => void addRulePack()}
                  onGoToCategories={() => onNavigate("categorias")}
                  groups={suggested}
                  count={suggestedCount}
                  missing={missingFromPack}
                  missingCategories={pack?.missingCategories ?? []}
                  renderRule={renderRule}
                />
              ) : null}
            </View>
          }
          renderItem={({ item, index }) => renderRule(item, index === 0, index === personal.length - 1)}
        />
      )}
    </AppScreen>
  );
}

const useStyles = makeStyles((c) => ({
  header: { gap: 8, paddingBottom: 12 },
  footer: { gap: 12, paddingTop: 16 },
  item: { gap: 6 },
  row: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  sentence: { ...type.body, color: c.foreground, flex: 1 },
  category: { fontFamily: "Manrope_800ExtraBold" },
  // Removida fica secundária, mas legível; o status também aparece em texto.
  muted: { color: c.muted },
  meta: { ...type.micro, fontFamily: "Manrope_500Medium", color: c.muted, fontVariant: ["tabular-nums"] },
  actions: { flexDirection: "row", flexWrap: "wrap", columnGap: 20 },
}));
