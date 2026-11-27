import { useCallback, useEffect, useState } from "react";
import { Text, View } from "react-native";
import { useAuth } from "../auth/AuthContext";
import { isUnauthorized } from "../lib/accounts/messages";
import { ProblemDetailsError } from "../lib/api/errors";
import { listInvestmentMovements } from "../lib/investments/api";
import type { MovementPage, Position } from "../lib/investments/types";
import { makeStyles, radius, type } from "../theme";
import { Pager } from "../ui/blocks";
import { Button, Notice, SkeletonList, StatusChip } from "../ui/controls";
import { FormScreen } from "../ui/screens";
import {
  ABSENT,
  CURRENCY_ABSENT,
  availabilityLabel,
  availabilityTone,
  formatAmount,
  formatMaturity,
  formatReference,
  freshnessLabel,
  freshnessTone,
  INVESTMENTS_PAGE_SIZE,
  institutionLabel,
  metaLine,
  optionalAmount,
  optionalText,
  rateText,
} from "./investments-presentation";

type LoadState = { status: "loading" } | { status: "error" } | { status: "not-found" } | { status: "ready"; data: MovementPage };

/** Detalhe de uma posição: qualidade do dado, fatos como a fonte enviou e as movimentações. */
export function InvestmentDetailScreen({ position, onBack }: { position: Position; onBack: () => void }) {
  const { handleUnauthorized } = useAuth();
  const styles = useStyles();
  const [page, setPage] = useState(1);
  const [state, setState] = useState<LoadState>({ status: "loading" });

  const load = useCallback(
    async (target: number) => {
      setState({ status: "loading" });
      try {
        setState({ status: "ready", data: await listInvestmentMovements(position.id, { page: target, pageSize: INVESTMENTS_PAGE_SIZE }) });
      } catch (error) {
        if (isUnauthorized(error)) {
          await handleUnauthorized();
          return;
        }
        setState(error instanceof ProblemDetailsError && error.status === 404 ? { status: "not-found" } : { status: "error" });
      }
    },
    [position.id, handleUnauthorized],
  );

  useEffect(() => {
    void load(1);
  }, [load]);

  const facts: [string, string][] = [
    ["Saldo líquido atual", formatAmount(position.balance, position.currencyCode)],
    ["Valor investido", optionalAmount(position.investedAmount, position.currencyCode)],
    ["Resultado informado pela fonte", optionalAmount(position.resultAmount, position.currencyCode)],
    ["Quantidade", optionalText(position.quantity)],
    ["Instituição", institutionLabel(position.institutionName)],
    ["Tipo do provedor", `${position.assetType}${position.subtype ? ` · ${position.subtype}` : ""}`],
    ["Situação", optionalText(position.providerStatus)],
    ["Taxa", rateText(position)],
    ["Vencimento", formatMaturity(position.maturityDate)],
    ["Moeda", position.currencyCode ?? CURRENCY_ABSENT],
    ["Identificador na fonte", position.externalId],
  ];
  const pages = state.status === "ready" ? Math.max(1, Math.ceil(state.data.total / INVESTMENTS_PAGE_SIZE)) : 1;

  return (
    <FormScreen
      title={position.name}
      description={metaLine(position.source, position.referenceDate)}
      onCancel={onBack}
      footer={<Button label="Voltar para Investimentos" variant="secondary" onPress={onBack} />}
    >
      <View style={styles.chips}>
        <StatusChip tone={availabilityTone(position.dataQuality.availability)} label={availabilityLabel(position.dataQuality.availability)} />
        <StatusChip tone={freshnessTone(position.dataQuality.freshness)} label={freshnessLabel(position.dataQuality.freshness)} />
      </View>

      <View style={styles.facts}>
        {facts.map(([label, value]) => (
          <View key={label} style={styles.fact} accessible accessibilityLabel={`${label}: ${value === ABSENT ? "não informado pela fonte" : value}`}>
            <Text style={styles.factLabel}>{label}</Text>
            <Text style={[styles.factValue, value === ABSENT && styles.absent]}>{value}</Text>
          </View>
        ))}
      </View>
      {position.missingFields.length > 0 ? <Text style={styles.note}>Campos que a fonte não enviou: {position.missingFields.join(", ")}.</Text> : null}

      <Text style={styles.heading} accessibilityRole="header">
        Movimentações da posição
      </Text>
      {state.status === "loading" ? (
        <SkeletonList rows={3} />
      ) : state.status === "not-found" ? (
        <Notice tone="info" text="Esta posição não foi encontrada ou não está mais disponível." />
      ) : state.status === "error" ? (
        <Notice tone="error" text="Não foi possível carregar as movimentações. Seus dados não foram alterados." action={{ label: "Tentar de novo", onPress: () => void load(page) }} />
      ) : state.data.availability === "unavailable" ? (
        <Notice tone="warning" text="A coleta não comprovou a lista de movimentações desta posição. Isso não significa que não houve movimentações." />
      ) : state.data.total === 0 ? (
        <Notice tone="info" text="A coleta completa não trouxe movimentações para esta posição." />
      ) : (
        <View style={styles.movements}>
          {state.data.movements.map((movement, index) => (
            <View key={movement.id} style={[styles.movement, index > 0 && styles.movementDivider]} accessible accessibilityLabel={`${formatReference(movement.occurredAt)}, ${movement.type}, ${movement.amount === null ? "valor não informado" : formatAmount(movement.amount, movement.currencyCode)}`}>
              <View style={styles.movementBody}>
                <Text style={styles.movementType}>{movement.type}</Text>
                <Text style={styles.note}>
                  {formatReference(movement.occurredAt)} · Pluggy · {movement.externalId}
                </Text>
              </View>
              <Text style={styles.movementAmount}>{movement.amount === null ? ABSENT : formatAmount(movement.amount, movement.currencyCode)}</Text>
            </View>
          ))}
          <Pager
            page={page}
            pages={pages}
            onChange={(target) => {
              setPage(target);
              void load(target);
            }}
            label="Páginas das movimentações"
          />
        </View>
      )}
    </FormScreen>
  );
}

const useStyles = makeStyles((c) => ({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  facts: { gap: 10, padding: 14, borderWidth: 1, borderColor: c.line, borderRadius: radius.panel, backgroundColor: c.surface },
  fact: { gap: 1 },
  factLabel: { ...type.micro, color: c.muted },
  factValue: { ...type.bodySmall, fontFamily: "Manrope_700Bold", color: c.foreground },
  absent: { fontFamily: "Manrope_500Medium", color: c.muted },
  note: { ...type.micro, fontFamily: "Manrope_500Medium", color: c.muted },
  heading: { ...type.sectionTitle, color: c.foreground },
  movements: { borderWidth: 1, borderColor: c.line, borderRadius: radius.panel, backgroundColor: c.surface, overflow: "hidden" },
  movement: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  movementDivider: { borderTopWidth: 1, borderTopColor: c.line },
  movementBody: { flex: 1, gap: 2 },
  movementType: { ...type.bodySmall, fontFamily: "Manrope_700Bold", color: c.foreground },
  movementAmount: { ...type.amount, fontSize: 14, lineHeight: 20, color: c.foreground, textAlign: "right" },
}));
