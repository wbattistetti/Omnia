// Simple sandboxed constraint runner with pre-confirm policy integration

export type ConstraintOutcome =
  | { status: 'ok'; confidence?: number }
  | { status: 'violation'; confidence?: number; message?: string }
  | { status: 'error'; error: string };

export type PreConfirmPolicy = 'never' | 'always' | 'threshold';

export interface RunOptions {
  script: string; // user/scripted function body expecting vars
  vars: Record<string, any>;
}

export function runConstraint(opts: RunOptions): ConstraintOutcome {
  try {
    const fn = new Function('vars', opts.script);
    const res = fn(opts.vars);
    if (res && typeof res === 'object') {
      if (res.status === 'violation') return { status: 'violation', confidence: res.confidence, message: res.message };
      return { status: 'ok', confidence: res.confidence };
    }
    return { status: 'ok' };
  } catch (e: any) {
    return { status: 'error', error: String(e?.message || e) };
  }
}

export function shouldPreConfirm(policy: PreConfirmPolicy, confidence?: number, threshold = 0.7): boolean {
  if (policy === 'always') return true;
  if (policy === 'never') return false;
  return (confidence ?? 0) >= threshold;
}


