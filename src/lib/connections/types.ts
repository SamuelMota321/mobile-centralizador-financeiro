// Alinhado a POST /connections/pluggy/sessions, POST /connections/pluggy/completions,
// GET /connections/{id} e POST /connections/{id}/disconnect do OpenAPI do backend (@ 605cb07).
// Schemas inline; transcrito a mao.

export const CONNECTION_STATUSES = [
  "pending_authorization",
  "connected",
  "partially_available",
  "expired",
  "revoked",
  "disconnected",
] as const;
export type ConnectionStatus = (typeof CONNECTION_STATUSES)[number];

export const CONSENT_STATUSES = ["granted", "expired", "revoked"] as const;
export type ConsentStatus = (typeof CONSENT_STATUSES)[number];

/** Consentimento conforme o provedor; campos nulos ate a autorizacao ser concluida. */
export interface Consent {
  id: string | null;
  status: ConsentStatus | null;
  /** Produtos do Pluggy (ex.: ACCOUNTS, TRANSACTIONS); a lista nao e fechada no contrato. */
  products: string[];
  openFinancePermissionsGranted: string[];
  grantedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
}

export interface Connection {
  id: string;
  provider: "pluggy";
  status: ConnectionStatus;
  consent: Consent;
  createdAt: string;
  updatedAt: string;
}

/** Sessao de conexao: o token limitado abre o widget e expira (30 min no backend). */
export interface PluggySession {
  connection: Connection;
  connectToken: string;
  expiresAt: string;
}
