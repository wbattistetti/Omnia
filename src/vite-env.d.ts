/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Vitest injects this when running tests. */
  readonly VITEST?: boolean | string;
  /** When `"true"`, enables AI Agent revisioning console logs without localStorage (dev or explicit prod debug). */
  readonly VITE_REVISIONING_DEBUG?: string;
  /** When `"true"`, structured sections use OT persistence + textarea commit path. */
  readonly VITE_AI_AGENT_STRUCTURED_OT?: string;
  /** Override default AI Agent runtime step URL (default: http://localhost:3100/api/runtime/ai-agent/step). */
  readonly VITE_AI_AGENT_STEP_URL?: string;
  /** When `1` or `true`, ogni POST /design/ai-agent-generate mostra modale Procedi/Annulla prima della rete. */
  readonly VITE_OMNIA_AI_AGENT_GENERATE_CONFIRM?: string;
  /** Max richieste HTTP design LLM concorrenti dal browser (default 2). */
  readonly VITE_DESIGN_AI_MAX_IN_FLIGHT?: string;
}
