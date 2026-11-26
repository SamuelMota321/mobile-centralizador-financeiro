import type { InitialImport } from "./schema";

// Dados fictícios no formato das operações consumidas do OpenAPI.

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

export function initialImportView(status: InitialImport["status"] = "queued") {
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

export const PROVIDER_ACCOUNT_ID = "3c1d2e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f";
export const LOCAL_ACCOUNT_ID = "6f7e8d9c-0b1a-4f2e-9d3c-4b5a6f7e8d9c";

/** Importação parada à espera de mapeamento: uma conta pendente, uma mapeada e uma sem suporte. */
export function awaitingMappingImportView() {
  return {
    ...initialImportView("awaiting_account_mapping"),
    availability: {
      accounts: { status: "available", errorCode: null },
      transactions: { status: "pending", errorCode: null },
    },
    accountMapping: {
      total: 3,
      mapped: 1,
      accounts: [
        { providerAccountId: PROVIDER_ACCOUNT_ID, name: "Conta Corrente Sandbox", accountType: "checking", currencyCode: "BRL", mappingStatus: "pending", errorCode: null, mappedAccountId: null },
        { providerAccountId: "7a8b9c0d-1e2f-4a3b-8c4d-5e6f7a8b9c0d", name: "Cartão Sandbox", accountType: "credit_card", currencyCode: "BRL", mappingStatus: "mapped", errorCode: null, mappedAccountId: LOCAL_ACCOUNT_ID },
        { providerAccountId: "1b2c3d4e-5f6a-4b7c-9d8e-0f1a2b3c4d5e", name: "Investimento Sandbox", accountType: null, currencyCode: "BRL", mappingStatus: "unsupported", errorCode: "UNSUPPORTED_ACCOUNT_TYPE", mappedAccountId: null },
      ],
    },
  };
}

export function accountMappingResultView() {
  return {
    connectionId: CONNECTION_ID,
    providerAccountId: PROVIDER_ACCOUNT_ID,
    accountId: LOCAL_ACCOUNT_ID,
    initialImport: { ...initialImportView("processing"), accountMapping: { total: 1, mapped: 1, accounts: [] } },
  };
}
