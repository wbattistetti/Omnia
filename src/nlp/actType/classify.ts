import { HeuristicType, Inference, InferOptions, Lang } from './types';
import { getLanguageOrder, getRuleSet } from './registry';

export function classify(label: string, opts?: InferOptions): Inference {
  const txt = (label || '').trim();
  if (!txt) return { type: 'MESSAGE', score: 0.0, reason: 'empty' };

  const langs = getLanguageOrder(opts?.languageOrder);
  let best: Inference = { type: 'MESSAGE', score: 0.0, reason: 'fallback' };

  for (const L of langs) {
    const RS = getRuleSet(L as Lang);
    if (!RS) continue;

    if (RS.PROBLEM_SPEC_DIRECT?.some(r => r.test(txt))) {
      if (best.score < 1.0) best = { type: 'PROBLEM_SPEC', score: 1.0, lang: L, reason: 'PROBLEM_SPEC_DIRECT' };
    }

    const tryCat = (type: HeuristicType, base: number) => {
      const arr: RegExp[] = (RS as any)[type] || [];
      const hit = arr.some((r) => r.test(txt));
      if (hit && base > best.score) best = { type, score: base, lang: L, reason: type };
    };

    tryCat('BACKEND_CALL', 0.9);
    tryCat('REQUEST_DATA', 0.85);
    tryCat('CONFIRM_DATA', 0.85);
    tryCat('MESSAGE', 0.8);
    tryCat('SUMMARY', 0.8);

    if (RS.PROBLEM?.test(txt) && best.score < 0.6) {
      best = { type: 'PROBLEM_SPEC', score: 0.6, lang: L, reason: 'PROBLEM' };
    }

    // Reason-of-call patterns: promuovi a PROBLEM_SPEC con score medio-alto
    const reasonArr: RegExp[] = (RS as any).PROBLEM_REASON || [];
    if (reasonArr.some(r => r.test(txt)) && best.score < 0.82) {
      best = { type: 'PROBLEM_SPEC', score: 0.82, lang: L, reason: 'PROBLEM_REASON' };
    }
  }

  const minScore = typeof opts?.minScore === 'number' ? opts.minScore : 0;
  if (best.score < minScore) return { type: 'MESSAGE', score: 0.0, reason: 'below_min' };
  return best;
}


