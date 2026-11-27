import { useState } from "react";
import { Text } from "react-native";
import { useAuth } from "../auth/AuthContext";
import { fieldErrorsFromProblem, isUnauthorized } from "../lib/accounts/messages";
import { ProblemDetailsError } from "../lib/api/errors";
import { createPatrimony, updatePatrimony } from "../lib/patrimony/api";
import { changedFields, parsePatrimonyForm } from "../lib/patrimony/form";
import { LIMITS, type PatrimonyCollection, type PatrimonyItem } from "../lib/patrimony/types";
import { makeStyles, type } from "../theme";
import { Button, Notice } from "../ui/controls";
import { ChoiceGroup, Field, TextField } from "../ui/fields";
import { FormScreen } from "../ui/screens";
import { editableState, formValuesFromItem, NO_ASSET, SECTIONS } from "./patrimony-presentation";

const NONE = "none";

interface Props {
  collection: PatrimonyCollection;
  /** Presente: edita este item. Ausente: cria um novo. */
  item?: PatrimonyItem;
  /** Bens para associar a um financiamento; null se a lista não carregou. */
  assets: { id: string; description: string }[] | null;
  onCancel: () => void;
  onDone: (message: string) => void;
  /** Item indisponível (outra sessão removeu ou não existe mais): volta para a lista. */
  onStale: (message: string) => void;
}

const TITLES: Record<PatrimonyCollection, { create: string; edit: string; description: string }> = {
  assets: {
    create: "Novo bem",
    edit: "Editar bem",
    description: "Informe o valor que você estima e de onde ele veio. Você pode atualizar depois; cada mudança fica no histórico.",
  },
  financings: {
    create: "Novo financiamento",
    edit: "Editar financiamento",
    description: "Informe o saldo devedor atual. Se o financiamento pagou um bem, associe-o.",
  },
  liabilities: {
    create: "Nova dívida",
    edit: "Editar dívida",
    description: "Empréstimos, parcelamentos e outras dívidas, com o saldo devedor atual.",
  },
};

export function PatrimonyFormScreen({ collection, item, assets, onCancel, onDone, onStale }: Props) {
  const { handleUnauthorized } = useAuth();
  const styles = useStyles();
  const editing = item !== undefined;
  const [values, setValues] = useState<Record<string, string>>(formValuesFromItem(item));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const set = (name: string) => (value: string) => setValues((current) => ({ ...current, [name]: value }));
  const text = (name: string) => values[name] ?? "";

  async function submit() {
    if (submitting) return;
    setSubmitting(true);
    setFormError(null);
    setInfo(null);
    setFieldErrors({});

    const parsed = parsePatrimonyForm(collection, values);
    if (!parsed.ok) {
      setFieldErrors(parsed.errors as Record<string, string>);
      setSubmitting(false);
      return;
    }

    try {
      if (item) {
        const patch = changedFields(editableState(item) as never, parsed.input as never) as Record<string, unknown>;
        if (Object.keys(patch).length === 0) {
          setInfo("Nenhuma alteração para salvar.");
          return;
        }
        await updatePatrimony(collection, item.id, patch as never);
        onDone("Alterações salvas. O histórico guarda a versão anterior.");
      } else {
        await createPatrimony(collection, parsed.input as never);
        onDone(SECTIONS[collection].created);
      }
    } catch (error) {
      if (isUnauthorized(error)) {
        await handleUnauthorized();
        return;
      }
      if (error instanceof ProblemDetailsError && error.status === 404) {
        onStale("Este item não foi encontrado ou não está mais disponível.");
        return;
      }
      const server = fieldErrorsFromProblem(error);
      if (Object.keys(server).length > 0) setFieldErrors(server);
      else setFormError(editing ? "Não foi possível salvar. Tente de novo." : "Não foi possível registrar. Tente de novo.");
    } finally {
      setSubmitting(false);
    }
  }

  const titles = TITLES[collection];
  const assetOptions = [{ value: NONE, label: NO_ASSET }, ...(assets ?? []).map((asset) => ({ value: asset.id, label: asset.description }))];

  return (
    <FormScreen
      title={editing ? titles.edit : titles.create}
      description={titles.description}
      onCancel={onCancel}
      cancelDisabled={submitting}
      footer={<Button label={editing ? "Salvar alterações" : SECTIONS[collection].submit} onPress={() => void submit()} loading={submitting} />}
    >
      {collection === "assets" ? (
        <TextField
          label="Tipo"
          value={text("type")}
          onChangeText={set("type")}
          maxLength={LIMITS.type}
          placeholder="Ex.: Imóvel, Veículo"
          error={fieldErrors.type}
          editable={!submitting}
        />
      ) : null}

      <TextField
        label="Descrição"
        value={text("description")}
        onChangeText={set("description")}
        maxLength={LIMITS.description}
        placeholder={collection === "assets" ? "Ex.: Apartamento" : collection === "financings" ? "Ex.: Financiamento imobiliário" : "Ex.: Empréstimo pessoal"}
        error={fieldErrors.description}
        editable={!submitting}
      />

      {collection === "assets" ? (
        <>
          <TextField
            label="Valor estimado (R$)"
            value={text("estimatedValue")}
            onChangeText={set("estimatedValue")}
            keyboardType="numbers-and-punctuation"
            placeholder="0,00"
            style={styles.tabular}
            error={fieldErrors.estimatedValue}
            editable={!submitting}
          />
          <TextField
            label="Data da avaliação"
            value={text("valuationDate")}
            onChangeText={set("valuationDate")}
            keyboardType="numbers-and-punctuation"
            placeholder="DD/MM/AAAA"
            maxLength={10}
            accessibilityLabel="Data da avaliação, no formato dia, mês e ano"
            error={fieldErrors.valuationDate}
            editable={!submitting}
          />
          <TextField
            label="Fonte informada"
            value={text("source")}
            onChangeText={set("source")}
            maxLength={LIMITS.source}
            placeholder="Ex.: Informado por você, laudo, tabela FIPE"
            help="De onde veio o valor. Ele fica registrado junto com a data."
            error={fieldErrors.source}
            editable={!submitting}
          />
        </>
      ) : (
        <TextField
          label="Saldo devedor (R$)"
          value={text("outstandingBalance")}
          onChangeText={set("outstandingBalance")}
          keyboardType="numbers-and-punctuation"
          placeholder="0,00"
          style={styles.tabular}
          error={fieldErrors.outstandingBalance}
          editable={!submitting}
        />
      )}

      {collection === "financings" ? (
        assets === null ? (
          <Notice tone="warning" text="Não foi possível carregar seus bens. O bem associado não pode ser escolhido agora; o que já estava associado continua." />
        ) : (
          <Field label="Bem associado" error={fieldErrors.assetId}>
            <ChoiceGroup
              label="Bem associado"
              options={assetOptions}
              selected={text("assetId") === "" ? NONE : text("assetId")}
              onSelect={(value) => set("assetId")(value === NONE ? "" : value)}
              disabled={submitting}
            />
          </Field>
        )
      ) : null}

      {info ? <Notice tone="info" text={info} /> : null}
      {formError ? <Notice tone="error" text={formError} /> : null}
      <Text style={styles.note}>Os valores são informados por você; o app não soma nem calcula patrimônio.</Text>
    </FormScreen>
  );
}

const useStyles = makeStyles((c) => ({
  tabular: { fontVariant: ["tabular-nums"] },
  note: { ...type.micro, fontFamily: "Manrope_500Medium", color: c.muted },
}));
