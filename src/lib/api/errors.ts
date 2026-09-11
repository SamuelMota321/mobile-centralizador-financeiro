import { z } from "zod";

// Problem Details (RFC 7807) — formato de erro do backend.
// O backend emite: type, title, status, code, detail e, conforme o caso,
// `errors` (validacao de campos) ou `candidates` (duplicidade possivel).

export const problemDetailsSchema = z.object({
  type: z.string(),
  title: z.string(),
  status: z.number(),
  code: z.string(),
  detail: z.string(),
  errors: z
    .array(
      z.object({
        path: z.string(),
        code: z.string(),
        message: z.string(),
      }),
    )
    .optional(),
  candidates: z.array(z.unknown()).optional(),
});

export type ProblemDetails = z.infer<typeof problemDetailsSchema>;

/** Codigos conhecidos do backend (@ backend 17ca76d). */
export const PROBLEM_CODES = {
  invalidRequest: "INVALID_REQUEST",
  authenticationRequired: "AUTHENTICATION_REQUIRED",
  identityContextUnavailable: "IDENTITY_CONTEXT_UNAVAILABLE",
  possibleConnectedAccountDuplicate: "POSSIBLE_CONNECTED_ACCOUNT_DUPLICATE",
  internalError: "INTERNAL_ERROR",
} as const;

export class ProblemDetailsError extends Error {
  readonly status: number;
  readonly code: string;
  readonly problem: ProblemDetails;

  constructor(problem: ProblemDetails) {
    super(problem.detail || problem.title);
    this.name = "ProblemDetailsError";
    this.status = problem.status;
    this.code = problem.code;
    this.problem = problem;
  }
}

/** Interpreta um corpo de erro como Problem Details, ou null se nao for. */
export function parseProblemDetails(input: unknown): ProblemDetails | null {
  const result = problemDetailsSchema.safeParse(input);
  return result.success ? result.data : null;
}
