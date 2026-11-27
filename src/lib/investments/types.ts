// HU-009 e HU-011: contrato de leitura de investimentos e alocacao, conferido contra o
// OpenAPI do backend em b5826a3 (src/lib/api/openapi.snapshot.json). Valores monetarios e
// quantidades sao strings decimais; campos opcionais ausentes chegam como null.

export const AVAILABILITIES = ["complete", "partial", "unavailable"] as const;
export type Availability = (typeof AVAILABILITIES)[number];

export const FRESHNESS = ["current", "stale", "unknown"] as const;
export type Freshness = (typeof FRESHNESS)[number];

export const ASSET_CLASSES = [
  "FIXED_INCOME",
  "EQUITY",
  "ETF",
  "MUTUAL_FUND",
  "COE",
  "SECURITY",
  "UNCLASSIFIED",
] as const;
export type AssetClass = (typeof ASSET_CLASSES)[number];

export const EXCLUSION_REASONS = [
  "incomplete_or_stale",
  "non_active",
  "non_positive_balance",
  "unknown_currency",
] as const;
export type ExclusionReason = (typeof EXCLUSION_REASONS)[number];

export interface DataQuality {
  availability: Availability;
  freshness: Freshness;
}

export interface Money {
  currencyCode: string;
  amount: string;
}

export interface Position {
  id: string;
  connectionId: string;
  source: "pluggy";
  externalId: string;
  name: string;
  /** Tipo do provedor; a classe da alocacao e definida pelo backend, nunca por este campo no cliente. */
  assetType: string;
  subtype: string | null;
  providerStatus: string | null;
  currencyCode: string | null;
  balance: string;
  quantity: string | null;
  investedAmount: string | null;
  /** Resultado informado pela fonte; nunca e rendimento prometido. */
  resultAmount: string | null;
  institutionName: string | null;
  referenceDate: string | null;
  rate: string | null;
  rateType: string | null;
  fixedAnnualRate: string | null;
  maturityDate: string | null;
  dataQuality: DataQuality;
  missingFields: string[];
}

export interface AllocationMember {
  id: string;
  source: "pluggy";
  referenceDate: string | null;
}

export interface ClassGroup {
  assetClass: AssetClass;
  amount: string;
  /** Uma casa decimal, arredondada pelo backend; as linhas nao somam necessariamente 100,0. */
  percentage: string;
  positions: AllocationMember[];
}

export interface InstitutionGroup {
  /** null: instituicao nao informada pela fonte. */
  institutionName: string | null;
  amount: string;
  percentage: string;
  positions: AllocationMember[];
}

export interface CurrencyAllocation {
  currencyCode: string;
  denominatorAmount: string;
  byClass: ClassGroup[];
  byInstitution: InstitutionGroup[];
}

export interface Allocation {
  basis: "active_current_complete_positive_balance";
  availability: Availability;
  knownPositionCount: number;
  includedPositionCount: number;
  excludedKnownPositionCount: number;
  excludedByReason: Record<ExclusionReason, number>;
  currencies: CurrencyAllocation[];
}

export interface Portfolio {
  availability: Availability;
  /** null quando nao ha soma segura (moedas diferentes, dados antigos ou cobertura incompleta). */
  total: Money | null;
  totalsByCurrency: Money[];
  referenceDate: string | null;
  connections: { connectionId: string; availability: Availability }[];
  allocation: Allocation;
}

export interface PositionPage {
  portfolio: Portfolio;
  positions: Position[];
  page: number;
  pageSize: number;
  /** Numero de posicoes, nao um valor monetario. */
  total: number;
}

export interface InvestmentMovement {
  id: string;
  source: "pluggy";
  externalId: string;
  type: string;
  amount: string | null;
  /** Sem inferencia pela posicao: a operacao nao traz moeda propria. */
  currencyCode: string | null;
  occurredAt: string;
  missingFields: string[];
}

export interface MovementPage {
  positionId: string;
  availability: "complete" | "unavailable";
  movements: InvestmentMovement[];
  page: number;
  pageSize: number;
  total: number;
}
