/**
 * Tre stati icona messaggio agente: singola, parametrica (doppia stesso colore), stile (doppia colori diversi).
 */

export type AgentMessageIconKind = 'single' | 'parametric' | 'style';

export function hasStyleVariationsInMessage(opts: {
  hasStyleTokens: boolean;
  styleExampleCount: number;
}): boolean {
  return opts.hasStyleTokens || opts.styleExampleCount > 0;
}

/** Parametrico ha priorità sulle variazioni di stile. */
export function resolveAgentMessageIconKind(opts: {
  parametricEnabled: boolean;
  hasStyleVariations: boolean;
}): AgentMessageIconKind {
  if (opts.parametricEnabled) return 'parametric';
  if (opts.hasStyleVariations) return 'style';
  return 'single';
}
