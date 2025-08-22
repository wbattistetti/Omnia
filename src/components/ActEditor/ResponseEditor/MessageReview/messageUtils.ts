export type ReviewItem = {
  id: string;
  stepKey: string;
  escIndex: number | null;
  actionIndex: number | null;
  textKey?: string;
  text: string;
  pathLabel: string;
};

const STEP_ORDER = ['start', 'confirmation', 'noInput', 'noMatch', 'notConfirmed', 'notAcquired', 'success'];
const orderOf = (k: string) => {
  const i = STEP_ORDER.indexOf(k);
  return i === -1 ? 999 : i;
};

function orderedStepKeys(node: any): string[] {
  const present = new Set<string>();
  const steps = node?.steps || {};
  if (steps && typeof steps === 'object') {
    for (const key of Object.keys(steps)) present.add(key);
  }
  const msgs = node?.messages || {};
  if (msgs && typeof msgs === 'object') {
    for (const key of Object.keys(msgs)) present.add(key);
  }
  if (present.size === 0) return [];
  const known = STEP_ORDER.filter(k => present.has(k));
  const custom = Array.from(present).filter(k => !STEP_ORDER.includes(k)).sort();
  return [...known, ...custom];
}

function extractActionTextKey(action: any): string | undefined {
  const params = Array.isArray(action?.parameters) ? action.parameters : [];
  const p = params.find((x: any) => x?.parameterId === 'text');
  return typeof p?.value === 'string' ? p.value : undefined;
}

function collectNodeMessages(node: any, translations: Record<string, string>, pathLabel: string): ReviewItem[] {
  const out: ReviewItem[] = [];
  const steps = node?.steps || {};
  const msgs = node?.messages || {};
  const keys = orderedStepKeys(node);
  keys.forEach((stepKey) => {
    const beforeCount = out.length;
    const escs = Array.isArray(steps[stepKey]?.escalations) ? steps[stepKey].escalations : [];
    escs.forEach((esc: any, escIdx: number) => {
      const actions = Array.isArray(esc?.actions) ? esc.actions : [];
      actions.forEach((a: any, actIdx: number) => {
        const key = extractActionTextKey(a);
        if (typeof key === 'string') {
          out.push({
            id: `${pathLabel}|${stepKey}|${escIdx}|${actIdx}`,
            stepKey,
            escIndex: escIdx,
            actionIndex: actIdx,
            textKey: key,
            text: translations[key] || key,
            pathLabel,
          });
        }
      });
    });
    // legacy messages for this specific step
    if (out.length === beforeCount) {
      const m = msgs[stepKey];
      const key = typeof m?.textKey === 'string' ? m.textKey : undefined;
      if (key) out.push({ id: `${pathLabel}|${stepKey}|-1|-1`, stepKey, escIndex: null, actionIndex: null, textKey: key, text: translations[key] || key, pathLabel });
    }
  });
  return out;
}

export function collectAllMessages(ddt: any, translations: Record<string, string>): ReviewItem[] {
  const list: ReviewItem[] = [];
  const mains: any[] = Array.isArray(ddt?.mainData) ? ddt.mainData : [];
  mains.forEach((m) => {
    const mainLabel = m?.label || 'Main';
    list.push(...collectNodeMessages(m, translations, mainLabel));
    const subs: any[] = Array.isArray(m?.subData) ? m.subData : [];
    subs.forEach((s) => {
      const subLabel = s?.label || 'Sub';
      list.push(...collectNodeMessages(s, translations, `${mainLabel} / ${subLabel}`));
    });
  });
  // IMPORTANT: keep insertion order (main→subs) and step order per node; do not globally sort
  return list;
}


