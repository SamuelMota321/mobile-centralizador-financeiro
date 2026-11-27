import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useAuth } from "../auth/AuthContext";
import { listAccounts } from "../lib/accounts/api";
import { isUnauthorized } from "../lib/accounts/messages";
import { listAllPages, SELECTOR_ITEM_LIMIT } from "../lib/api/pagination";
import { listCategories } from "../lib/categories/api";
import type { Category } from "../lib/categories/types";
import { addPackGroup, applyRulePack, setSuggestedGroupStatus } from "../lib/categories/apply-suggestions";
import { categoryColors, idsByCreation } from "../lib/categories/category-colors";
import { RULE_PACK, rulePackSize, rulesToCreate, splitSuggestedRules } from "../lib/categories/suggestions";
import { activateCategoryRule, deactivateCategoryRule, listCategoryRules, removeCategoryRule } from "../lib/category-rules/api";
import { applicationQueue } from "../lib/category-rules/evaluation";
import type { CategoryRule } from "../lib/category-rules/types";
import { listTransactions } from "../lib/transactions/api";
import { makeStyles, radius, type, useTheme } from "../theme";
import { Banner, CollapsibleCard, Pager, SectionCard } from "../ui/blocks";
import { CategoryBadge } from "../ui/category-badge";
import { CategoryTile } from "../ui/category-tile";
import { Button, EmptyState, Notice, type NoticeTone, SkeletonList } from "../ui/controls";
import { IconArrowRight, IconCategories, IconCheck, IconLightbulb, IconPause, IconPlus, IconRules, IconSparkles, IconTrash } from "../ui/icons";
import { FilterChips, SearchField } from "../ui/list-tools";
import { AppScreen, type Section } from "../ui/screens";
import { RuleFormScreen } from "./RuleFormScreen";
import { RuleSimulatorScreen } from "./RuleSimulatorScreen";
import { paginate } from "./category-presentation";
import {
  type CategoryOption,
  CATEGORY_FALLBACK,
  classifyRuleError,
  type NamedOption,
  ruleCategory,
  ruleCondition,
  STATUS_LABELS,
} from "./rule-logic";
import {
  DEFAULT_RULE_VIEW,
  filterRules,
  RULE_SORTS,
  RULES_PAGE_SIZE,
  type RuleSort,
  type RuleView,
  sortRules,
  STATUS_FILTERS,
  type StatusFilter,
  statusCounts,
  uncategorizedDescriptions,
} from "./rule-presentation";
import { useForegroundRefresh } from "./use-foreground-refresh";

type LoadState = "loading" | "ready" | "error";

type Mode = { kind: "list" } | { kind: "create"; initialValue?: string } | { kind: "edit"; rule: CategoryRule } | { kind: "simulate" };

interface NoticeState {
  tone: NoticeTone;
  text: string;
}

const STATUS_OPTIONS = (Object.entries(STATUS_FILTERS) as [StatusFilter, string][]).map(([value, label]) => ({ value, label }));
const SORT_OPTIONS = (Object.entries(RULE_SORTS) as [RuleSort, string][]).map(([value, label]) => ({ value, label }));

function normalize(text: string): string {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}

export function RulesScreen({ onNavigate }: { onNavigate: (section: Section) => void }) {
  const { handleUnauthorized } = useAuth();
  const styles = useStyles();
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
  const [categoriesFull, setCategoriesFull] = useState<Category[] | null>(null);
  const [recent, setRecent] = useState<string[]>([]);
  const [view, setView] = useState<RuleView>(DEFAULT_RULE_VIEW);
  const [page, setPage] = useState(1);
  const [packOpen, setPackOpen] = useState(false);
  const [removedOpen, setRemovedOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [groupBusy, setGroupBusy] = useState<string | null>(null);
  // Regra com ação em andamento: bloqueia toque duplo e outras ações.
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [rulesResult, categoriesResult, accountsResult, recentResult] = await Promise.allSettled([
      // Todas as regras (até 500): as sugeridas são agrupadas, o que pede a lista inteira.
      listAllPages((query) => listCategoryRules(query)),
      listAllPages((query) => listCategories(query)),
      listAllPages((query) => listAccounts(query)),
      listTransactions({ page: 1, pageSize: 50 }),
    ]);
    setRecent(recentResult.status === "fulfilled" ? uncategorizedDescriptions(recentResult.value.items) : []);

    if (
      [rulesResult, categoriesResult, accountsResult].some(
        (result) => result.status === "rejected" && isUnauthorized(result.reason),
      )
    ) {
      await handleUnauthorized();
      return;
    }

    setCategoriesFull(categoriesResult.status === "fulfilled" ? categoriesResult.value.items : null);
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

  /** Ativar ou desativar o grupo inteiro de sugeridas de uma categoria. */
  const runGroup = useCallback(
    async (category: string, target: "active" | "inactive") => {
      setGroupBusy(category);
      const result = await setSuggestedGroupStatus(category, target);
      setGroupBusy(null);
      if (!result.ok && isUnauthorized(result.error)) {
        await handleUnauthorized();
        return;
      }
      const verb = target === "active" ? "ativada" : "desativada";
      setNotice(
        result.ok
          ? { tone: "success", text: result.created > 0 ? `${result.created} ${result.created === 1 ? "regra" : "regras"} de ${category} ${result.created === 1 ? verb : `${verb}s`}.` : `Nada a mudar em ${category}.` }
          : { tone: "error", text: `Não foi possível ${target === "active" ? "ativar" : "desativar"} o grupo inteiro. ${result.created > 0 ? `${result.created} mudaram; ` : ""}toque de novo para as que faltam.` },
      );
      await load();
    },
    [handleUnauthorized, load],
  );

  /** Adicionar um grupo do pacote: a categoria, se faltar, e as regras dela. */
  const runAddGroup = useCallback(
    async (category: string) => {
      setGroupBusy(category);
      const result = await addPackGroup(category);
      setGroupBusy(null);
      if (!result.ok && isUnauthorized(result.error)) {
        await handleUnauthorized();
        return;
      }
      setNotice(
        result.ok
          ? { tone: "success", text: `${category}: ${result.created} ${result.created === 1 ? "regra adicionada" : "regras adicionadas"}${result.createdCategory ? ", e a categoria foi criada" : ""}.` }
          : { tone: "error", text: `Não foi possível adicionar o grupo ${category} inteiro. ${result.created > 0 ? `${result.created} entraram; ` : ""}toque de novo para o que falta.` },
      );
      await load();
    },
    [handleUnauthorized, load],
  );

  const colorMap = useMemo(
    () => (categoriesFull ? categoryColors(idsByCreation(categoriesFull), colors.categories, colors.categoryOther) : new Map<string, string>()),
    [categoriesFull, colors.categories, colors.categoryOther],
  );
  const colorOf = (categoryId: string) => {
    const found = categories?.find((category) => category.id.toLowerCase() === categoryId.toLowerCase());
    return found ? (colorMap.get(found.id) ?? null) : null;
  };
  const categoryName = (categoryId: string) => categories?.find((category) => category.id.toLowerCase() === categoryId.toLowerCase())?.name ?? CATEGORY_FALLBACK;

  const activeCategories = (categories ?? []).filter((category) => category.status === "active");
  const activeIds = useMemo(() => new Set(activeCategories.map((category) => category.id.toLowerCase())), [activeCategories]);
  const canCreate = state === "ready" && categories !== null && accounts !== null && activeCategories.length > 0;

  if (mode.kind === "simulate" && categories !== null) {
    const queue = applicationQueue(items, activeIds);
    return (
      <RuleSimulatorScreen
        rules={items.filter((rule) => rule.status !== "removed")}
        categories={categories}
        colors={colorMap}
        accounts={accounts}
        positions={queue.position}
        recent={recent}
        onCancel={() => setMode({ kind: "list" })}
        onCreateWith={(term) => setMode({ kind: "create", initialValue: term })}
      />
    );
  }

  if ((mode.kind === "create" || mode.kind === "edit") && categories !== null && accounts !== null) {
    return (
      <RuleFormScreen
        rule={mode.kind === "edit" ? mode.rule : undefined}
        initialValue={mode.kind === "create" ? mode.initialValue : undefined}
        categories={activeCategories}
        accounts={accounts}
        onCancel={() => setMode({ kind: "list" })}
        onDone={backToList("success")}
        onStale={backToList("info")}
      />
    );
  }

  const counts = statusCounts(items);
  const live = items.filter((rule) => rule.status !== "removed");
  const removed = items.filter((rule) => rule.status === "removed");
  // Só exibição: as do pacote ficam agrupadas; removidas têm bloco próprio.
  const { personal, suggested, suggestedCount } = splitSuggestedRules(live, categories);
  const pack = categories ? rulesToCreate(categories, items) : null;
  const missingFromPack = pack?.toCreate.length ?? 0;
  const suggestedIds = new Set(suggested.flatMap((group) => group.rules.map((rule) => rule.id)));
  const filtering = view.search !== "" || view.status !== "todas";
  const listed = sortRules(filterRules(filtering ? live : personal, view, categoryName, accounts), view.sort, categoryName);
  const listedPage = paginate(listed, page, RULES_PAGE_SIZE);

  const subtitle = state !== "ready" ? undefined : "Automatize a categorização dos seus lançamentos e ganhe tempo.";

  const renderRule = (item: CategoryRule, options: { suggested?: boolean } = {}) => {
    const isRemoved = item.status === "removed";
    const busy = busyId === item.id;
    const category = ruleCategory(item, categories);
    const condition = ruleCondition(item, accounts);
    return (
      <View key={`${item.id}:${item.updatedAt}`} style={styles.ruleWrap}>
        <View style={styles.rule}>
          <CategoryBadge name={category.name} color={category.archived || isRemoved ? null : colorOf(item.categoryId)} />
          <View style={styles.ruleBody}>
            <Text style={[styles.sentence, (isRemoved || item.status === "inactive") && styles.muted]}>
              {condition} → <Text style={styles.category}>{category.name}</Text>
              {category.archived ? " (arquivada)" : ""}
            </Text>
            <View style={styles.ruleMeta}>
              <View style={styles.pill}>
                <Text style={styles.pillText}>Prioridade {item.priority}</Text>
              </View>
              <View style={styles.statusLine}>
                <View style={[styles.dot, item.status === "active" && styles.dotOn]} />
                <Text style={styles.statusText}>{STATUS_LABELS[item.status]}</Text>
              </View>
            </View>
            {options.suggested ? <Text style={styles.note}>Regra sugerida</Text> : null}
            {category.archived && !isRemoved ? <Text style={styles.note}>Não é aplicada enquanto a categoria estiver arquivada.</Text> : null}
            {isRemoved ? <Text style={styles.note}>Somente leitura</Text> : null}
          </View>
        </View>
        {isRemoved ? null : (
          <View style={styles.actions}>
            <Button
              variant="text"
              label="Editar"
              accessibilityLabel={`Editar a regra ${condition}`}
              onPress={() => setMode({ kind: "edit", rule: item })}
              disabled={busyId !== null || categories === null || accounts === null}
            />
            <Button
              variant="text"
              label={item.status === "active" ? "Desativar" : "Ativar"}
              accessibilityLabel={`${item.status === "active" ? "Desativar" : "Ativar"} a regra ${condition}`}
              onPress={() => void runLifecycle(item, item.status === "active" ? "deactivate" : "activate")}
              disabled={busyId !== null}
              loading={busy}
            />
            <Button
              variant="textDanger"
              label="Remover"
              accessibilityLabel={`Remover a regra ${condition}`}
              onPress={() => confirmRemove(item)}
              disabled={busyId !== null}
            />
          </View>
        )}
      </View>
    );
  };

  // Resumo: cada célula é um atalho (filtra a lista ou abre o bloco).
  const stats = [
    {
      key: "ativas",
      Icon: IconCheck,
      value: String(counts.active),
      label: counts.active === 1 ? "Regra ativa" : "Regras ativas",
      color: colors.positive,
      selected: view.status === "ativas",
      onPress: () => {
        setView({ ...view, status: view.status === "ativas" ? "todas" : "ativas" });
        setPage(1);
      },
    },
    {
      key: "sugeridas",
      Icon: IconSparkles,
      value: `${suggestedCount} / ${rulePackSize()}`,
      label: "Sugeridas aplicadas",
      color: colors.info,
      selected: packOpen,
      onPress: () => setPackOpen(true),
    },
    {
      key: "inativas",
      Icon: IconPause,
      value: String(counts.inactive),
      label: counts.inactive === 1 ? "Regra inativa" : "Regras inativas",
      color: colors.bodyText,
      selected: view.status === "inativas",
      onPress: () => {
        setView({ ...view, status: view.status === "inativas" ? "todas" : "inativas" });
        setPage(1);
      },
    },
    {
      key: "removidas",
      Icon: IconTrash,
      value: String(counts.removed),
      label: counts.removed === 1 ? "Regra removida" : "Regras removidas",
      color: colors.muted,
      selected: removedOpen,
      onPress: () => counts.removed > 0 && setRemovedOpen(true),
    },
  ];

  const groupDetail = (category: string) => {
    const group = RULE_PACK.find((item) => item.category === category);
    if (!group) return null;
    const rules = suggested.find((item) => item.category === category)?.rules ?? [];
    const found = categories?.find((item) => item.status === "active" && normalize(item.name) === normalize(category));
    const needsCategory = pack?.missingCategories.includes(category) ?? false;
    const active = rules.filter((rule) => rule.status === "active").length;
    const onValues = new Set(rules.filter((rule) => rule.status === "active").map((rule) => rule.conditionValue.toLowerCase()));
    const present = new Set(rules.map((rule) => rule.conditionValue.toLowerCase()));
    const toAdd = group.values.filter((value) => !present.has(value.toLowerCase())).length;
    const busy = groupBusy === category;
    const meta = needsCategory
      ? `Falta a categoria ${category}: adicionar cria a categoria junto com as ${group.values.length} regras.`
      : rules.length === 0
        ? `${group.values.length} regras do tipo “a descrição contém”, prontas para adicionar.`
        : [`${active} de ${rules.length} ${rules.length === 1 ? "regra ativa" : "regras ativas"}`, toAdd > 0 ? `${toAdd} para adicionar` : null].filter(Boolean).join(" · ");
    return (
      <View style={styles.group}>
        <View style={styles.groupHead}>
          <CategoryBadge name={category} color={found ? colorOf(found.id) : null} />
          <View style={styles.ruleBody}>
            <Text style={styles.groupName}>{found?.name ?? category}</Text>
            <Text style={styles.note}>{meta}</Text>
          </View>
        </View>
        <View style={styles.terms}>
          {group.values.map((value) => {
            const state = onValues.has(value.toLowerCase()) ? "ativa" : present.has(value.toLowerCase()) ? "inativa" : "não adicionada";
            return (
              <View key={value} style={[styles.term, state === "ativa" && styles.termOn]} accessible accessibilityLabel={`${value}, ${state}`}>
                <Text style={[styles.termText, state === "ativa" && styles.termTextOn]}>{value}</Text>
              </View>
            );
          })}
        </View>
        <View style={styles.actions}>
          {rules.length > 0 ? (
            <Button
              variant="text"
              label={active > 0 ? "Desativar grupo" : "Ativar grupo"}
              accessibilityLabel={`${active > 0 ? "Desativar" : "Ativar"} as regras sugeridas de ${category}`}
              onPress={() => void runGroup(category, active > 0 ? "inactive" : "active")}
              loading={busy}
              disabled={groupBusy !== null}
            />
          ) : null}
          {toAdd > 0 ? (
            <Button
              variant="text"
              label={needsCategory ? `Adicionar ${category} e ${toAdd} regras` : `Adicionar ${toAdd === 1 ? "1 regra" : `${toAdd} regras`}`}
              onPress={() => void runAddGroup(category)}
              loading={busy}
              disabled={groupBusy !== null}
            />
          ) : null}
        </View>
        {rules.length > 0 ? <View>{rules.map((rule) => renderRule(rule))}</View> : null}
      </View>
    );
  };

  return (
    <AppScreen
      section="regras"
      onNavigate={onNavigate}
      title="Regras"
      subtitle={subtitle}
      footer={
        canCreate ? (
          <Button label="Nova regra" onPress={() => setMode({ kind: "create" })} icon={(color) => <IconPlus size={20} color={color} />} />
        ) : null
      }
    >
      {state === "loading" ? (
        <View style={styles.content}>
          <SkeletonList rows={4} />
        </View>
      ) : state === "error" ? (
        <View style={styles.content}>
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
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.primary} colors={[colors.primary]} />}
        >
          {notice ? <Notice tone={notice.tone} text={notice.text} action={{ label: "Fechar", onPress: () => setNotice(null) }} /> : null}

          <Banner
            icon={(color) => <IconLightbulb size={22} color={color} />}
            title="Deixe o Coinciente trabalhar por você!"
            text="Crie regras para categorizar sozinho os lançamentos novos, como “se a descrição contém Uber, use Transporte”."
            action={
              live.length > 0 && categories !== null ? (
                <Button variant="secondary" label="Testar uma descrição" onPress={() => setMode({ kind: "simulate" })} icon={(color) => <IconArrowRight size={18} color={color} />} />
              ) : undefined
            }
          />

          {/* Explicação permanente da precedência: a interface explica, o backend decide. */}
          <CollapsibleCard title="Como as regras são aplicadas" defaultOpen={items.length === 0}>
            <View style={styles.howTo}>
              <Text style={styles.howToLine}>• Uma regra categoriza os lançamentos novos que combinarem com a condição.</Text>
              <Text style={styles.howToLine}>• Vale a primeira que combinar: maior prioridade primeiro e, no empate, a mais antiga.</Text>
              <Text style={styles.howToLine}>• Maiúsculas não importam, acentos sim: “farmacia” não pega “Farmácia”.</Text>
              <Text style={styles.howToLine}>• Sua escolha manual de categoria sempre prevalece.</Text>
              <Text style={styles.howToLine}>• Não alteram lançamentos já registrados e, por enquanto, valem para os lançados no app: os importados por OFX ou pela conexão bancária ainda não passam por elas.</Text>
            </View>
          </CollapsibleCard>

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
              text="Uma regra aplica uma categoria sua. Crie uma categoria ou use um grupo de regras sugeridas abaixo, que cria a categoria junto."
              action={<Button label="Ir para Categorias" onPress={() => onNavigate("categorias")} />}
            />
          ) : null}

          {items.length > 0 ? (
            <View style={styles.stats} accessibilityRole="summary">
              {stats.map((stat) => (
                <Pressable
                  key={stat.key}
                  onPress={stat.onPress}
                  accessibilityRole="button"
                  accessibilityLabel={`${stat.value} ${stat.label.toLowerCase()}`}
                  accessibilityState={{ selected: stat.selected }}
                  style={({ pressed }) => [styles.stat, stat.selected && { borderColor: stat.color }, pressed && styles.pressed]}
                >
                  <View style={[styles.statIcon, { backgroundColor: `${stat.color}22` }]}>
                    <stat.Icon size={20} color={stat.color} />
                  </View>
                  <View style={styles.statText}>
                    <Text style={styles.statValue}>{stat.value}</Text>
                    <Text style={styles.statLabel}>{stat.label}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          ) : null}

          {categories !== null ? (
            <CollapsibleCard
              icon={(color) => <IconSparkles size={22} color={color} />}
              title="Regras sugeridas"
              count={suggestedCount}
              hint={`${suggestedCount} de ${rulePackSize()} aplicadas. Um pacote para as categorias mais comuns.`}
              open={packOpen}
              onOpenChange={setPackOpen}
            >
              <View style={styles.packBody}>
                {missingFromPack > 0 && activeCategories.length > 0 ? (
                  <Button
                    label={missingFromPack === 1 ? "Adicionar a regra que falta" : `Adicionar as ${missingFromPack} regras que faltam`}
                    variant="secondary"
                    onPress={() => void addRulePack()}
                    loading={applyingPack}
                  />
                ) : null}
                <View style={styles.tiles}>
                  {RULE_PACK.map((group) => {
                    const rules = suggested.find((item) => item.category === group.category)?.rules ?? [];
                    const needsCategory = pack?.missingCategories.includes(group.category) ?? false;
                    const active = rules.filter((rule) => rule.status === "active").length;
                    const found = categories.find((item) => item.status === "active" && normalize(item.name) === normalize(group.category));
                    const tileState = needsCategory || rules.length === 0 ? "missing" : active === 0 ? "off" : "on";
                    return (
                      <CategoryTile
                        key={group.category}
                        name={group.category}
                        color={found ? colorOf(found.id) : null}
                        state={tileState}
                        detail={needsCategory ? "Falta a categoria" : rules.length === 0 ? `${group.values.length} disponíveis` : `${active}/${group.values.length} ativas`}
                        mark={needsCategory || rules.length === 0 ? "plus" : active === 0 ? "pause" : undefined}
                        selected={selectedGroup === group.category}
                        onPress={() => setSelectedGroup(selectedGroup === group.category ? null : group.category)}
                      />
                    );
                  })}
                </View>
                {selectedGroup ? groupDetail(selectedGroup) : null}
              </View>
            </CollapsibleCard>
          ) : null}

          {truncated ? <Notice tone="info" text={`Você tem mais de ${SELECTOR_ITEM_LIMIT} regras: a lista mostra só as primeiras.`} /> : null}

          <SectionCard
            icon={(color) => <IconRules size={22} color={color} />}
            title={filtering ? "Regras encontradas" : "Suas regras"}
            count={listed.length}
            hint={filtering ? "Inclui as sugeridas." : "Regras criadas por você."}
          >
            {live.length > 0 ? (
              <View style={styles.tools}>
                <FilterChips
                  label="Status"
                  options={STATUS_OPTIONS}
                  value={view.status}
                  onChange={(status) => {
                    setView({ ...view, status });
                    setPage(1);
                  }}
                />
                <SearchField
                  value={view.search}
                  onChange={(search) => {
                    setView({ ...view, search });
                    setPage(1);
                  }}
                  placeholder="Buscar termo ou categoria"
                />
                <FilterChips
                  label="Ordenar"
                  options={SORT_OPTIONS}
                  value={view.sort}
                  onChange={(sort) => {
                    setView({ ...view, sort });
                    setPage(1);
                  }}
                />
              </View>
            ) : null}
            {listedPage.items.length > 0 ? (
              <View>
                {listedPage.items.map((rule) => renderRule(rule, { suggested: filtering && suggestedIds.has(rule.id) }))}
                <Pager page={listedPage.page} pages={listedPage.pages} onChange={setPage} label="Páginas das regras" />
              </View>
            ) : (
              <Text style={styles.inlineText}>
                {filtering
                  ? "Nenhuma regra combina com a busca ou o status escolhido."
                  : live.length > 0
                    ? "Você ainda não criou regras próprias; só as sugeridas estão valendo. Teste uma descrição para achar o que fica sem categoria."
                    : canCreate
                      ? "Nenhuma regra ainda. Toque em Nova regra ou adicione um grupo de sugeridas acima."
                      : "Nenhuma regra ainda."}
              </Text>
            )}
          </SectionCard>

          {removed.length > 0 ? (
            <CollapsibleCard
              icon={(color) => <IconTrash size={20} color={color} />}
              title="Regras removidas"
              count={removed.length}
              hint="Somente leitura: não são aplicadas nem voltam."
              open={removedOpen}
              onOpenChange={setRemovedOpen}
            >
              <View>{removed.map((rule) => renderRule(rule))}</View>
            </CollapsibleCard>
          ) : null}
        </ScrollView>
      )}
    </AppScreen>
  );
}

const useStyles = makeStyles((c) => ({
  content: { paddingHorizontal: 20, paddingBottom: 24, gap: 14, flexGrow: 1 },
  pressed: { opacity: 0.88 },
  howTo: { gap: 6, paddingHorizontal: 16, paddingBottom: 16 },
  howToLine: { ...type.bodySmall, color: c.bodyText },
  stats: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  stat: { flexGrow: 1, flexBasis: "45%", minWidth: 150, flexDirection: "row", alignItems: "center", gap: 12, minHeight: 72, padding: 12, borderWidth: 1, borderColor: c.line, borderRadius: radius.panel, backgroundColor: c.surface },
  statIcon: { width: 40, height: 40, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  statText: { flex: 1 },
  statValue: { ...type.amount, fontSize: 20, lineHeight: 26, color: c.foreground },
  statLabel: { ...type.micro, color: c.muted },
  packBody: { gap: 12, paddingHorizontal: 8, paddingBottom: 12 },
  tiles: { flexDirection: "row", flexWrap: "wrap" },
  group: { gap: 10, paddingHorizontal: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: c.line },
  groupHead: { flexDirection: "row", alignItems: "center", gap: 12 },
  groupName: { ...type.body, fontFamily: "Manrope_700Bold", color: c.foreground },
  terms: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  term: { paddingHorizontal: 10, paddingVertical: 3, borderWidth: 1, borderStyle: "dashed", borderColor: c.inputBorder, borderRadius: radius.pill },
  termOn: { borderStyle: "solid", borderColor: c.line, backgroundColor: c.surfaceSoft },
  termText: { ...type.micro, fontFamily: "Manrope_500Medium", color: c.muted },
  termTextOn: { color: c.foreground, fontFamily: "Manrope_700Bold" },
  tools: { gap: 10, paddingHorizontal: 16, paddingBottom: 12 },
  inlineText: { ...type.bodySmall, color: c.muted, paddingHorizontal: 16, paddingBottom: 16 },
  ruleWrap: { borderTopWidth: 1, borderTopColor: c.line, paddingVertical: 12, paddingHorizontal: 16, gap: 4 },
  rule: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  ruleBody: { flex: 1, gap: 6 },
  sentence: { ...type.body, color: c.foreground },
  category: { fontFamily: "Manrope_800ExtraBold" },
  // Inativa e removida ficam secundárias, mas legíveis; o status também aparece em texto.
  muted: { color: c.muted },
  ruleMeta: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 12 },
  pill: { paddingHorizontal: 10, minHeight: 24, justifyContent: "center", borderWidth: 1, borderColor: c.line, borderRadius: radius.pill, backgroundColor: c.surfaceSoft },
  pillText: { ...type.micro, color: c.foreground, fontVariant: ["tabular-nums"] },
  statusLine: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 8, height: 8, borderRadius: radius.pill, backgroundColor: c.inputBorder },
  dotOn: { backgroundColor: c.positive },
  statusText: { ...type.micro, color: c.bodyText },
  note: { ...type.micro, fontFamily: "Manrope_500Medium", color: c.muted },
  actions: { flexDirection: "row", flexWrap: "wrap", columnGap: 20, paddingLeft: 48 },
}));
