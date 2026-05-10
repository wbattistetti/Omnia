/**
 * Normalizes the JSON payload from POST /design/ai-agent-analyze-debug-turn (debugger use-case assist).
 * Outcomes align IA classification vs Task Editor catalog; runtime agent use-case id is optional (future divergenza).
 * Includes `correct_assistant_reply_it` for the debugger «Esempio di risposta corretta» field.
 */

export type AnalyzeDebuggerTurnOutcome =
  /** La risposta è coerente con uno use case già presente nel catalogo task. */
  | 'use_case_recognized'
  /** Nel catalogo c’è uno scenario pertinente ma la risposta osservata non lo rispetta (agente virtuale non espone ancora UC → trattato come “non riconosciuto” lato runtime). */
  | 'exists_but_not_recognized'
  /** Nessuno use case del catalogo copre adeguatamente il turno — suggerire scenario nuovo. */
  | 'no_matching_use_case'
  /** Riservato: quando l’agente virtuale segnalerà un UC e l’IA disaccorda — oggi non viene restituito dall’API. */
  | 'runtime_divergence'
  | 'uncertain';

/** @deprecated legacy API — mappato in normalizzazione */
export type LegacyAnalyzeDebuggerTurnOutcome =
  | 'matched_wrong_response'
  | 'no_matching_use_case'
  | 'uncertain';

export interface AnalyzeDebuggerTurnSuggestedUseCase {
  label: string;
  payoff: string;
  assistant_example_line: string;
}

export interface AnalyzeDebuggerTurnUseCaseResult {
  outcome: AnalyzeDebuggerTurnOutcome;
  summary_it: string;
  recognized_use_case_id: string | null;
  /** Etichetta leggibile (preferita rispetto all’id in UI). */
  recognized_use_case_label: string | null;
  /**
   * Battuta assistente ideale se lo UC / il catalogo fossero applicati correttamente (campo «Esempio di risposta corretta»).
   */
  correct_assistant_reply_it: string | null;
  suggested_use_case: AnalyzeDebuggerTurnSuggestedUseCase | null;
  /** Futuro: id UC segnalato dall’agente virtuale per il turno (divergenza). */
  runtime_agent_use_case_id: string | null;
  runtime_agent_use_case_label: string | null;
}

const ALL_OUTCOMES = new Set<string>([
  'use_case_recognized',
  'exists_but_not_recognized',
  'no_matching_use_case',
  'runtime_divergence',
  'uncertain',
]);

function coerceOutcome(raw: unknown): AnalyzeDebuggerTurnOutcome {
  if (typeof raw !== 'string' || !raw.trim()) return 'uncertain';
  const k = raw.trim();
  if (k === 'matched_wrong_response') return 'exists_but_not_recognized';
  if (ALL_OUTCOMES.has(k)) return k as AnalyzeDebuggerTurnOutcome;
  return 'uncertain';
}

/**
 * Coerces unknown API JSON into a stable result shape (fail-closed on strings).
 */
export function normalizeAnalyzeDebuggerTurnUseCaseResult(raw: unknown): AnalyzeDebuggerTurnUseCaseResult {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  let oc = coerceOutcome(o.outcome);

  const summary_it = typeof o.summary_it === 'string' ? o.summary_it.trim() : '';

  let recognized_use_case_id: string | null =
    typeof o.recognized_use_case_id === 'string' && o.recognized_use_case_id.trim()
      ? o.recognized_use_case_id.trim()
      : null;
  if (recognized_use_case_id === '') recognized_use_case_id = null;

  let recognized_use_case_label: string | null =
    typeof o.recognized_use_case_label === 'string' && o.recognized_use_case_label.trim()
      ? o.recognized_use_case_label.trim()
      : null;
  if (recognized_use_case_label === '') recognized_use_case_label = null;

  let runtime_agent_use_case_id: string | null =
    typeof o.runtime_agent_use_case_id === 'string' && o.runtime_agent_use_case_id.trim()
      ? o.runtime_agent_use_case_id.trim()
      : null;
  if (runtime_agent_use_case_id === '') runtime_agent_use_case_id = null;

  let runtime_agent_use_case_label: string | null =
    typeof o.runtime_agent_use_case_label === 'string' && o.runtime_agent_use_case_label.trim()
      ? o.runtime_agent_use_case_label.trim()
      : null;
  if (runtime_agent_use_case_label === '') runtime_agent_use_case_label = null;

  let correct_assistant_reply_it: string | null =
    typeof o.correct_assistant_reply_it === 'string' && o.correct_assistant_reply_it.trim()
      ? o.correct_assistant_reply_it.trim()
      : null;
  if (correct_assistant_reply_it === '') correct_assistant_reply_it = null;

  /** Divergenza solo se entrambi i rami sono presenti (non scatterà finché l’agente non espone UC). */
  if (oc === 'runtime_divergence') {
    if (
      runtime_agent_use_case_id &&
      recognized_use_case_id &&
      runtime_agent_use_case_id !== recognized_use_case_id
    ) {
      oc = 'runtime_divergence';
    } else {
      oc = 'uncertain';
    }
  }

  let suggested_use_case: AnalyzeDebuggerTurnSuggestedUseCase | null = null;
  const su = o.suggested_use_case;
  if (su && typeof su === 'object') {
    const r = su as Record<string, unknown>;
    const label = typeof r.label === 'string' ? r.label.trim() : '';
    const payoff = typeof r.payoff === 'string' ? r.payoff.trim() : '';
    const assistant_example_line =
      typeof r.assistant_example_line === 'string'
        ? r.assistant_example_line.trim()
        : typeof r.assistant_example === 'string'
          ? r.assistant_example.trim()
          : '';
    if (label.length > 0 || assistant_example_line.length > 0 || payoff.length > 0) {
      suggested_use_case = { label, payoff, assistant_example_line };
    }
  }

  return {
    outcome: oc,
    summary_it,
    recognized_use_case_id,
    recognized_use_case_label,
    correct_assistant_reply_it,
    suggested_use_case,
    runtime_agent_use_case_id,
    runtime_agent_use_case_label,
  };
}
