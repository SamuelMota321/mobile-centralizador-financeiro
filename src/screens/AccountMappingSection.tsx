import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useAuth } from "../auth/AuthContext";
import { listAccounts } from "../lib/accounts/api";
import type { Account } from "../lib/accounts/types";
import { listAllPages } from "../lib/api/pagination";
import { mapPluggyAccount } from "../lib/connections/api";
import type { AccountMappingChoice, InitialImport } from "../lib/connections/schema";
import { makeStyles, radius, type } from "../theme";
import { Button, Notice } from "../ui/controls";
import {
  canCreateFromProvider,
  classifyConnectionError,
  mappingStatusText,
  type ProviderAccount,
  providerAccountTypeLabel,
} from "./connect-logic";

const CREATE = "create";

type Linkable = { status: "loading" } | { status: "ok"; accounts: Account[] } | { status: "error" };

/**
 * Etapa `awaiting_account_mapping`: para cada conta do banco, a pessoa escolhe criar uma conta
 * conectada ou vincular a uma conta manual ativa. Sem essa escolha a importação não segue.
 */
export function AccountMappingSection({
  connectionId,
  initialImport,
  onMapped,
}: {
  connectionId: string;
  initialImport: InitialImport;
  onMapped: (initialImport: InitialImport, message: string) => void;
}) {
  const styles = useStyles();
  const [linkable, setLinkable] = useState<Linkable>({ status: "loading" });

  useEffect(() => {
    let active = true;
    listAllPages((query) => listAccounts(query))
      .then(({ items }) => {
        // Só contas manuais ativas recebem vínculo: as conectadas já pertencem a outra conta do banco.
        if (active) setLinkable({ status: "ok", accounts: items.filter((a) => a.origin === "manual" && a.archivedAt === null) });
      })
      .catch(() => {
        if (active) setLinkable({ status: "error" });
      });
    return () => {
      active = false;
    };
  }, []);

  const { accounts, mapped, total } = initialImport.accountMapping;

  return (
    <View style={styles.section}>
      <Text style={styles.title} accessibilityRole="header">
        Contas encontradas no banco
      </Text>
      <Text style={styles.meta}>
        {`Escolha o que fazer com cada conta para a importação continuar. ${mapped} de ${total} já ${mapped === 1 ? "está vinculada" : "estão vinculadas"}.`}
      </Text>
      {linkable.status === "error" ? (
        <Notice tone="error" text="Não foi possível carregar suas contas manuais. Ainda dá para criar contas novas." />
      ) : null}
      {accounts.map((account) =>
        account.mappingStatus === "pending" ? (
          <PendingMapping
            key={account.providerAccountId}
            connectionId={connectionId}
            account={account}
            linkable={linkable.status === "ok" ? linkable.accounts : null}
            onMapped={onMapped}
          />
        ) : (
          <View key={account.providerAccountId} style={styles.item}>
            <Text style={styles.name}>{`${account.name} · ${providerAccountTypeLabel(account.accountType)}`}</Text>
            <Text style={styles.meta}>{mappingStatusText(account)}</Text>
          </View>
        ),
      )}
    </View>
  );
}

function PendingMapping({
  connectionId,
  account,
  linkable,
  onMapped,
}: {
  connectionId: string;
  account: ProviderAccount;
  linkable: Account[] | null;
  onMapped: (initialImport: InitialImport, message: string) => void;
}) {
  const styles = useStyles();
  const { handleUnauthorized } = useAuth();
  const canCreate = canCreateFromProvider(account);
  const [selection, setSelection] = useState<string>(canCreate ? CREATE : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const options = [
    ...(canCreate ? [{ value: CREATE, label: "Criar uma conta nova com os dados do banco" }] : []),
    ...(linkable ?? []).map((local) => ({
      value: local.id,
      label: `Vincular a ${local.name}${local.institutionName ? ` (${local.institutionName})` : ""}`,
    })),
  ];

  async function confirm() {
    const choice: AccountMappingChoice = selection === CREATE ? { action: "create" } : { action: "link", accountId: selection };
    setSaving(true);
    setError(null);
    try {
      const result = await mapPluggyAccount(connectionId, account.providerAccountId, choice);
      onMapped(result.initialImport, choice.action === "create" ? `Conta “${account.name}” criada.` : `Conta “${account.name}” vinculada.`);
    } catch (caught) {
      const failure = classifyConnectionError(caught, "Não foi possível vincular a conta. Tente de novo.");
      if (failure.kind === "unauthorized") {
        await handleUnauthorized();
        return;
      }
      setError(failure.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.item}>
      <Text style={styles.name}>{`${account.name} · ${providerAccountTypeLabel(account.accountType)}`}</Text>
      <View accessibilityRole="radiogroup" accessibilityLabel={`O que fazer com ${account.name}`} style={styles.options}>
        {options.map((option) => {
          const selected = option.value === selection;
          return (
            <Pressable
              key={option.value}
              onPress={() => setSelection(option.value)}
              disabled={saving}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected, disabled: saving }}
              style={({ pressed }) => [styles.option, selected && styles.optionSelected, pressed && styles.pressed]}
            >
              <View style={[styles.radio, selected && styles.radioSelected]} />
              <Text style={styles.optionLabel}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
      {options.length === 0 && linkable !== null ? (
        <Text style={styles.meta}>
          O banco não informou o tipo desta conta. Crie uma conta manual em Contas e volte para vinculá-la.
        </Text>
      ) : null}
      {error ? <Notice tone="error" text={error} /> : null}
      <Button label="Confirmar" onPress={() => void confirm()} loading={saving} disabled={selection === ""} compact />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  section: { gap: 10 },
  title: { ...type.sectionTitle, color: c.foreground },
  meta: { ...type.bodySmall, color: c.muted },
  item: {
    gap: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: c.line,
    borderRadius: radius.panel,
    backgroundColor: c.surface,
  },
  name: { ...type.label, color: c.foreground },
  options: { gap: 6 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 44,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: c.line,
    borderRadius: radius.control,
  },
  optionSelected: { borderColor: c.primary, backgroundColor: c.primaryTint },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: c.inputBorder },
  radioSelected: { borderColor: c.primary, borderWidth: 6 },
  optionLabel: { ...type.body, color: c.foreground, flexShrink: 1 },
  pressed: { opacity: 0.88 },
}));
