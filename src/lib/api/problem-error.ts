import { ApiRequestError } from "./http-client";
import { parseProblemDetails, ProblemDetailsError } from "./errors";

/** Converte a falha HTTP em ProblemDetailsError quando o corpo segue o contrato. */
export function toProblemError(error: unknown): unknown {
  if (!(error instanceof ApiRequestError)) return error;
  const problem = parseProblemDetails(error.details);
  return problem ? new ProblemDetailsError(problem) : error;
}
