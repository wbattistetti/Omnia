// Escalation helpers with progressive/rotate strategies capped at L3

export type EscalationStrategy = 'progressive' | 'rotate';

export interface EscalationCounters {
  noInput: number;
  noMatch: number;
  confirmNoInput: number;
  confirmNoMatch: number;
  notConfirmed: number;
}

export const DEFAULT_COUNTERS: EscalationCounters = {
  noInput: 0,
  noMatch: 0,
  confirmNoInput: 0,
  confirmNoMatch: 0,
  notConfirmed: 0,
};

function capAt3(n: number): number {
  return Math.max(0, Math.min(3, n));
}

function nextIndex(current: number, strategy: EscalationStrategy): number {
  if (strategy === 'rotate') return ((current % 3) + 1);
  // progressive: increase up to 3
  return capAt3(current + 1);
}

export function nextNoInput(current: number, strategy: EscalationStrategy = 'progressive'): number {
  return nextIndex(current, strategy);
}

export function nextNoMatch(current: number, strategy: EscalationStrategy = 'progressive'): number {
  return nextIndex(current, strategy);
}

export function nextConfirmNoInput(current: number, strategy: EscalationStrategy = 'progressive'): number {
  return nextIndex(current, strategy);
}

export function nextConfirmNoMatch(current: number, strategy: EscalationStrategy = 'progressive'): number {
  return nextIndex(current, strategy);
}

export function nextNotConfirmed(current: number, strategy: EscalationStrategy = 'progressive'): number {
  return nextIndex(current, strategy);
}


