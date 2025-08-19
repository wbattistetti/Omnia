// Normalizer for DDT Builder output – assigns canonical kinds and sub structures
// Applies deterministic rules so extractors can run reliably.

type Node = any;

const LABEL_TO_KIND: Array<{ test: (s: string) => boolean; kind: 'name'|'date'|'address'|'phone'|'email'|'number'|'text' }>= [
  { test: s => /full\s*name|nome\s*completo|name\b/i.test(s), kind: 'name' },
  { test: s => /date\s*of\s*birth|data\s*di\s*nascita|birth\s*date|dob\b/i.test(s), kind: 'date' },
  { test: s => /address|indirizzo/i.test(s), kind: 'address' },
  { test: s => /phone|telefono|cellulare/i.test(s), kind: 'phone' },
  { test: s => /email|e-?mail/i.test(s), kind: 'email' },
  { test: s => /number|numero/i.test(s), kind: 'number' },
  { test: _ => true, kind: 'text' },
];

function ensureId(label: string, fallback: string) {
  return `${label || fallback}`;
}

function upsertSub(main: Node, label: string, type: 'text'|'number', required = true) {
  const idx = (main.subData || []).findIndex((s: Node) => String(s?.label || '').toLowerCase() === label.toLowerCase());
  if (idx >= 0) {
    main.subData[idx].type = type;
    if (required === false) main.subData[idx].required = false; else main.subData[idx].required = true;
    return;
  }
  main.subData = main.subData || [];
  main.subData.push({ id: ensureId(label, label), label, type, required });
}

export function normalizeDDTMainNodes(mains: Node[]): Node[] {
  return (mains || []).map((main) => {
    const label = String(main?.label || '').trim();
    const existing = String(main?.kind || '').trim().toLowerCase();
    const existingType = String(main?.type || '').trim().toLowerCase();
    const manual = String((main as any)?._kindManual || '').trim().toLowerCase();
    // Respect explicit kind set by the editor; only infer when missing/auto/generic
    let kind: any;
    if (manual) kind = manual;
    else if (existing && existing !== 'generic' && existing !== 'auto') kind = existing;
    else {
      const mapped = LABEL_TO_KIND.find(r => r.test(label));
      kind = mapped ? mapped.kind : 'text';
      if (/telephone|phone|telefono|cellulare/i.test(label)) kind = 'phone';
    }
    try { // debug mapping
      // eslint-disable-next-line no-console
      console.log('[DDT normalizeKinds] map', { label, existing, existingType, kind });
    } catch {}
    const out: Node = { ...main, kind };
    out.subData = Array.isArray(main.subData) ? [...main.subData] : [];
    // Canonicalize subs per kind
    if (kind === 'name') {
      upsertSub(out, 'First name', 'text', true);
      upsertSub(out, 'Last name', 'text', true);
    } else if (kind === 'date') {
      upsertSub(out, 'Day', 'number', true);
      upsertSub(out, 'Month', 'number', true);
      upsertSub(out, 'Year', 'number', true);
    } else if (kind === 'address') {
      // Default all subs to required=true; user can uncheck in the sidebar
      upsertSub(out, 'Street', 'text', true);
      upsertSub(out, 'House Number', 'text', true);
      upsertSub(out, 'City', 'text', true);
      upsertSub(out, 'Postal Code', 'text', true);
      upsertSub(out, 'Country', 'text', true);
      upsertSub(out, 'Region/State', 'text', true);
    } else if (kind === 'phone') {
      // Canonical phone structure: Number (required) + optional Prefix
      upsertSub(out, 'Number', 'text', true);
      upsertSub(out, 'Prefix', 'text', false);
    }
    try {
      // eslint-disable-next-line no-console
      console.log('[DDT normalizeKinds][result]', {
        label,
        chosenKind: out.kind,
        manual: (main as any)?._kindManual || undefined,
        existing,
        existingType,
        subs: (out.subData || []).map((s: any) => ({ label: s?.label, required: s?.required, type: s?.type })),
      });
    } catch {}
    return out;
  });
}


