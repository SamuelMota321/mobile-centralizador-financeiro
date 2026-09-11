import { apiBaseUrl } from "./config";

/**
 * Provedor do token de acesso. A fase 3 (S1-04) liga este ponto ao Auth0.
 * Ate la retorna undefined e nenhuma requisicao vai autenticada.
 */
export type TokenProvider = () => string | undefined | Promise<string | undefined>;

let tokenProvider: TokenProvider = () => undefined;

export function setTokenProvider(provider: TokenProvider): void {
  tokenProvider = provider;
}

export interface ApiErrorShape {
  status: number;
  code: string;
  message: string;
  details?: unknown;
}

export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(error: ApiErrorShape) {
    super(error.message);
    this.name = "ApiRequestError";
    this.status = error.status;
    this.code = error.code;
    this.details = error.details;
  }
}

export interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { body, query, headers, ...rest } = options;

  const token = await tokenProvider();
  const finalHeaders = new Headers(headers);
  finalHeaders.set("accept", "application/json");
  if (body !== undefined) {
    finalHeaders.set("content-type", "application/json");
  }
  if (token) {
    finalHeaders.set("authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${apiBaseUrl}${path}${buildQuery(query)}`, {
    ...rest,
    headers: finalHeaders,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const raw = await response.text();
  const payload: unknown = raw.length > 0 ? safeJsonParse(raw) : undefined;

  if (!response.ok) {
    throw new ApiRequestError(normalizeError(response.status, payload));
  }

  return payload as T;
}

function buildQuery(
  query: Record<string, string | number | boolean | undefined> | undefined,
): string {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) {
      params.set(key, String(value));
    }
  }
  const serialized = params.toString();
  return serialized.length > 0 ? `?${serialized}` : "";
}

function safeJsonParse(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return raw;
  }
}

function normalizeError(status: number, payload: unknown): ApiErrorShape {
  if (payload !== null && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    // O backend responde erros como Problem Details (RFC 7807): detail/title/code.
    const message =
      pickString(record.detail) ??
      pickString(record.message) ??
      pickString(record.title) ??
      `Falha na requisicao (${status})`;
    return {
      status,
      code: pickString(record.code) ?? `http_${status}`,
      message,
      details: record,
    };
  }
  return {
    status,
    code: `http_${status}`,
    message: `Falha na requisicao (${status})`,
  };
}

function pickString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
