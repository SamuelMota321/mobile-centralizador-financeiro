import { z } from "zod";
import { isUnauthorized } from "../lib/accounts/messages";
import { connectionErrorMessage } from "../lib/connections/messages";
import type { Connection, ConnectionStatus } from "../lib/connections/types";
import type { ChipTone, NoticeTone } from "../ui/controls";

export interface StatusView {
  label: string;
  tone: ChipTone;
  /** Explicacao em texto: a cor do chip e so reforco. */
  explanation: string;
  noticeTone: NoticeTone;
}

const STATUS_VIEWS: Record<ConnectionStatus, StatusView> = {
  pending_authorization: {
    label: "Aguardando autorização",
    tone: "warning",
    explanation:
      "O banco ainda não confirmou a autorização. Se você concluiu no banco, verifique de novo em alguns instantes.",
    noticeTone: "info",
  },
  connected: {
    label: "Conectada",
    tone: "positive",
    explanation: "A autorização está ativa para os dados listados abaixo.",
    noticeTone: "success",
  },
  partially_available: {
    label: "Parcialmente disponível",
    tone: "warning",
    explanation:
      "O banco liberou só parte dos dados. Os tipos de dado autorizados estão listados abaixo; os demais não serão coletados.",
    noticeTone: "warning",
  },
  expired: {
    label: "Autorização expirada",
    tone: "neutral",
    explanation: "A autorização venceu e nenhum dado novo é coletado. Para voltar a coletar, conecte de novo.",
    noticeTone: "warning",
  },
  revoked: {
    label: "Autorização revogada",
    tone: "neutral",
    explanation: "A autorização foi revogada no banco e nenhum dado novo é coletado. Para voltar a coletar, conecte de novo.",
    noticeTone: "warning",
  },
  disconnected: {
    label: "Desconectada",
    tone: "neutral",
    explanation: "A conexão foi removida e a coleta de novos dados parou.",
    noticeTone: "info",
  },
};

export function statusView(status: ConnectionStatus): StatusView {
  return STATUS_VIEWS[status];
}

const PRODUCT_LABELS: Record<string, string> = {
  ACCOUNTS: "Contas e saldos",
  TRANSACTIONS: "Movimentações",
  CREDIT_CARDS: "Cartões de crédito",
  IDENTITY: "Dados cadastrais",
  INVESTMENTS: "Investimentos",
  INVESTMENTS_TRANSACTIONS: "Movimentações de investimentos",
  LOANS: "Empréstimos",
  PAYMENT_DATA: "Dados de pagamento",
};

/** O contrato nao fecha a lista de produtos: um produto desconhecido aparece pelo codigo. */
export function productLabel(product: string): string {
  return PRODUCT_LABELS[product] ?? product;
}

/** "Verificar de novo" so faz sentido enquanto o banco nao respondeu a autorizacao. */
export function canCheckAgain(status: ConnectionStatus): boolean {
  return status === "pending_authorization";
}

/** Remover para a coleta; uma conexao ja desconectada nao tem o que remover. */
export function canDisconnect(status: ConnectionStatus): boolean {
  return status !== "disconnected";
}

/** Expirada, revogada ou desconectada: conectar de novo e o unico caminho. */
export function needsReconnect(status: ConnectionStatus): boolean {
  return status === "expired" || status === "revoked" || status === "disconnected";
}

const BRASILIA_OFFSET_MS = 3 * 60 * 60 * 1000;
const pad = (value: number) => String(value).padStart(2, "0");

/**
 * Data e hora de Brasilia, ex.: "09/10/2026, 09:05". Brasilia e UTC-3 fixo (sem horario de
 * verao desde 2019); formatado a mao para nao depender do suporte a fusos do Intl no Hermes.
 */
export function formatTimestamp(value: string): string {
  const local = new Date(new Date(value).getTime() - BRASILIA_OFFSET_MS);
  const date = `${pad(local.getUTCDate())}/${pad(local.getUTCMonth() + 1)}/${local.getUTCFullYear()}`;
  return `${date}, ${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}`;
}

export interface ConsentSummary {
  products: string[];
  permissionCount: number;
  grantedAt: string | null;
  expiresAt: string | null;
}

export function consentSummary(connection: Pick<Connection, "consent">): ConsentSummary {
  const { consent } = connection;
  return {
    products: consent.products.map(productLabel),
    permissionCount: consent.openFinancePermissionsGranted.length,
    grantedAt: consent.grantedAt ? formatTimestamp(consent.grantedAt) : null,
    expiresAt: consent.expiresAt ? formatTimestamp(consent.expiresAt) : null,
  };
}

// Os tipos do SDK dependem do pacote de servidor `pluggy-js`, que nao e instalado no app;
// por isso o payload do widget chega como `unknown` e so o id do item e lido.
const successPayloadSchema = z.object({ item: z.object({ id: z.uuid() }) });

/** Id do item criado pelo widget, ou null quando o payload nao tem um id valido. */
export function itemIdFromSuccess(payload: unknown): string | null {
  const parsed = successPayloadSchema.safeParse(payload);
  return parsed.success ? parsed.data.item.id : null;
}

export type ConnectionFailure = { kind: "unauthorized" } | { kind: "message"; message: string };

export function classifyConnectionError(error: unknown, fallback: string): ConnectionFailure {
  if (isUnauthorized(error)) return { kind: "unauthorized" };
  return { kind: "message", message: connectionErrorMessage(error, `${fallback} Tente de novo.`) };
}
