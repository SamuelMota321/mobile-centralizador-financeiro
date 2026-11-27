import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useAuth } from "../auth/AuthContext";
import { isUnauthorized } from "../lib/accounts/messages";
import { listAllPages } from "../lib/api/pagination";
import { todayCivilDate } from "../lib/civil-date";
import { listPatrimony } from "../lib/patrimony/api";
import { patrimonyPreviewEnabled, patrimonyPreviewPage } from "../lib/patrimony/preview";
import { PATRIMONY_COLLECTIONS, type PatrimonyCollection, type PatrimonyItem } from "../lib/patrimony/types";
import { makeStyles, type, useTheme } from "../theme";
import { AssetBadge } from "../ui/asset-badge";
import { Pager, SectionCard } from "../ui/blocks";
import { Button, EmptyState, Notice, type NoticeTone, SkeletonList } from "../ui/controls";
import { IconAccounts, IconHome, IconPlus, IconReceipt } from "../ui/icons";
import { AppScreen, type Section } from "../ui/screens";
import { PatrimonyFormScreen } from "./PatrimonyFormScreen";
import { PatrimonyHistoryScreen } from "./PatrimonyHistoryScreen";
import { useForegroundRefresh } from "./use-foreground-refresh";
import { amountText, assetDateText, assetLabel, PATRIMONY_PAGE_SIZE, SECTIONS, valuationAge } from "./patrimony-presentation";

type SectionState = { status: "loading" } | { status: "error" } | { status: "ready"; items: PatrimonyItem[]; total: number };
type Mode =
  | { kind: "list" }
  | { kind: "form"; collection: PatrimonyCollection; item?: PatrimonyItem }
  | { kind: "history"; collection: PatrimonyCollection; item: PatrimonyItem };

interface NoticeState {
  tone: NoticeTone;
  text: string;
}

const ICONS = { assets: IconHome, financings: IconReceipt, liabilities: IconAccounts } as const;
const INITIAL: Record<PatrimonyCollection, SectionState> = { assets: { status: "loading" }, financings: { status: "loading" }, liabilities: { status: "loading" } };
const FIRST_PAGES: Record<PatrimonyCollection, number> = { assets: 1, financings: 1, liabilities: 1 };

/**
 * Bens, financiamentos e outras dívidas informados pela pessoa. Três seções independentes (a falha de
 * uma não esconde as outras), cada uma com paginação própria. O app não soma nem calcula patrimônio.
 */
export function PatrimonyScreen({ onNavigate }: { onNavigate: (section: Section) => void }) {
  const { handleUnauthorized } = useAuth();
  const styles = useStyles();
  const { colors } = useTheme();
  const [sections, setSections] = useState(INITIAL);
  const [pages, setPages] = useState(FIRST_PAGES);
  // Todos os bens: nomeiam o bem do financiamento e alimentam o seletor.
  const [assets, setAssets] = useState<{ id: string; description: string; type: string }[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [mode, setMode] = useState<Mode>({ kind: "list" });
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const today = todayCivilDate();
  const preview = patrimonyPreviewEnabled();

  const loadSection = useCallback(
    async (collection: PatrimonyCollection, page: number) => {
      try {
        const result = preview ? patrimonyPreviewPage(collection, new Date()) : await listPatrimony(collection, { page, pageSize: PATRIMONY_PAGE_SIZE });
        setSections((current) => ({ ...current, [collection]: { status: "ready", items: result.items as PatrimonyItem[], total: result.total } }));
      } catch (error) {
        if (isUnauthorized(error)) {
          await handleUnauthorized();
          return;
        }
        setSections((current) => ({ ...current, [collection]: { status: "error" } }));
      }
    },
    [handleUnauthorized, preview],
  );

  const loadAssets = useCallback(async () => {
    try {
      const all = preview ? patrimonyPreviewPage("assets", new Date()) : await listAllPages((query) => listPatrimony("assets", query));
      setAssets(all.items.map(({ id, description, type: assetType }) => ({ id, description, type: assetType })));
    } catch (error) {
      if (isUnauthorized(error)) {
        await handleUnauthorized();
        return;
      }
      setAssets(null);
    }
  }, [handleUnauthorized, preview]);

  const loadAll = useCallback(
    async (current: Record<PatrimonyCollection, number>) => {
      await Promise.all([...PATRIMONY_COLLECTIONS.map((collection) => loadSection(collection, current[collection])), loadAssets()]);
    },
    [loadSection, loadAssets],
  );

  useEffect(() => {
    void loadAll(FIRST_PAGES);
    // Só na abertura: trocar de página recarrega a seção, não a tela.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useForegroundRefresh(() => void loadAll(pages));

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await loadAll(pages);
    setRefreshing(false);
  }, [loadAll, pages]);

  const changePage = (collection: PatrimonyCollection, page: number) => {
    setPages((current) => ({ ...current, [collection]: page }));
    setExpanded(null);
    setSections((current) => ({ ...current, [collection]: { status: "loading" } }));
    void loadSection(collection, page);
  };

  const backToList = (tone: NoticeTone) => (message: string) => {
    setMode({ kind: "list" });
    setNotice({ tone, text: message });
    void loadAll(pages);
  };

  if (mode.kind === "form") {
    return (
      <PatrimonyFormScreen
        collection={mode.collection}
        item={mode.item}
        assets={assets}
        onCancel={() => setMode({ kind: "list" })}
        onDone={backToList("success")}
        onStale={backToList("info")}
      />
    );
  }
  if (mode.kind === "history") {
    return <PatrimonyHistoryScreen collection={mode.collection} item={mode.item} assets={assets} onBack={() => setMode({ kind: "list" })} />;
  }

  const assetType = (assetId: string | null) => (assetId ? assets?.find((asset) => asset.id === assetId)?.type : undefined);

  const renderRow = (collection: PatrimonyCollection, item: PatrimonyItem) => {
    const open = expanded === item.id;
    const value = amountText(item.kind === "asset" ? item.estimatedValue : item.outstandingBalance);
    const age = item.kind === "asset" ? valuationAge(item.valuationDate, today) : null;
    const meta =
      item.kind === "asset"
        ? [`Avaliado em ${assetDateText(item.valuationDate)}${age ? ` · ${age}` : ""}`, `Fonte: ${item.source}`]
        : item.kind === "financing"
          ? [`Bem associado: ${assetLabel(item.assetId, assets)}`]
          : [];
    return (
      <View key={`${item.id}:${item.version}`} style={styles.rowWrap}>
        <Pressable
          onPress={() => setExpanded(open ? null : item.id)}
          disabled={preview}
          accessibilityRole={preview ? undefined : "button"}
          accessibilityState={preview ? undefined : { expanded: open }}
          accessibilityLabel={[item.description, item.kind === "asset" ? `valor estimado ${value}` : `saldo devedor ${value}`, ...meta].join(", ")}
          accessibilityHint={preview ? undefined : open ? "Fechar as ações" : "Abrir as ações do item"}
          style={({ pressed }) => [styles.row, open && styles.rowOpen, pressed && styles.pressed]}
        >
          {item.kind === "asset" ? <AssetBadge type={item.type} /> : item.kind === "financing" && item.assetId ? <AssetBadge type={assetType(item.assetId)} /> : null}
          <View style={styles.rowBody}>
            <Text style={styles.rowTitle}>{item.description}</Text>
            {meta.map((line) => (
              <Text key={line} style={styles.rowMeta}>
                {line}
              </Text>
            ))}
          </View>
          <Text style={styles.rowValue}>{value}</Text>
        </Pressable>
        {open ? (
          <View style={styles.actions}>
            <Button variant="text" label="Editar" accessibilityLabel={`Editar ${item.description}`} onPress={() => setMode({ kind: "form", collection, item })} />
            <Button variant="text" label="Histórico" accessibilityLabel={`Histórico de ${item.description}`} onPress={() => setMode({ kind: "history", collection, item })} />
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <AppScreen
      section="patrimonio"
      onNavigate={onNavigate}
      title="Bens e dívidas"
      subtitle="Registre seus bens, financiamentos e dívidas. Os valores são informados por você."
    >
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.primary} colors={[colors.primary]} />}
      >
        {preview ? <Notice tone="info" text="Prévia com dados de exemplo (EXPO_PUBLIC_PATRIMONY_PREVIEW). Nada aqui foi informado por você." /> : null}
        {notice ? <Notice tone={notice.tone} text={notice.text} action={{ label: "Fechar", onPress: () => setNotice(null) }} /> : null}

        {PATRIMONY_COLLECTIONS.map((collection) => {
          const section = SECTIONS[collection];
          const state = sections[collection];
          const Icon = ICONS[collection];
          const total = state.status === "ready" ? state.total : undefined;
          const pageCount = total === undefined ? 1 : Math.max(1, Math.ceil(total / PATRIMONY_PAGE_SIZE));
          return (
            <SectionCard key={collection} icon={(color) => <Icon size={22} color={color} />} title={section.title} count={total}>
              {preview ? null : (
                <View style={styles.create}>
                  <Button
                    variant="secondary"
                    label={section.create}
                    onPress={() => setMode({ kind: "form", collection })}
                    icon={(color) => <IconPlus size={18} color={color} />}
                  />
                </View>
              )}
              {state.status === "loading" ? (
                <View style={styles.pad}>
                  <SkeletonList rows={2} />
                </View>
              ) : state.status === "error" ? (
                <View style={styles.pad}>
                  <EmptyState
                    icon={(color) => <Icon size={24} color={color} />}
                    title={`Não foi possível carregar ${section.title.toLowerCase()}`}
                    text="As outras seções seguem disponíveis. Seus dados não foram alterados."
                    action={<Button variant="secondary" label="Tentar de novo" onPress={() => changePage(collection, pages[collection])} />}
                  />
                </View>
              ) : state.items.length === 0 ? (
                <Text style={styles.empty}>{state.total === 0 ? section.empty : "Esta página não existe."}</Text>
              ) : (
                <View>
                  {state.items.map((item) => renderRow(collection, item))}
                  <Pager page={pages[collection]} pages={pageCount} onChange={(page) => changePage(collection, page)} label={`Páginas de ${section.title.toLowerCase()}`} />
                </View>
              )}
            </SectionCard>
          );
        })}

        <Notice tone="info" text="Os valores são informados por você; o app não soma nem calcula patrimônio." />
      </ScrollView>
    </AppScreen>
  );
}

const useStyles = makeStyles((c) => ({
  content: { paddingHorizontal: 20, paddingBottom: 24, gap: 14, flexGrow: 1 },
  pressed: { opacity: 0.88 },
  create: { paddingHorizontal: 16, paddingBottom: 12 },
  pad: { paddingHorizontal: 16, paddingBottom: 16 },
  empty: { ...type.bodySmall, color: c.muted, paddingHorizontal: 16, paddingBottom: 16 },
  rowWrap: { borderTopWidth: 1, borderTopColor: c.line },
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 64, paddingHorizontal: 16, paddingVertical: 10 },
  rowOpen: { backgroundColor: c.surfaceSoft },
  rowBody: { flex: 1, gap: 2 },
  rowTitle: { ...type.body, fontFamily: "Manrope_700Bold", color: c.foreground },
  rowMeta: { ...type.micro, fontFamily: "Manrope_500Medium", color: c.muted },
  rowValue: { ...type.amount, fontSize: 14, lineHeight: 20, color: c.foreground, textAlign: "right", flexShrink: 0 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 20, paddingHorizontal: 16, paddingBottom: 12, backgroundColor: c.surfaceSoft },
}));
