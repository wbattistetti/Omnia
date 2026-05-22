/**
 * Token review lato browser: env esplicita o auto da backend/.env in dev (Vite define).
 */

export function reviewChannelClientToken(): string {
  const explicit = String(
    (import.meta.env as Record<string, string | undefined>).VITE_AGENT_REVIEW_CHANNEL_TOKEN ?? ''
  ).trim();
  if (explicit) return explicit;

  if (import.meta.env.DEV) {
    return String(
      (import.meta.env as Record<string, string | undefined>).VITE_REVIEW_DEV_AUTO_TOKEN ?? ''
    ).trim();
  }

  return '';
}
