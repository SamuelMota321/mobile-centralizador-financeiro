// Dados fictícios no formato do OpenAPI atual do backend. Somente para testes.

export const CONNECTION_ID = "b2a7e0c4-1f3d-4a5b-8c9d-0e1f2a3b4c5d";
export const ITEM_ID = "9d8c7b6a-5f4e-4d3c-8b2a-1f0e9d8c7b6a";
export const COMPLETION_KEY = "a5831543-216b-4339-9b97-83af2d932273";
export const CONNECT_TOKEN = "connect-token-ficticio";

const pendingConsent = {
  id: null,
  status: null,
  products: [],
  openFinancePermissionsGranted: [],
  grantedAt: null,
  expiresAt: null,
  revokedAt: null,
};

export function connectionView(overrides: Record<string, unknown> = {}) {
  return {
    id: CONNECTION_ID,
    provider: "pluggy",
    status: "connected",
    consent: {
      id: "4e5f6a7b-8c9d-4e0f-a1b2-c3d4e5f6a7b8",
      status: "granted",
      products: ["ACCOUNTS", "TRANSACTIONS"],
      openFinancePermissionsGranted: [],
      grantedAt: "2026-10-09T12:00:00.000Z",
      expiresAt: "2027-10-09T12:00:00.000Z",
      revokedAt: null,
    },
    createdAt: "2026-10-09T12:00:00.000Z",
    updatedAt: "2026-10-09T12:05:00.000Z",
    ...overrides,
  };
}

export function pendingConnectionView() {
  return connectionView({ status: "pending_authorization", consent: pendingConsent, updatedAt: "2026-10-09T12:00:00.000Z" });
}

export function sessionView() {
  return {
    connection: pendingConnectionView(),
    connectToken: CONNECT_TOKEN,
    expiresAt: "2026-10-09T12:30:00.000Z",
  };
}

export function initialImportView(status = "queued") {
  return {
    id: "a747cfa4-0f45-4fe0-a7aa-b19a71cbb251",
    status,
    availability: {
      accounts: { status: "pending", errorCode: null },
      transactions: { status: "pending", errorCode: null },
    },
    accountMapping: { total: 0, mapped: 0, accounts: [] },
    transactions: { total: 0, imported: 0, ignored: 0, failed: 0 },
    terminalAt: null,
    createdAt: "2026-10-09T12:05:00.000Z",
    updatedAt: "2026-10-09T12:05:00.000Z",
  };
}

export function completionAcceptedView() {
  return { connection: connectionView(), initialImport: initialImportView() };
}
