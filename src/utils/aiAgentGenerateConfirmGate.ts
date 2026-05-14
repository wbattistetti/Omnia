/**
 * Gate opzionale: prima di ogni POST /design/ai-agent-generate mostra un modale di conferma.
 * **Disattivo di default.** Attiva solo se imposti esplicitamente `VITE_OMNIA_AI_AGENT_GENERATE_CONFIRM=1`
 * (o `true`) in `.env.local` / `.env.development` — non usare in produzione salvo necessità.
 * Il rate limit su «raffiche» di richieste è separato: vedi burst su Express (`backend/.env`).
 */

export const AI_AGENT_GENERATE_CONFIRM_EVENT = 'omnia:ai-agent-generate-confirm' as const;

export type AiAgentGenerateConfirmEventDetail = {
  resolve: (proceed: boolean) => void;
};

export class AiAgentGenerateUserCancelledError extends Error {
  readonly code = 'AI_AGENT_GENERATE_USER_CANCELLED';

  constructor() {
    super('Operazione annullata.');
    this.name = 'AiAgentGenerateUserCancelledError';
  }
}

export function isAiAgentGenerateConfirmEnabled(): boolean {
  const v = import.meta.env.VITE_OMNIA_AI_AGENT_GENERATE_CONFIRM;
  return v === '1' || v === 'true';
}

/**
 * Se il gate è attivo, attende conferma utente; altrimenti no-op.
 * @throws {AiAgentGenerateUserCancelledError} se l'utente annulla.
 */
export async function confirmAiAgentGenerateIfEnabled(): Promise<void> {
  if (!isAiAgentGenerateConfirmEnabled()) return;
  if (typeof window === 'undefined') return;
  const ok = await new Promise<boolean>((resolve) => {
    window.dispatchEvent(
      new CustomEvent<AiAgentGenerateConfirmEventDetail>(AI_AGENT_GENERATE_CONFIRM_EVENT, {
        detail: { resolve },
      })
    );
  });
  if (!ok) throw new AiAgentGenerateUserCancelledError();
}
