/**
 * Compila indice runtime compatto da catalogo UC KB dialog.
 */

import type { AIAgentUseCase } from '@types/aiAgentUseCases';
import { KB_DIALOG_RUNTIME_INDEX_SCHEMA_VERSION } from './kbDialogConstants';
import type {
  KbDialogAcquisitionIndexEntry,
  KbDialogAcquisitionRow,
  KbDialogCorrectionIndexEntry,
  KbDialogRuntimeIndex,
} from './kbDialogTypes';
import type { SelectorValueLabels } from '../kbSelectorSpec';

export type CompileKbDialogRuntimeIndexParams = {
  useCases: readonly AIAgentUseCase[];
  valueLabels: SelectorValueLabels;
  completeTemplate: string;
  kbDocumentId?: string;
  acquisitionRowsBySelector: ReadonlyMap<string, readonly KbDialogAcquisitionRow[]>;
};

export function compileKbDialogRuntimeIndex(
  params: CompileKbDialogRuntimeIndexParams
): KbDialogRuntimeIndex {
  const acquisition: Record<string, KbDialogAcquisitionIndexEntry> = {};

  for (const uc of params.useCases) {
    const meta = uc.kb_dialog_meta;
    if (!meta) continue;

    if (meta.kind === 'acquisition' && meta.selectorColumnId) {
      const rows = params.acquisitionRowsBySelector.get(meta.selectorColumnId) ?? [];
      acquisition[meta.selectorColumnId] = {
        useCaseId: uc.id,
        selectorColumnId: meta.selectorColumnId,
        rows: rows.map((r) => ({
          bindingWhen: { ...r.bindingWhen },
          say: r.say,
          allowedValues: [...r.allowedValues],
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
    acquisition,
    correction,
    complete: {
      useCaseId: completeUc?.id ?? 'uc_complete',
      sayTemplate: completeSay,
    },
  };
}
