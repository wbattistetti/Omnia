/**
 * Compila indice runtime compatto da catalogo UC KB dialog.
 */

import type { AIAgentUseCase } from '@types/aiAgentUseCases';
import { KB_DIALOG_RUNTIME_INDEX_SCHEMA_VERSION } from './kbDialogConstants';
import type {
  KbDialogAcquisitionIndexEntry,
  KbDialogAcquisitionRow,
  KbDialogCorrectionIndexEntry,
  KbDialogInformIndexEntry,
  KbDialogInformRow,
  KbDialogRuntimeIndex,
} from './kbDialogTypes';
import type { SelectorValueLabels } from '../kbSelectorSpec';
import type { KbDialogSlotLexicon } from './kbDialogSlotLexicon';

export type CompileKbDialogRuntimeIndexParams = {
  useCases: readonly AIAgentUseCase[];
  valueLabels: SelectorValueLabels;
  completeTemplate: string;
  kbDocumentId?: string;
  acquisitionRowsBySelector: ReadonlyMap<string, readonly KbDialogAcquisitionRow[]>;
  informRowsBySelector?: ReadonlyMap<string, readonly KbDialogInformRow[]>;
  slotLexicon?: KbDialogSlotLexicon;
};

/** Messaggio assistant canonico del designer sullo use case. */
export function getKbDialogUseCaseAssistantSay(uc: AIAgentUseCase): string {
  return uc.dialogue.find((t) => t.role === 'assistant')?.content?.trim() ?? '';
}

export function compileKbDialogRuntimeIndex(
  params: CompileKbDialogRuntimeIndexParams
): KbDialogRuntimeIndex {
  const acquisition: Record<string, KbDialogAcquisitionIndexEntry> = {};
  const inform: Record<string, KbDialogInformIndexEntry> = {};

  for (const uc of params.useCases) {
    const meta = uc.kb_dialog_meta;
    if (!meta) continue;

    if (meta.kind === 'acquisition' && meta.selectorColumnId) {
      const ucSay = getKbDialogUseCaseAssistantSay(uc);
      const rows = params.acquisitionRowsBySelector.get(meta.selectorColumnId) ?? [];
      acquisition[meta.selectorColumnId] = {
        useCaseId: uc.id,
        selectorColumnId: meta.selectorColumnId,
        rows: rows.map((r) => ({
          bindingWhen: { ...r.bindingWhen },
          say: ucSay,
          allowedValues: [...r.allowedValues],
        })),
      };
    }

    if (meta.kind === 'inform' && meta.selectorColumnId) {
      const ucSay = getKbDialogUseCaseAssistantSay(uc);
      const rows = params.informRowsBySelector?.get(meta.selectorColumnId) ?? [];
      inform[meta.selectorColumnId] = {
        useCaseId: uc.id,
        selectorColumnId: meta.selectorColumnId,
        rows: rows.map((r) => ({
          bindingWhen: { ...r.bindingWhen },
          say: ucSay,
          deDisclosureSay: meta.deDisclosureSay ?? r.deDisclosureSay,
          transitionSay: meta.transitionSay ?? r.transitionSay,
          informedValue: r.informedValue,
          ...(r.requiresAcceptance ? { requiresAcceptance: true } : {}),
        })),
      };
    }
  }

  const correction: KbDialogCorrectionIndexEntry[] = params.useCases
    .filter((uc) => uc.kb_dialog_meta?.kind === 'correction')
    .map((uc) => {
      const meta = uc.kb_dialog_meta!;
      const assistant = uc.dialogue.find((t) => t.role === 'assistant');
      return {
        useCaseId: uc.id,
        triggerColumnId: meta.triggerColumnId ?? '',
        incompatibleColumnId: meta.invalidatedColumnIds?.[0] ?? '',
        sayTemplate: assistant?.content?.trim() ?? '',
      };
    })
    .filter((e) => e.triggerColumnId && e.incompatibleColumnId && e.sayTemplate);

  const completeUc = params.useCases.find((uc) => uc.kb_dialog_meta?.kind === 'complete');
  const completeSay =
    completeUc?.dialogue.find((t) => t.role === 'assistant')?.content?.trim() ??
    params.completeTemplate;

  return {
    schemaVersion: KB_DIALOG_RUNTIME_INDEX_SCHEMA_VERSION,
    ...(params.kbDocumentId ? { kbDocumentId: params.kbDocumentId } : {}),
    completeTemplate: params.completeTemplate,
    valueLabels: params.valueLabels,
    ...(params.slotLexicon && Object.keys(params.slotLexicon).length > 0
      ? { slotLexicon: params.slotLexicon }
      : {}),
    acquisition,
    inform,
    correction,
    complete: {
      useCaseId: completeUc?.id ?? 'uc_complete',
      sayTemplate: completeSay,
    },
  };
}

function findUseCaseForIndexEntry(
  useCases: readonly AIAgentUseCase[],
  useCaseId: string,
  kind: 'acquisition' | 'inform',
  selectorColumnId: string
): AIAgentUseCase | undefined {
  const byId = useCases.find((uc) => uc.id === useCaseId);
  if (byId) return byId;
  return useCases.find(
    (uc) =>
      uc.kb_dialog_meta?.kind === kind && uc.kb_dialog_meta.selectorColumnId === selectorColumnId
  );
}

/**
 * Aggiorna say/template nell'indice runtime dai messaggi UC (persist / edit designer).
 */
export function refreshKbDialogRuntimeIndexSayFromUseCases(
  index: KbDialogRuntimeIndex,
  useCases: readonly AIAgentUseCase[]
): KbDialogRuntimeIndex {
  const acquisition: Record<string, KbDialogAcquisitionIndexEntry> = {};
  for (const [colId, entry] of Object.entries(index.acquisition)) {
    const uc = findUseCaseForIndexEntry(useCases, entry.useCaseId, 'acquisition', colId);
    const ucSay = uc ? getKbDialogUseCaseAssistantSay(uc) : '';
    acquisition[colId] = {
      ...entry,
      rows: entry.rows.map((r) => ({ ...r, say: ucSay })),
    };
  }

  const inform: Record<string, KbDialogInformIndexEntry> = {};
  for (const [colId, entry] of Object.entries(index.inform ?? {})) {
    const uc = findUseCaseForIndexEntry(useCases, entry.useCaseId, 'inform', colId);
    const ucSay = uc ? getKbDialogUseCaseAssistantSay(uc) : '';
    const meta = uc?.kb_dialog_meta;
    inform[colId] = {
      ...entry,
      rows: entry.rows.map((r) => ({
        ...r,
        say: ucSay,
        ...(meta?.deDisclosureSay ? { deDisclosureSay: meta.deDisclosureSay } : {}),
        ...(meta?.transitionSay ? { transitionSay: meta.transitionSay } : {}),
      })),
    };
  }

  const correction = index.correction.map((entry) => {
    const uc = useCases.find((u) => u.id === entry.useCaseId);
    const sayTemplate = uc ? getKbDialogUseCaseAssistantSay(uc) : entry.sayTemplate;
    return { ...entry, sayTemplate };
  });

  const completeUc = useCases.find((uc) => uc.kb_dialog_meta?.kind === 'complete');
  const completeSay = completeUc
    ? getKbDialogUseCaseAssistantSay(completeUc) || index.complete.sayTemplate
    : index.complete.sayTemplate;

  return {
    ...index,
    acquisition,
    inform,
    correction,
    complete: {
      ...index.complete,
      sayTemplate: completeSay,
      ...(completeUc?.id ? { useCaseId: completeUc.id } : {}),
    },
  };
}

/** Parse `agentKbDialogIndexJson` persistito sul task. */
export function parseKbDialogRuntimeIndex(
  raw: string | undefined | null
): KbDialogRuntimeIndex | null {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) return null;
  try {
    const parsed = JSON.parse(trimmed) as KbDialogRuntimeIndex;
    if (parsed?.schemaVersion !== 1 || !parsed.complete) return null;
    if (!parsed.inform) parsed.inform = {};
    return parsed;
  } catch {
    return null;
  }
}

export function serializeKbDialogRuntimeIndex(index: KbDialogRuntimeIndex): string {
  return JSON.stringify(index);
}

/** Parse + refresh say UC → index (no-op se index assente o invalido). */
export function refreshKbDialogRuntimeIndexJsonFromUseCases(
  indexJson: string,
  useCases: readonly AIAgentUseCase[]
): string {
  const parsed = parseKbDialogRuntimeIndex(indexJson);
  if (!parsed) return indexJson;
  return serializeKbDialogRuntimeIndex(refreshKbDialogRuntimeIndexSayFromUseCases(parsed, useCases));
}
