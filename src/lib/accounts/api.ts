import { apiRequest, ApiRequestError } from "../api/http-client";
import {
  parseProblemDetails,
  ProblemDetailsError,
  PROBLEM_CODES,
  type ProblemDetails,
} from "../api/errors";
import {
  accountListQuerySchema,
  accountPageSchema,
  accountSchema,
  duplicateCandidatesSchema,
  manualAccountInputSchema,
} from "./schema";
import type {
  Account,
  AccountListQuery,
  AccountPage,
  DuplicateCandidate,
  ManualAccountInput,
} from "./types";

const ACCOUNTS_PATH = "/accounts";

/**
 * Erro 409: a conta manual pode duplicar uma conta conectada existente.
 * Reenvie `createAccount` com `confirmPossibleDuplicate: true` para prosseguir.
 */
export class PossibleDuplicateAccountError extends ProblemDetailsError {
  readonly candidates: DuplicateCandidate[];

  constructor(problem: ProblemDetails, candidates: DuplicateCandidate[]) {
    super(problem);
    this.name = "PossibleDuplicateAccountError";
    this.candidates = candidates;
  }
}

/** POST /api/v1/accounts — cria uma conta manual do tenant autenticado. */
export async function createAccount(input: ManualAccountInput): Promise<Account> {
  const body = manualAccountInputSchema.parse(input);
  try {
    const raw = await apiRequest<unknown>(ACCOUNTS_PATH, { method: "POST", body });
    return accountSchema.parse(raw);
  } catch (error) {
    throw toAccountsError(error);
  }
}

/** GET /api/v1/accounts — lista as contas ativas do tenant autenticado. */
export async function listAccounts(
  query: AccountListQuery = {},
): Promise<AccountPage> {
  const { page, pageSize } = accountListQuerySchema.parse(query);
  try {
    const raw = await apiRequest<unknown>(ACCOUNTS_PATH, {
      method: "GET",
      query: { page, pageSize },
    });
    return accountPageSchema.parse(raw);
  } catch (error) {
    throw toAccountsError(error);
  }
}

function toAccountsError(error: unknown): unknown {
  if (!(error instanceof ApiRequestError)) return error;

  const problem = parseProblemDetails(error.details);
  if (!problem) return error;

  if (problem.code === PROBLEM_CODES.possibleConnectedAccountDuplicate) {
    const candidates = duplicateCandidatesSchema
      .catch([])
      .parse(problem.candidates ?? []);
    return new PossibleDuplicateAccountError(problem, candidates);
  }

  return new ProblemDetailsError(problem);
}
