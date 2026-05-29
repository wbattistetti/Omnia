/**
 * Funzionalità suggerite per un backend esistente (estensioni contratto API emerse in review).
 */

import type { BackendParameterDirection, BackendParameterKind } from './backendAnalysisDocumentV2';
import {
  parametersRecordFromList,
  parseParametersFromSpecMarkdown,
  parsePurposeFromSpecMarkdown,
  type ProposedBackendParameterSpec,
} from './proposedBackendSpec';

export type { ProposedBackendParameterSpec as SuggestedFeatureParameterSpec };

/** Bozza specifica inclusa nell'osservazione di review backend (prima passata IA). */
export type KbAnalysisSuggestedFeatureDraft = {
  title: string;
  purposeMarkdown: string;
  parameters: Record<string, ProposedBackendParameterSpec>;
};

export type BackendSuggestedFeatureRecord = {
  id: string;
  /** Titolo breve (es. «Vincoli selezione slot»). */
  title: string;
  purposeMarkdown: string;
  parameters: Record<string, ProposedBackendParameterSpec>;
  specMarkdown: string;
  /** Osservazione review da cui è stata generata. */
  sourceObservationId?: string;
  createdAt: string;
};

export function createSuggestedFeatureId(): string {
  return `sf_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function syncSuggestedFeatureRecord(
  record: BackendSuggestedFeatureRecord
): BackendSuggestedFeatureRecord {
  let purposeMarkdown = record.purposeMarkdown.trim();
  let parameters = { ...record.parameters };

  if (Object.keys(parameters).length === 0 && record.specMarkdown.trim()) {
    purposeMarkdown = purposeMarkdown || parsePurposeFromSpecMarkdown(record.specMarkdown);
    parameters = parametersRecordFromList(
      parseParametersFromSpecMarkdown(record.specMarkdown)
    );
  }

  const specMarkdown = renderSuggestedFeatureSpecMarkdown(
    record.title,
    purposeMarkdown,
    Object.values(parameters)
  );

  return {
    ...record,
    title: record.title.trim() || 'Funzionalità suggerita',
    purposeMarkdown,
    parameters,
    specMarkdown,
  };
}

export function renderSuggestedFeatureSpecMarkdown(
  title: string,
  purposeMarkdown: string,
  parameters: readonly ProposedBackendParameterSpec[]
): string {
  const heading = title.trim() || 'Funzionalità suggerita';
  const purpose = purposeMarkdown.trim();
  if (!purpose && parameters.length === 0) return '';

  const lines: string[] = [`## ${heading}`, '', purpose || '_Da definire_', ''];

  if (parameters.length > 0) {
    lines.push(
      '## Parametri da aggiungere (SEND / RECEIVE)',
      '',
      '| Parametro | Direzione | Tipo dato | Obbligo | Ruolo | Descrizione |',
      '| --- | --- | --- | --- | --- | --- |'
    );
    for (const p of parameters) {
      const dir = p.direction === 'input' ? '→ input' : '← output';
      lines.push(
        `| ${p.paramKey} | ${dir} | ${p.dataType || 'string'} | ${p.kind} | ${p.role || '—'} | ${p.descriptionShort || '—'} |`
      );
    }
    lines.push('');
  }

  return lines.join('\n').trim();
}

export function suggestedFeatureHasSubstance(record: BackendSuggestedFeatureRecord): boolean {
  if (record.title.trim().length >= 8) return true;
  if (record.purposeMarkdown.trim().length >= 20) return true;
  return Object.values(record.parameters).some(
    (p) => Boolean(p.descriptionShort.trim()) || Boolean(p.role.trim())
  );
}

export function parseSuggestedFeatureParameter(
  raw: Record<string, unknown>
): ProposedBackendParameterSpec | null {
  const paramKey = String(raw.paramKey ?? raw.name ?? '').trim();
  if (!paramKey) return null;
  const kindRaw = String(raw.kind ?? 'required').toLowerCase();
  const kind: BackendParameterKind =
    kindRaw === 'optional' ||
    kindRaw === 'derived' ||
    kindRaw === 'unused' ||
    kindRaw === 'missing'
      ? kindRaw
      : 'required';
  const dirRaw = String(raw.direction ?? 'input').toLowerCase();
  const direction: BackendParameterDirection = dirRaw === 'output' ? 'output' : 'input';
  return {
    paramKey,
    direction,
    kind,
    dataType: String(raw.dataType ?? 'string'),
    role: String(raw.role ?? ''),
    descriptionShort: String(raw.descriptionShort ?? raw.description ?? ''),
  };
}

/** Estrae bozza structured da campo observation.suggestedFeature (review). */
export function parseSuggestedFeatureDraft(raw: unknown): KbAnalysisSuggestedFeatureDraft | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const title = String(o.title ?? '').trim();
  const purposeMarkdown = String(o.purposeMarkdown ?? o.purpose ?? '').trim();
  const paramsRaw = o.parameters;
  const parameters: Record<string, ProposedBackendParameterSpec> = {};

  if (Array.isArray(paramsRaw)) {
    for (const item of paramsRaw) {
      if (!item || typeof item !== 'object') continue;
      const p = parseSuggestedFeatureParameter(item as Record<string, unknown>);
      if (p) parameters[p.paramKey] = p;
    }
  } else if (paramsRaw && typeof paramsRaw === 'object') {
    for (const [pk, pr] of Object.entries(paramsRaw as Record<string, unknown>)) {
      if (!pr || typeof pr !== 'object') continue;
      const p = parseSuggestedFeatureParameter({
        ...(pr as Record<string, unknown>),
        paramKey: (pr as Record<string, unknown>).paramKey ?? pk,
      });
      if (p) parameters[p.paramKey] = p;
    }
  }

  if (!title && !purposeMarkdown && Object.keys(parameters).length === 0) {
    return null;
  }

  return {
    title: title || 'Funzionalità suggerita',
    purposeMarkdown,
    parameters,
  };
}

export function suggestedFeatureDraftHasSubstance(draft: KbAnalysisSuggestedFeatureDraft): boolean {
  return syncSuggestedFeatureRecord({
    id: 'draft',
    title: draft.title,
    purposeMarkdown: draft.purposeMarkdown,
    parameters: draft.parameters,
    specMarkdown: '',
    createdAt: '',
  }).specMarkdown.length > 0;
}

export function materializeSuggestedFeatureFromDraft(
  draft: KbAnalysisSuggestedFeatureDraft,
  sourceObservationId: string
): BackendSuggestedFeatureRecord {
  return syncSuggestedFeatureRecord({
    id: createSuggestedFeatureId(),
    title: draft.title,
    purposeMarkdown: draft.purposeMarkdown,
    parameters: draft.parameters,
    specMarkdown: '',
    sourceObservationId,
    createdAt: new Date().toISOString(),
  });
}

export function buildSuggestedFeatureFromApiPayload(
  payload: Record<string, unknown>,
  sourceObservationId?: string
): BackendSuggestedFeatureRecord | null {
  const title = String(payload.title ?? payload.suggestedTitle ?? '').trim();
  const purposeMarkdown = String(payload.purposeMarkdown ?? payload.purpose ?? '').trim();
  const paramsRaw = payload.parameters;
  const parameters: Record<string, ProposedBackendParameterSpec> = {};

  if (Array.isArray(paramsRaw)) {
    for (const item of paramsRaw) {
      if (!item || typeof item !== 'object') continue;
      const p = parseSuggestedFeatureParameter(item as Record<string, unknown>);
      if (p) parameters[p.paramKey] = p;
    }
  } else if (paramsRaw && typeof paramsRaw === 'object') {
    for (const [pk, pr] of Object.entries(paramsRaw as Record<string, unknown>)) {
      if (!pr || typeof pr !== 'object') continue;
      const p = parseSuggestedFeatureParameter({
        ...(pr as Record<string, unknown>),
        paramKey: (pr as Record<string, unknown>).paramKey ?? pk,
      });
      if (p) parameters[p.paramKey] = p;
    }
  }

  if (!title && !purposeMarkdown && Object.keys(parameters).length === 0) {
    return null;
  }

  return syncSuggestedFeatureRecord({
    id: createSuggestedFeatureId(),
    title: title || 'Funzionalità suggerita',
    purposeMarkdown,
    parameters,
    specMarkdown: '',
    sourceObservationId,
    createdAt: new Date().toISOString(),
  });
}
