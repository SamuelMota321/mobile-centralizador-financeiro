import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useAuth } from "../auth/AuthContext";
import { isUnauthorized } from "../lib/accounts/messages";
import { ProblemDetailsError } from "../lib/api/errors";
import { runInBatches } from "../lib/api/batch";
import { shareWidth } from "../lib/investments/allocation";
import { listInvestments } from "../lib/investments/api";
import { investmentsPreviewEnabled, investmentsPreviewPage } from "../lib/investments/preview";
import type { Position, PositionPage } from "../lib/investments/types";
import { requestSyncRun } from "../lib/sync-runs/api";
import { makeStyles, radius, type, useTheme } from "../theme";
import { CollapsibleCard, Pager, SectionCard } from "../ui/blocks";
import { Button, EmptyState, Notice, type NoticeTone, SkeletonList, StatusChip } from "../ui/controls";
import { IconAccounts, IconCalendar, IconCoins, IconInfo, IconRefresh, IconTrendUp } from "../ui/icons";
import { FilterChips } from "../ui/list-tools";
import { AppScreen, type Section } from "../ui/screens";
import { InvestmentDetailScreen } from "./InvestmentDetailScreen";
import { useForegroundRefresh } from "./use-foreground-refresh";
import {
  assetClassColor,
  assetClassLabel,
  availabilityLabel,
  availabilityShare,
  availabilityTone,
  classByPosition,
  coverageText,
  exclusionLabel,
  formatAmount,
  groupMeta,
  INVESTMENTS_PAGE_SIZE,
  institutionLabel,
  percentageText,
  positionDataText,
  rateCell,
  referenceAge,
  referenceDay,
  refreshMessage,
  resultCell,
  selectedCurrency,
  totalNote,
} from "./investments-presentation";

type LoadState = { status: "loading" } | { status: "error" } | { status: "ready"; data: PositionPage };

interface NoticeState {
  tone: NoticeTone;
  text: string;
}

/**
 * Investimentos: posições lidas das conexões autorizadas. Só leitura. Moedas nunca são somadas
 * nem convertidas: a composição mostra uma moeda por vez. Nenhuma rentabilidade é calculada.
 */
export function InvestmentsScreen({ onNavigate }: { onNavigate: (section: Section) => void }) {
  const { handleUnauthorized } = useAuth();
  const styles = useStyles();
  const { colors } = useTheme();
  const preview = investmentsPreviewEnabled();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [page, setPage] = useState(1);
  const [currency, setCurrency] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [open, setOpen] = useState<Position | null>(null);
  const now = new Date();

  const load = useCallback(
    async (target: number) => {
      if (preview) {
        setState({ status: "ready", data: investmentsPreviewPage(new Date()) });
        return;
      }
      try {
        setState({ status: "ready", data: await listInvestments({ page: target, pageSize: INVESTMENTS_PAGE_SIZE }) });
      } catch (error) {
        if (isUnauthorized(error)) {
          await handleUnauthorized();
          return;
        }
        setState({ status: "error" });
      }
    },
    [handleUnauthorized, preview],
  );

  useEffect(() => {
    void load(1);
  }, [load]);

  useForegroundRefresh(() => void load(page));

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load(page);
    setRefreshing(false);
  }, [load, page]);

  const changePage = (target: number) => {
    setPage(target);
    setState({ status: "loading" });
    void load(target);
  };

  /** Pede a sincronização de cada conexão da carteira, em lotes. Não acompanha o andamento. */
  const requestUpdate = useCallback(
    async (connectionIds: string[]) => {
      if (requesting) return;
      setRequesting(true);
      setNotice(null);
      let running = 0;
      let failed = 0;
      let unauthorized = false;
      await runInBatches(connectionIds, async (id) => {
        try {
          await requestSyncRun(id);
        } catch (error) {
          if (isUnauthorized(error)) unauthorized = true;
          else if (error instanceof ProblemDetailsError && error.status === 409) running += 1;
          else failed += 1;
        }
      });
      setRequesting(false);
      if (unauthorized) {
        await handleUnauthorized();
        return;
      }
      const requested = connectionIds.length - running - failed;
      const message = refreshMessage({ total: connectionIds.length, requested, running, failed });
      setNotice({ tone: message.tone, text: message.text });
    },
    [handleUnauthorized, requesting],
  );

  const data = state.status === "ready" ? state.data : null;
  const portfolio = data?.portfolio ?? null;
  const classes = useMemo(() => (portfolio ? classByPosition(portfolio.allocation) : new Map()), [portfolio]);
  const selected = portfolio ? selectedCurrency(portfolio.allocation, currency) : null;
  const connectionIds = portfolio?.connections.map((connection) => connection.connectionId) ?? [];
  const pageCount = data ? Math.max(1, Math.ceil(data.total / INVESTMENTS_PAGE_SIZE)) : 1;
  const incomplete = portfolio ? portfolio.connections.filter((connection) => connection.availability !== "complete").length : 0;

  if (open) {
    return <InvestmentDetailScreen position={open} onBack={() => setOpen(null)} />;
  }

  const empty = !preview && data !== null && data.total === 0 && (portfolio?.connections.length ?? 0) === 0;
  const subtitle = "Posições lidas das suas conexões autorizadas.";

  return (
    <AppScreen
      section="investimentos"
      onNavigate={onNavigate}
      title="Investimentos"
      subtitle={subtitle}
      footer={
        state.status === "ready" && !preview && !empty ? (
          <Button
            label="Atualizar dados"
            variant="secondary"
            onPress={() => void requestUpdate(connectionIds)}
            loading={requesting}
            disabled={connectionIds.length === 0}
            icon={(color) => <IconRefresh size={18} color={color} />}
          />
        ) : null
      }
    >
      {state.status === "loading" ? (
        <View style={styles.content}>
          <SkeletonList rows={4} />
        </View>
      ) : state.status === "error" ? (
        <View style={styles.content}>
          <EmptyState
            icon={(color) => <IconTrendUp size={24} color={color} />}
            title="Não foi possível carregar seus investimentos"
            text="Pode ser uma falha momentânea de conexão ou o servidor ainda acordando (até 1 minuto). Tente de novo em alguns segundos. Seus dados não foram alterados."
            action={<Button variant="secondary" label="Tentar de novo" onPress={() => { setState({ status: "loading" }); void load(page); }} />}
          />
        </View>
      ) : empty ? (
        <View style={styles.content}>
          <EmptyState
            icon={(color) => <IconAccounts size={24} color={color} />}
            title="Nenhuma posição de investimento ainda"
            text="Quando uma conexão autorizar a leitura de investimentos, as posições aparecem aqui, com a origem e a data de cada dado."
            action={<Button label="Conectar um banco" onPress={() => onNavigate("contas")} />}
          />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.primary} colors={[colors.primary]} />}
        >
          {preview ? <Notice tone="info" text="Prévia com dados de exemplo (EXPO_PUBLIC_INVESTMENTS_PREVIEW). Nada aqui vem das suas conexões." /> : null}
          {notice ? <Notice tone={notice.tone} text={notice.text} action={{ label: "Fechar", onPress: () => setNotice(null) }} /> : null}

          {portfolio ? <Summary portfolio={portfolio} now={now} /> : null}

          {incomplete > 0 ? (
            <Notice
              tone="warning"
              text={`${incomplete === 1 ? "Uma conexão não entregou todos os dados" : `${incomplete} conexões não entregaram todos os dados`}. Os valores abaixo cobrem só o que foi coletado.`}
            />
          ) : null}

          {portfolio ? (
            <SectionCard
              icon={(color) => <IconCoins size={22} color={color} />}
              title="Composição da carteira"
              hint="Só posições ativas, com saldo positivo, moeda conhecida, coleta completa e referência atual. Percentuais arredondados podem não somar 100,0%."
            >
              {portfolio.allocation.currencies.length > 1 && selected ? (
                <View style={styles.pad}>
                  <FilterChips
                    label="Moeda"
                    options={portfolio.allocation.currencies.map((item) => ({ value: item.currencyCode, label: item.currencyCode }))}
                    value={selected.currencyCode}
                    onChange={setCurrency}
                  />
                </View>
              ) : null}

              {portfolio.allocation.availability !== "complete" ? (
                <View style={styles.pad}>
                  <Notice
                    tone={portfolio.allocation.availability === "unavailable" ? "info" : "warning"}
                    text={`${
                      portfolio.allocation.availability === "unavailable"
                        ? "Não há base para calcular a composição: nenhuma posição elegível com saldo positivo."
                        : "A composição é parcial: não cobre toda a carteira."
                    } ${coverageText(portfolio.allocation.includedPositionCount, portfolio.allocation.knownPositionCount)}${
                      Object.entries(portfolio.allocation.excludedByReason).some(([, count]) => count > 0)
                        ? ` Ficaram de fora: ${(Object.entries(portfolio.allocation.excludedByReason) as [Parameters<typeof exclusionLabel>[0], number][])
                            .filter(([, count]) => count > 0)
                            .map(([reason, count]) => `${count} por ${exclusionLabel(reason)}`)
                            .join("; ")}.`
                        : ""
                    }`}
                  />
                </View>
              ) : null}

              {selected ? (
                <View style={styles.compositionBody}>
                  <Text style={styles.blockTitle}>
                    Por classe de ativo <Text style={styles.blockBase}>· base {formatAmount(selected.denominatorAmount, selected.currencyCode)}</Text>
                  </Text>
                  <View
                    style={styles.classBar}
                    accessibilityRole="image"
                    accessibilityLabel={selected.byClass.map((group) => `${assetClassLabel(group.assetClass)} ${percentageText(group.percentage)}`).join(", ")}
                  >
                    {selected.byClass.map((group) => (
                      <View
                        key={group.assetClass}
                        style={{ flexGrow: Math.max(Number(shareWidth(group.amount, selected.denominatorAmount).replace("%", "")), 0.5), flexBasis: 0, minWidth: 3, backgroundColor: assetClassColor(group.assetClass, colors.categories, colors.categoryOther) }}
                      />
                    ))}
                  </View>
                  {selected.byClass.map((group) => (
                    <View key={group.assetClass} style={styles.legendRow} accessible accessibilityLabel={`${assetClassLabel(group.assetClass)}, ${percentageText(group.percentage)}, ${formatAmount(group.amount, selected.currencyCode)}`}>
                      <View style={[styles.swatch, { backgroundColor: assetClassColor(group.assetClass, colors.categories, colors.categoryOther) }]} />
                      <View style={styles.legendName}>
                        <Text style={styles.legendTitle}>{assetClassLabel(group.assetClass)}</Text>
                        <Text style={styles.meta}>{groupMeta(group.positions)}</Text>
                      </View>
                      <View style={styles.legendFigure}>
                        <Text style={styles.amount}>{formatAmount(group.amount, selected.currencyCode)}</Text>
                        <Text style={styles.meta}>{percentageText(group.percentage)}</Text>
                      </View>
                    </View>
                  ))}

                  <Text style={[styles.blockTitle, styles.blockGap]}>Por instituição</Text>
                  {selected.byInstitution.map((group, index) => (
                    <View key={`${group.institutionName ?? "none"}-${index}`} style={styles.legendRow} accessible accessibilityLabel={`${institutionLabel(group.institutionName)}, ${percentageText(group.percentage)}, ${formatAmount(group.amount, selected.currencyCode)}`}>
                      <View style={styles.legendName}>
                        <Text style={styles.legendTitle}>{institutionLabel(group.institutionName)}</Text>
                        <Text style={styles.meta}>{groupMeta(group.positions)}</Text>
                      </View>
                      <View style={styles.legendFigure}>
                        <Text style={styles.amount}>{formatAmount(group.amount, selected.currencyCode)}</Text>
                        <Text style={styles.meta}>{percentageText(group.percentage)}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              ) : null}
            </SectionCard>
          ) : null}

          {data ? (
            <SectionCard
              icon={(color) => <IconTrendUp size={22} color={color} />}
              title="Posições"
              count={data.total}
              hint="Fonte: Pluggy. A bolinha mostra a classe, quando a posição entra na composição."
            >
              {data.positions.length === 0 ? (
                <Text style={styles.empty}>Nenhuma posição nesta página.</Text>
              ) : (
                <View>
                  {data.positions.map((position) => {
                    const assetClass = classes.get(position.id);
                    const dataText = positionDataText(position, now);
                    const rate = rateCell(position);
                    const result = resultCell(position);
                    const label = [
                      position.name,
                      assetClass ? `classe ${assetClassLabel(assetClass)}` : null,
                      institutionLabel(position.institutionName),
                      `saldo ${formatAmount(position.balance, position.currencyCode)}`,
                      rate !== "—" ? rate : null,
                      result !== "—" ? `resultado informado pela fonte ${result}` : null,
                      dataText.label,
                    ]
                      .filter(Boolean)
                      .join(", ");
                    return (
                      <Pressable
                        key={position.id}
                        onPress={() => setOpen(position)}
                        disabled={preview}
                        accessibilityRole={preview ? undefined : "button"}
                        accessibilityLabel={label}
                        accessibilityHint={preview ? undefined : "Abrir a posição"}
                        style={({ pressed }) => [styles.positionRow, pressed && styles.pressed]}
                      >
                        <View style={styles.positionTop}>
                          <View style={[styles.dot, assetClass ? { backgroundColor: assetClassColor(assetClass, colors.categories, colors.categoryOther) } : styles.dotUnknown]} />
                          <Text style={styles.positionName}>{position.name}</Text>
                          <Text style={styles.amount}>{formatAmount(position.balance, position.currencyCode)}</Text>
                        </View>
                        <Text style={styles.meta}>{institutionLabel(position.institutionName)}</Text>
                        {rate !== "—" ? <Text style={styles.meta}>{rate}</Text> : null}
                        {result !== "—" ? <Text style={styles.meta}>Resultado informado pela fonte: {result}</Text> : null}
                        <View style={styles.chipLine}>
                          <StatusChip tone={dataText.tone} label={dataText.label} />
                          {dataText.detail ? <Text style={styles.meta}>{dataText.detail}</Text> : null}
                          {position.providerStatus && position.providerStatus !== "ACTIVE" ? <Text style={styles.meta}>Situação: {position.providerStatus}</Text> : null}
                        </View>
                      </Pressable>
                    );
                  })}
                  <Pager page={page} pages={pageCount} onChange={changePage} label="Páginas das posições" />
                </View>
              )}
            </SectionCard>
          ) : null}

          <CollapsibleCard icon={(color) => <IconInfo size={22} color={color} />} title="Como lemos seus investimentos">
            <View style={styles.how}>
              <Text style={styles.howLine}>• As posições vêm das suas conexões autorizadas. O Coinciente só lê: não compra, não vende e não recomenda.</Text>
              <Text style={styles.howLine}>• Disponibilidade diz se a coleta de cada conexão veio completa, parcial ou indisponível. Atualização diz se a referência do dado é recente. São duas coisas separadas.</Text>
              <Text style={styles.howLine}>• A composição só considera posições ativas, com saldo positivo, moeda conhecida, coleta completa e referência atual. O que fica de fora aparece escrito, com o motivo.</Text>
              <Text style={styles.howLine}>• Moedas diferentes nunca são somadas nem convertidas: cada moeda tem o seu total e a sua composição.</Text>
              <Text style={styles.howLine}>• Nenhuma rentabilidade é calculada. Taxa e resultado aparecem como a fonte enviou.</Text>
            </View>
          </CollapsibleCard>
        </ScrollView>
      )}
    </AppScreen>
  );
}

/** Resumo 2×2: total (ou o motivo de não haver), por moeda, disponibilidade por conexão e última atualização. */
function Summary({ portfolio, now }: { portfolio: PositionPage["portfolio"]; now: Date }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const note = totalNote(portfolio);
  const share = availabilityShare(portfolio.connections);
  const age = referenceAge(portfolio.referenceDate, now);
  const segments = [
    { key: "complete", label: "Completas", count: share.complete, percent: share.percent.complete, color: colors.positive },
    { key: "partial", label: "Parciais", count: share.partial, percent: share.percent.partial, color: colors.warning },
    { key: "unavailable", label: "Indisponíveis", count: share.unavailable, percent: share.percent.unavailable, color: colors.muted },
  ] as const;

  return (
    <View style={styles.summary} accessibilityLabel="Resumo da carteira">
      <View style={styles.cell}>
        <View style={styles.cellLabelRow}>
          <IconTrendUp size={16} color={colors.muted} />
          <Text style={styles.cellLabel}>Total da carteira</Text>
        </View>
        <Text style={styles.cellValue} adjustsFontSizeToFit numberOfLines={1}>
          {portfolio.total ? formatAmount(portfolio.total.amount, portfolio.total.currencyCode) : "Sem total"}
        </Text>
        <Text style={styles.meta}>{note ?? `Posições ativas, referência ${referenceDay(portfolio.referenceDate)}`}</Text>
      </View>

      <View style={styles.cell}>
        <View style={styles.cellLabelRow}>
          <IconCoins size={16} color={colors.muted} />
          <Text style={styles.cellLabel}>Por moeda</Text>
        </View>
        {portfolio.totalsByCurrency.length === 0 ? (
          <Text style={styles.meta}>Sem valores para mostrar.</Text>
        ) : (
          portfolio.totalsByCurrency.map((money) => (
            <View key={money.currencyCode} style={styles.currencyRow}>
              <Text style={styles.meta}>{money.currencyCode}</Text>
              <Text style={styles.amount}>{formatAmount(money.amount, money.currencyCode)}</Text>
            </View>
          ))
        )}
        <Text style={styles.meta}>Moedas diferentes não são somadas nem convertidas.</Text>
      </View>

      <View style={styles.cell}>
        <Text style={styles.cellLabel}>Disponibilidade dos dados</Text>
        {share.total === 0 ? (
          <Text style={styles.meta}>Nenhuma conexão autorizada.</Text>
        ) : (
          <>
            <Text style={styles.cellHeadline}>
              {share.complete} de {share.total} {share.total === 1 ? "conexão completa" : "conexões completas"}
            </Text>
            <View style={styles.availabilityBar} accessibilityRole="image" accessibilityLabel={segments.map((s) => `${s.label}: ${s.count}`).join(", ")}>
              {segments.map((segment) => (segment.count > 0 ? <View key={segment.key} style={{ flexGrow: segment.count, flexBasis: 0, minWidth: 4, backgroundColor: segment.color, opacity: segment.key === "unavailable" ? 0.55 : 1 }} /> : null))}
            </View>
            {segments.map((segment) => (
              <View key={segment.key} style={styles.currencyRow}>
                <View style={styles.legendInline}>
                  <View style={[styles.swatchSmall, { backgroundColor: segment.color, opacity: segment.key === "unavailable" ? 0.55 : 1 }]} />
                  <Text style={styles.meta}>{segment.label}</Text>
                </View>
                <Text style={styles.meta}>
                  {segment.count} · {segment.percent}%
                </Text>
              </View>
            ))}
          </>
        )}
        <StatusChip tone={availabilityTone(portfolio.availability)} label={availabilityLabel(portfolio.availability)} />
      </View>

      <View style={styles.cell}>
        <View style={styles.cellLabelRow}>
          <IconCalendar size={16} color={colors.muted} />
          <Text style={styles.cellLabel}>Última atualização</Text>
        </View>
        <Text style={styles.cellValue}>{referenceDay(portfolio.referenceDate)}</Text>
        <Text style={styles.meta}>{age ?? "Sem referência de data"}</Text>
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  content: { paddingHorizontal: 20, paddingBottom: 24, gap: 14, flexGrow: 1 },
  pressed: { opacity: 0.88 },
  pad: { paddingHorizontal: 16, paddingBottom: 12 },
  empty: { ...type.bodySmall, color: c.muted, paddingHorizontal: 16, paddingBottom: 16 },
  meta: { ...type.micro, fontFamily: "Manrope_500Medium", color: c.muted },
  amount: { ...type.amount, fontSize: 14, lineHeight: 20, color: c.foreground, textAlign: "right" },
  summary: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  cell: { flexGrow: 1, flexBasis: "47%", minWidth: 150, gap: 6, padding: 14, borderWidth: 1, borderColor: c.line, borderRadius: radius.panel, backgroundColor: c.surface },
  cellLabelRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  cellLabel: { ...type.micro, color: c.muted },
  cellValue: { ...type.amount, fontSize: 20, lineHeight: 26, color: c.foreground },
  cellHeadline: { ...type.label, color: c.foreground },
  currencyRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  availabilityBar: { flexDirection: "row", gap: 2, height: 8, borderRadius: radius.pill, overflow: "hidden", backgroundColor: c.surfaceSoft },
  legendInline: { flexDirection: "row", alignItems: "center", gap: 6 },
  swatchSmall: { width: 8, height: 8, borderRadius: 2 },
  compositionBody: { gap: 10, paddingHorizontal: 16, paddingBottom: 16 },
  blockTitle: { ...type.label, color: c.foreground },
  blockBase: { color: c.muted, fontFamily: "Manrope_500Medium" },
  blockGap: { marginTop: 8 },
  classBar: { flexDirection: "row", gap: 2, height: 14, borderRadius: radius.pill, overflow: "hidden", backgroundColor: c.surfaceSoft },
  legendRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: c.line },
  swatch: { width: 10, height: 10, borderRadius: 2 },
  legendName: { flex: 1, gap: 1 },
  legendTitle: { ...type.bodySmall, fontFamily: "Manrope_700Bold", color: c.foreground },
  legendFigure: { alignItems: "flex-end" },
  positionRow: { gap: 3, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: c.line },
  positionTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  positionName: { ...type.body, fontFamily: "Manrope_700Bold", color: c.foreground, flex: 1 },
  dot: { width: 10, height: 10, borderRadius: radius.pill },
  dotUnknown: { borderWidth: 1.5, borderStyle: "dashed", borderColor: c.inputBorder },
  chipLine: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8, paddingTop: 4 },
  how: { gap: 6, paddingHorizontal: 16, paddingBottom: 16 },
  howLine: { ...type.bodySmall, color: c.bodyText },
}));
