const rawBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;

if (!rawBaseUrl) {
  throw new Error(
    "EXPO_PUBLIC_API_BASE_URL nao definido. Copie .env.example para .env e ajuste o valor.",
  );
}

/** Base URL da API do backend, sem barra final. Contrato OpenAPI sob /api/v1. */
export const apiBaseUrl = rawBaseUrl.replace(/\/+$/, "");
