/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** When `"true"`, enables AI Agent revisioning console logs without localStorage (dev or explicit prod debug). */
  readonly VITE_REVISIONING_DEBUG?: string;
  /** When `"true"`, structured sections use OT persistence + textarea commit path. */
  readonly VITE_AI_AGENT_STRUCTURED_OT?: string;
}
