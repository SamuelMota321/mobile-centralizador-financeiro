// HU-012: bens, financiamentos e passivos informados pelo usuario. Conferido contra o
// OpenAPI do backend em b5826a3. Valores em BRL, strings decimais com duas casas na
// resposta. Nao ha exclusao, Idempotency-Key nem controle de versao exigido pela API.

export const PATRIMONY_COLLECTIONS = ["assets", "financings", "liabilities"] as const;
export type PatrimonyCollection = (typeof PATRIMONY_COLLECTIONS)[number];

interface PatrimonyBase {
  id: string;
  currencyCode: "BRL";
  /** Versao gravada; a API nao a exige no PATCH. */
  version: number;
  createdAt: string;
  updatedAt: string;
  description: string;
}

export interface Asset extends PatrimonyBase {
  kind: "asset";
  type: string;
  estimatedValue: string;
  /** Data civil AAAA-MM-DD. */
  valuationDate: string;
  /** Fonte informada pelo usuario, texto livre. */
  source: string;
}

export interface Financing extends PatrimonyBase {
  kind: "financing";
  outstandingBalance: string;
  assetId: string | null;
}

export interface Liability extends PatrimonyBase {
  kind: "liability";
  outstandingBalance: string;
}

export interface ItemByCollection {
  assets: Asset;
  financings: Financing;
  liabilities: Liability;
}

export type PatrimonyItem = Asset | Financing | Liability;

export interface AssetInput {
  type: string;
  description: string;
  estimatedValue: string;
  valuationDate: string;
  source: string;
}

export interface FinancingInput {
  description: string;
  outstandingBalance: string;
  assetId: string | null;
}

export interface LiabilityInput {
  description: string;
  outstandingBalance: string;
}

export interface InputByCollection {
  assets: AssetInput;
  financings: FinancingInput;
  liabilities: LiabilityInput;
}

/** Estado gravado de uma versao: os campos editaveis daquele momento. */
export type StateByCollection = InputByCollection;

export interface HistoryEntry<C extends PatrimonyCollection> {
  version: number;
  actorUserId: string;
  requestId: string;
  createdAt: string;
  state: StateByCollection[C];
}

export interface PatrimonyPage<C extends PatrimonyCollection> {
  items: ItemByCollection[C][];
  page: number;
  pageSize: number;
  total: number;
}

/** Limites publicados no OpenAPI. */
export const LIMITS = { type: 80, description: 500, source: 120 } as const;
