const domain = process.env.EXPO_PUBLIC_AUTH0_DOMAIN;
const clientId = process.env.EXPO_PUBLIC_AUTH0_CLIENT_ID;
const audience = process.env.EXPO_PUBLIC_AUTH0_AUDIENCE;

if (!domain || !clientId || !audience) {
  throw new Error(
    "Auth0 não configurado. Copie .env.example para .env e preencha EXPO_PUBLIC_AUTH0_DOMAIN, EXPO_PUBLIC_AUTH0_CLIENT_ID e EXPO_PUBLIC_AUTH0_AUDIENCE.",
  );
}

/**
 * Aplicacao Auth0 do tipo Native: fluxo Authorization Code com PKCE e sem
 * client secret, que nao teria como ficar protegido no dispositivo.
 */
export const auth0Config = {
  domain,
  clientId,
  audience,
  issuer: `https://${domain}`,
  scheme: "coinciente",
} as const;
