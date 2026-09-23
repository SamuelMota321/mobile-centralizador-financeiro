import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    env: {
      EXPO_PUBLIC_API_BASE_URL: "http://api.test.local/api/v1",
      EXPO_PUBLIC_AUTH0_DOMAIN: "tenant-ficticio.us.auth0.com",
      EXPO_PUBLIC_AUTH0_CLIENT_ID: "client-id-ficticio",
      EXPO_PUBLIC_AUTH0_AUDIENCE: "https://api.test.local",
    },
    globals: false,
    passWithNoTests: false,
    restoreMocks: true,
    unstubGlobals: true,
  },
});
