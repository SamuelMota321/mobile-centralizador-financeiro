import { useState } from "react";
import { Text, View } from "react-native";
import { formatCivilDate, parseBrazilianDate } from "../lib/civil-date";
import { makeStyles, type } from "../theme";
import { Button } from "../ui/controls";
import { ChoiceGroup, Field, TextField } from "../ui/fields";
import { FormScreen } from "../ui/screens";
import {
  type AccountOption,
  type CategoryOption,
  type MovementFilters,
  SITUATION_FILTERS,
  type SituationFilter,
  TYPE_FILTERS,
  type TypeFilter,
} from "./movement-presentation";

const ALL = "all";

function toOptions<T extends string>(entries: Record<T, string>): { value: T; label: string }[] {
  return (Object.entries(entries) as [T, string][]).map(([value, label]) => ({ value, label }));
}

/**
 * Filtros menos usados de Movimentações, em tela própria (padrão de formulário do app).
 * Com `customPeriod`, também recebe as datas do período personalizado (DD/MM/AAAA).
 */
export function MovementFiltersScreen({
  filters,
  accounts,
  categories,
  customPeriod,
  onCancel,
  onApply,
}: {
  filters: MovementFilters;
  accounts: AccountOption[] | null;
  categories: CategoryOption[] | null;
  customPeriod: boolean;
  onCancel: () => void;
  onApply: (filters: MovementFilters) => void;
}) {
  const styles = useStyles();
  const [draft, setDraft] = useState<MovementFilters>(filters);
  const [from, setFrom] = useState(filters.from ? formatCivilDate(filters.from) : "");
  const [to, setTo] = useState(filters.to ? formatCivilDate(filters.to) : "");
  const [dateError, setDateError] = useState<string | undefined>();

  function apply() {
    if (customPeriod) {
      const parsedFrom = from.trim() ? parseBrazilianDate(from) : null;
      const parsedTo = to.trim() ? parseBrazilianDate(to) : null;
      if ((from.trim() && !parsedFrom) || (to.trim() && !parsedTo)) {
        setDateError("Use datas reais no formato DD/MM/AAAA.");
        return;
      }
      if (!parsedFrom) {
        setDateError("Informe ao menos a data inicial.");
        return;
      }
      onApply({ ...draft, period: "personalizado", from: parsedFrom, to: parsedTo });
      return;
    }
    onApply(draft);
  }

  return (
    <FormScreen
      title="Filtros"
      description="Os filtros valem para a lista e para os números do período."
      onCancel={onCancel}
      footer={
        <>
          <Button label="Aplicar" onPress={apply} />
          <Button
            label="Limpar filtros"
            variant="text"
            onPress={() => onApply({ ...draft, type: null, situation: null, accountId: null, categoryId: null })}
          />
        </>
      }
    >
      {customPeriod ? (
        <View style={styles.group}>
          <Text style={styles.title} accessibilityRole="header">
            Período personalizado
          </Text>
          <TextField
            label="De"
            value={from}
            onChangeText={(value) => {
              setFrom(value);
              setDateError(undefined);
            }}
            placeholder="DD/MM/AAAA"
            keyboardType="number-pad"
            maxLength={10}
            error={dateError}
          />
          <TextField label="Até (opcional)" value={to} onChangeText={setTo} placeholder="DD/MM/AAAA" keyboardType="number-pad" maxLength={10} />
        </View>
      ) : null}

      <Field label="Tipo">
      <ChoiceGroup<TypeFilter | typeof ALL>
        label="Tipo"
        options={[{ value: ALL, label: "Todos os tipos" }, ...toOptions(TYPE_FILTERS)]}
        selected={draft.type ?? ALL}
        onSelect={(value) => setDraft({ ...draft, type: value === ALL ? null : value })}
      />
      </Field>

      <Field label="Situação da categoria">
      <ChoiceGroup<SituationFilter | typeof ALL>
        label="Situação da categoria"
        options={[{ value: ALL, label: "Todas as situações" }, ...toOptions(SITUATION_FILTERS)]}
        selected={draft.situation ?? ALL}
        onSelect={(value) => setDraft({ ...draft, situation: value === ALL ? null : value })}
      />
      </Field>

      {accounts && accounts.length > 1 ? (
        <Field label="Conta">
        <ChoiceGroup
          label="Conta"
          options={[{ value: ALL, label: "Todas as contas" }, ...accounts.map(({ id, name }) => ({ value: id, label: name }))]}
          selected={draft.accountId ?? ALL}
          onSelect={(value) => setDraft({ ...draft, accountId: value === ALL ? null : value })}
        />
        </Field>
      ) : null}

      {categories && categories.length > 0 ? (
        <Field label="Categoria">
        <ChoiceGroup
          label="Categoria"
          options={[
            { value: ALL, label: "Todas as categorias" },
            ...categories.map(({ id, name, status }) => ({ value: id, label: status === "archived" ? `${name} (arquivada)` : name })),
          ]}
          selected={draft.categoryId ?? ALL}
          onSelect={(value) => setDraft({ ...draft, categoryId: value === ALL ? null : value })}
        />
        </Field>
      ) : null}
    </FormScreen>
  );
}

const useStyles = makeStyles((c) => ({
  group: { gap: 10 },
  title: { ...type.sectionTitle, color: c.foreground },
}));
