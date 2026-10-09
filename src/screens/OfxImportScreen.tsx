import { type DocumentPickerAsset, getDocumentAsync } from "expo-document-picker";
import { useCallback, useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import { useAuth } from "../auth/AuthContext";
import { listAccounts } from "../lib/accounts/api";
import { isUnauthorized } from "../lib/accounts/messages";
import { listAllPages } from "../lib/api/pagination";
import { formatCivilDate } from "../lib/civil-date";
import { newIdempotencyKey } from "../lib/idempotency";
import { confirmImport, createOfxPreview, getImportRun } from "../lib/ingestions/api";
import { checkOfxFile, OFX_FILE_MESSAGES } from "../lib/ingestions/file-validation";
import type { ImportRun, IngestionItem } from "../lib/ingestions/types";
import { makeStyles, radius, type } from "../theme";
import { Button, EmptyState, Notice, type NoticeTone, SkeletonList, StatusChip } from "../ui/controls";
import { ChoiceGroup, Field } from "../ui/fields";
import { IconAccounts } from "../ui/icons";
import { FormScreen } from "../ui/screens";
import { accountChoices, selectedAccount } from "./movement-form-helpers";
import { accountLabel, type AccountOption } from "./movement-presentation";
import {
  classifyImportError,
  countLabel,
  FAILED_ITEM_MESSAGE,
  itemAmount,
  itemSituation,
  previewSummary,
  resultSummary,
  stepForStatus,
} from "./ofx-import-logic";

interface Props {
  onCancel: () => void;
  /** Volta para a lista de Contas, que exibe a mensagem com o tom do resultado. */
  onDone: (message: string, tone: NoticeTone) => void;
}

type Flow = { kind: "select" } | { kind: "run"; run: ImportRun; confirmKey: string };

interface FormError {
  text: string;
  restart: boolean;
}

/**
 * Importacao OFX: conta e arquivo, previa (nada gravado), confirmacao e resultado.
 * O arquivo e a previa vivem so no estado desta tela; nada e persistido no aparelho.
 */
export function OfxImportScreen({ onCancel, onDone }: Props) {
  const { handleUnauthorized } = useAuth();
  const styles = useStyles();

  const [accounts, setAccounts] = useState<AccountOption[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [accountId, setAccountId] = useState("");
  const [asset, setAsset] = useState<DocumentPickerAsset | null>(null);
  const [fileError, setFileError] = useState<string | undefined>();
  const [accountError, setAccountError] = useState<string | undefined>();
  const [formError, setFormError] = useState<FormError | null>(null);
  const [flow, setFlow] = useState<Flow>({ kind: "select" });
  // Chave da previa: a mesma em qualquer reenvio apos falha; nova apos sucesso ou recusa.
  const [previewKey, setPreviewKey] = useState(newIdempotencyKey);
  const [submitting, setSubmitting] = useState(false);
  // Bloqueia o toque duplo antes do re-render que desabilita o botao.
  const inFlight = useRef(false);

  const loadAccounts = useCallback(async () => {
    setLoadFailed(false);
    try {
      const { items } = await listAllPages((query) => listAccounts(query));
      const options = items.map(({ id, name }) => ({ id, name }));
      setAccounts(options);
      if (options.length === 1) setAccountId(options[0].id);
    } catch (error) {
      if (isUnauthorized(error)) {
        await handleUnauthorized();
        return;
      }
      setLoadFailed(true);
    }
  }, [handleUnauthorized]);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  async function run<T>(task: () => Promise<T>): Promise<T | undefined> {
    if (inFlight.current) return undefined;
    inFlight.current = true;
    setSubmitting(true);
    try {
      return await task();
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  }

  async function pickFile() {
    const result = await getDocumentAsync({ type: "*/*", copyToCacheDirectory: true, multiple: false });
    if (result.canceled) return;
    const picked = result.assets[0];
    const problem = checkOfxFile({ name: picked.name, mimeType: picked.mimeType, size: picked.size });
    setAsset(picked);
    setFileError(problem ? OFX_FILE_MESSAGES[problem] : undefined);
    setFormError(null);
  }

  async function generatePreview() {
    const current = selectedAccount(accountId, accounts ?? []);
    const missingAccount = current === "" ? "Escolha a conta que vai receber as movimentações." : undefined;
    const problem = asset
      ? checkOfxFile({ name: asset.name, mimeType: asset.mimeType, size: asset.size })
      : null;
    const missingFile = !asset
      ? "Escolha o arquivo OFX exportado pelo banco."
      : problem
        ? OFX_FILE_MESSAGES[problem]
        : undefined;
    setAccountError(missingAccount);
    setFileError(missingFile);
    if (missingAccount || missingFile || !asset) return;

    setFormError(null);
    await run(async () => {
      try {
        const preview = await createOfxPreview(
          { file: { uri: asset.uri, name: asset.name, mimeType: asset.mimeType }, destinationAccountId: current },
          { idempotencyKey: previewKey },
        );
        setPreviewKey(newIdempotencyKey());
        setFlow({ kind: "run", run: preview, confirmKey: newIdempotencyKey() });
      } catch (error) {
        const failure = classifyImportError(error, "Não foi possível ler o arquivo.");
        if (failure.kind === "unauthorized") {
          await handleUnauthorized();
          return;
        }
        setFormError({ text: failure.message, restart: false });
        if (failure.rotateKey) setPreviewKey(newIdempotencyKey());
      }
    });
  }

  async function confirm(current: Extract<Flow, { kind: "run" }>) {
    setFormError(null);
    await run(async () => {
      try {
        const result = await confirmImport(
          current.run.id,
          { destinationAccountId: current.run.destinationAccountId },
          { idempotencyKey: current.confirmKey },
        );
        setFlow({ kind: "run", run: result, confirmKey: newIdempotencyKey() });
      } catch (error) {
        const failure = classifyImportError(error, "Não foi possível confirmar a importação.");
        if (failure.kind === "unauthorized") {
          await handleUnauthorized();
          return;
        }
        setFormError({ text: failure.message, restart: failure.restart });
        if (failure.rotateKey) setFlow({ ...current, confirmKey: newIdempotencyKey() });
      }
    });
  }

  async function refresh(current: Extract<Flow, { kind: "run" }>) {
    setFormError(null);
    await run(async () => {
      try {
        setFlow({ ...current, run: await getImportRun(current.run.id) });
      } catch (error) {
        const failure = classifyImportError(error, "Não foi possível consultar a importação.");
        if (failure.kind === "unauthorized") {
          await handleUnauthorized();
          return;
        }
        setFormError({ text: failure.message, restart: false });
      }
    });
  }

  function restart() {
    setFlow({ kind: "select" });
    setAsset(null);
    setFileError(undefined);
    setFormError(null);
  }

  const options = accounts ?? [];

  if (accounts === null || options.length === 0) {
    return (
      <FormScreen
        title="Importar extrato OFX"
        onCancel={onCancel}
        footer={
          loadFailed ? (
            <Button label="Tentar de novo" onPress={() => void loadAccounts()} />
          ) : (
            <Button label="Voltar para Contas" variant="secondary" onPress={onCancel} />
          )
        }
      >
        {loadFailed ? (
          <Notice tone="error" text="Não foi possível carregar suas contas. Verifique a conexão." />
        ) : accounts === null ? (
          <SkeletonList rows={3} />
        ) : (
          <EmptyState
            icon={(color) => <IconAccounts size={24} color={color} />}
            title="Crie uma conta antes de importar"
            text="As movimentações do extrato entram em uma das suas contas ativas."
          />
        )}
      </FormScreen>
    );
  }

  if (flow.kind === "select") {
    return (
      <FormScreen
        title="Importar extrato OFX"
        description="Escolha a conta e o arquivo. Você confere a prévia antes de qualquer gravação."
        onCancel={onCancel}
        cancelDisabled={submitting}
        footer={<Button label="Gerar prévia" onPress={() => void generatePreview()} loading={submitting} />}
      >
        <Field label="Conta de destino" error={accountError} help="Os duplicados são verificados para esta conta.">
          <ChoiceGroup
            label="Conta de destino"
            options={accountChoices(options)}
            selected={selectedAccount(accountId, options)}
            onSelect={(value) => {
              setAccountId(value);
              setAccountError(undefined);
            }}
            disabled={submitting}
          />
        </Field>

        <Field label="Arquivo OFX" error={fileError} help="Extrato exportado pelo banco, até 10 MB. PDF não é aceito.">
          {asset ? (
            <Text style={styles.fileName} accessibilityLabel={`Arquivo escolhido: ${asset.name}`}>
              {asset.name}
            </Text>
          ) : null}
          <Button
            label={asset ? "Trocar arquivo" : "Escolher arquivo"}
            variant="secondary"
            onPress={() => void pickFile()}
            disabled={submitting}
          />
        </Field>

        {formError ? <Notice tone="error" text={formError.text} /> : null}
      </FormScreen>
    );
  }

  const current = flow;
  const step = stepForStatus(current.run.status);
  const destination = accountLabel(current.run.destinationAccountId, options);
  const errorNotice = formError ? (
    <Notice
      tone="error"
      text={formError.text}
      action={formError.restart ? { label: "Escolher outro arquivo", onPress: restart } : undefined}
    />
  ) : null;

  if (step === "processing") {
    return (
      <FormScreen
        title="Importação em processamento"
        onCancel={onCancel}
        cancelDisabled={submitting}
        footer={<Button label="Verificar de novo" onPress={() => void refresh(current)} loading={submitting} />}
      >
        <Notice
          tone="info"
          text={`O extrato para ${destination} ainda está sendo processado. Verifique de novo em alguns instantes.`}
        />
        {errorNotice}
      </FormScreen>
    );
  }

  if (step === "expired") {
    return (
      <FormScreen
        title="Prévia expirada"
        onCancel={onCancel}
        footer={<Button label="Escolher outro arquivo" onPress={restart} />}
      >
        <Notice
          tone="warning"
          text="Esta prévia não pode mais ser confirmada. Envie o arquivo de novo para gerar outra."
        />
      </FormScreen>
    );
  }

  if (step === "result") {
    const summary = resultSummary(current.run);
    const failed = current.run.items.filter((item) => item.status === "failed");
    const finish = () => onDone(`Importação do extrato em ${destination}: ${summary.text}`, summary.tone);
    return (
      <FormScreen
        title="Resultado da importação"
        onCancel={finish}
        footer={
          <>
            <Button label="Concluir" onPress={finish} />
            <Button label="Importar outro arquivo" variant="text" onPress={restart} />
          </>
        }
      >
        <Notice tone={summary.tone} text={summary.text} />
        <View style={styles.summary}>
          <SummaryRow label="Conta de destino" value={destination} />
          <SummaryRow label="Importadas" value={String(current.run.importedItems)} />
          <SummaryRow label="Ignoradas (já registradas)" value={String(current.run.ignoredItems)} />
          <SummaryRow label="Com erro" value={String(current.run.failedItems)} />
        </View>
        {failed.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle} accessibilityRole="header">
              Linhas não importadas
            </Text>
            <Text style={styles.help}>{FAILED_ITEM_MESSAGE}</Text>
            <ItemList items={failed} />
          </View>
        ) : null}
      </FormScreen>
    );
  }

  const summary = previewSummary(current.run.items);
  const nothingNew = summary.fresh === 0;

  return (
    <FormScreen
      title="Prévia da importação"
      description="Nada foi gravado ainda. Confira as linhas e confirme."
      onCancel={onCancel}
      cancelDisabled={submitting}
      footer={
        <>
          <Button
            label={`Importar ${countLabel(summary.fresh, "movimentação", "movimentações")}`}
            onPress={() => void confirm(current)}
            loading={submitting}
            disabled={nothingNew}
          />
          <Button label="Escolher outro arquivo" variant="text" onPress={restart} disabled={submitting} />
        </>
      }
    >
      <View style={styles.summary}>
        <SummaryRow label="Conta de destino" value={destination} />
        <SummaryRow
          label="Período"
          value={
            summary.period
              ? `${formatCivilDate(summary.period.from)} a ${formatCivilDate(summary.period.to)}`
              : "Sem movimentações"
          }
        />
        <SummaryRow label="Linhas no arquivo" value={String(summary.total)} />
        <SummaryRow label="Novas" value={String(summary.fresh)} />
        <SummaryRow label="Já registradas nesta conta" value={String(summary.duplicates)} />
      </View>

      {summary.withoutBankId > 0 ? (
        <Notice
          tone="info"
          text={`${countLabel(summary.withoutBankId, "linha veio", "linhas vieram")} sem o identificador do banco. A duplicidade foi verificada por data, valor e descrição.`}
        />
      ) : null}

      {summary.total === 0 ? (
        <Notice tone="info" text="O arquivo não tem movimentações para importar." />
      ) : nothingNew ? (
        <Notice tone="info" text="Todas as linhas já estão registradas nesta conta. Não há nada novo para importar." />
      ) : summary.duplicates > 0 ? (
        <Text style={styles.help}>As linhas já registradas nesta conta são ignoradas na importação.</Text>
      ) : null}

      {errorNotice}

      {summary.total > 0 ? <ItemList items={current.run.items} /> : null}
    </FormScreen>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  const styles = useStyles();
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

function ItemList({ items }: { items: IngestionItem[] }) {
  const styles = useStyles();
  return (
    <View style={styles.items}>
      {items.map((item, index) => {
        const amount = itemAmount(item);
        const situation = itemSituation(item);
        return (
          <View
            key={item.ordinal}
            style={[styles.item, index > 0 && styles.itemDivider]}
            accessible
            accessibilityLabel={`${formatCivilDate(item.occurredOn)}, ${item.description ?? "Sem descrição"}, ${amount.text}, ${situation.label}`}
          >
            <View style={styles.itemLine}>
              <Text style={styles.itemDescription}>{item.description ?? "Sem descrição"}</Text>
              <Text style={[styles.itemAmount, amount.direction === "in" && styles.itemAmountIn]}>
                {amount.text}
              </Text>
            </View>
            <View style={styles.itemLine}>
              <Text style={styles.itemDate}>{formatCivilDate(item.occurredOn)}</Text>
              <StatusChip tone={situation.tone} label={situation.label} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  fileName: { ...type.body, color: c.foreground },
  help: { ...type.bodySmall, color: c.muted },
  section: { gap: 8 },
  sectionTitle: { ...type.sectionTitle, color: c.foreground },
  summary: {
    gap: 10,
    padding: 16,
    borderWidth: 1,
    borderColor: c.line,
    borderRadius: radius.panel,
    backgroundColor: c.surface,
  },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  summaryLabel: { ...type.bodySmall, color: c.muted, flexShrink: 1 },
  summaryValue: { ...type.label, color: c.foreground, flexShrink: 1, textAlign: "right" },
  items: {
    borderWidth: 1,
    borderColor: c.line,
    borderRadius: radius.panel,
    backgroundColor: c.surface,
  },
  item: { gap: 6, paddingVertical: 12, paddingHorizontal: 16 },
  itemDivider: { borderTopWidth: 1, borderTopColor: c.line },
  itemLine: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  itemDescription: { ...type.body, color: c.foreground, flexShrink: 1 },
  // O sinal (+/−) carrega a direção; a cor é só reforço.
  itemAmount: { ...type.label, color: c.foreground, fontVariant: ["tabular-nums"] },
  itemAmountIn: { color: c.positive },
  itemDate: { ...type.micro, color: c.muted },
}));
