/**
 * Backend proposti (non in catalogo): nomi leggibili e specifiche da output analisi.
 */

import {
  inferProposedParameters,
  parametersRecordFromList,
  proposedBackendHasSubstance,
  renderProposedBackendSpecMarkdown,
  syncProposedBackendRecord,
  type ProposedBackendRecord,
} from './proposedBackendSpec';

export type { ProposedBackendParameterSpec, ProposedBackendRecord } from './proposedBackendSpec';

const PLACEHOLDER_RE = /\(da definire\)/i;

/** Nome corto per titolo accordion «Backend da aggiungere «…»?». */
export function sanitizeSuggestedBackendName(raw: string): string {
  let s = String(raw ?? '')
    .replace(/\*\*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!s) return 'nuovoBackend';

  if (/^[a-z][a-zA-Z0-9_]{0,48}$/.test(s)) return s;

  const quoted = s.match(/«([^»]+)»|"([^"]+)"/);
  if (quoted) {
    const inner = (quoted[1] || quoted[2] || '').trim();
    if (/^[a-z][a-zA-Z0-9_]{0,48}$/i.test(inner)) return inner;
    s = inner;
  }

  const lower = s.toLowerCase();
  if (/knowledge\s*base|ricerca.*prestazion|prestazion.*kb|kb.*prestazion/.test(lower)) {
    return 'searchKb';
  }
  if (/salva|save|persist|store.*id|service\s*id/.test(lower)) return 'saveServiceId';
  if (/getslot|slot.*detail|disponibil/.test(lower)) return 'getSlotDetails';

  const camel = s.match(/\b([a-z][a-zA-Z0-9]{2,40})\b/);
  const genericWord =
    /^(backend|tool|api|the|per|con|strumento|ricerca|knowledge|prestazioni|prestazione)$/i;
  if (camel && !genericWord.test(camel[1])) return camel[1];

  const words = lower.replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    const slug = `${words[0]!.slice(0, 12)}${words[1]!.slice(0, 12)}`;
    if (slug.length >= 4) return slug.slice(0, 40);
  }

  return s.length > 36 ? `${s.slice(0, 33)}…` : s;
}

function resolvePurpose(
  suggestedName: string,
  reason: string,
  sourceMarkdown?: string
): string {
  let purpose = reason.trim();

  if (!purpose && sourceMarkdown?.trim()) {
    const nameEsc = suggestedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(
      `(?:manca|servirebbe|necessario)[^.\\n]*${nameEsc}[^.\\n]*[.\\n]+`,
      'i'
    );
    const m = sourceMarkdown.match(re);
    if (m?.[0]) purpose = m[0].replace(/\s+/g, ' ').trim();
  }

  return purpose;
}

/** Costruisce record proposto con interfaccia SEND/RECEIVE strutturata. */
export function buildProposedBackendRecord(
  suggestedName: string,
  reason: string,
  sourceMarkdown?: string
): ProposedBackendRecord | null {
  const purposeMarkdown = resolvePurpose(suggestedName, reason, sourceMarkdown);
  if (!purposeMarkdown.trim()) return null;

  const parameters = parametersRecordFromList(
    inferProposedParameters(suggestedName, purposeMarkdown)
  );
  const specMarkdown = renderProposedBackendSpecMarkdown(
    purposeMarkdown,
    Object.values(parameters)
  );

  const record: ProposedBackendRecord = {
    id: '',
    suggestedName,
    purposeMarkdown,
    parameters,
    specMarkdown,
  };

  return proposedBackendHasSubstance(record) ? record : null;
}

/** @deprecated Usare {@link buildProposedBackendRecord}; mantiene compat export markdown. */
export function buildProposedBackendSpecification(
  suggestedName: string,
  reason: string,
  sourceMarkdown?: string
): string {
  return buildProposedBackendRecord(suggestedName, reason, sourceMarkdown)?.specMarkdown ?? '';
}

export function isPlaceholderProposedSpec(specMarkdown: string): boolean {
  const t = specMarkdown.trim();
  if (!t) return true;
  if (PLACEHOLDER_RE.test(t)) return true;
  const body = t.replace(/^#+\s+[^\n]+\n/gm, '').trim();
  return body.length < 24;
}

function proposedIdForName(name: string, index: number): string {
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 40);
  return `proposed_${index}_${slug || 'backend'}`;
}

/** Da sezione «Backend mancanti» dell'analisi AI → record proposti (solo se specifica sostanziale). */
export function proposedBackendsFromAnalysisMissing(
  missing: readonly { name: string; reason: string }[],
  sourceMarkdown?: string
): ProposedBackendRecord[] {
  const out: ProposedBackendRecord[] = [];
  for (let i = 0; i < missing.length; i++) {
    const m = missing[i]!;
    const suggestedName = sanitizeSuggestedBackendName(m.name);
    const built = buildProposedBackendRecord(suggestedName, m.reason, sourceMarkdown);
    if (!built) continue;
    out.push(
      syncProposedBackendRecord({
        ...built,
        id: proposedIdForName(suggestedName, i),
      })
    );
  }
  return out;
}
