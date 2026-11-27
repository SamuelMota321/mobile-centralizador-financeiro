export function overviewPreviewEnabled(): boolean {
  return process.env.EXPO_PUBLIC_OVERVIEW_PREVIEW === "true";
}
