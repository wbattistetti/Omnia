/**
 * Tipi metadati UC dialogo KB e indice runtime compile.
 */

import type { AIAgentUseCaseCategory } from '@types/aiAgentUseCases';
import type { SelectorValueLabels } from '../kbSelectorSpec';

export type KbDialogUseCaseKind = 'acquisition' | 'correction' | 'complete';

/** Metadati machine-readable su uno use case generato da KB. */
export type KbDialogUseCaseMeta = {
  kind: KbDialogUseCaseKind;
  /** Acquisition: selettore il cui valore manca nel binding. */
  selectorColumnId?: string;
  /** Binding prefix per varianti parametriche acquisition. */
  bindingWhen?: Record<string, string>;
  /** Correction: slot modificato dall'utente. */
  triggerColumnId?: string;
  /** Correction: slot downstream resi incompatibili. */
  invalidatedColumnIds?: string[];
  /** Acquisition: autofill — nessuna domanda al paziente. */
  skipAsk?: boolean;
  allowedValueCount?: number;
};

export type KbDialogAcquisitionRow = {
  bindingWhen: Record<string, string>;
  say: string;
  allowedValues: readonly string[];
};

export type KbDialogAcquisitionIndexEntry = {
  useCaseId: string;
  selectorColumnId: string;
  rows: readonly KbDialogAcquisitionRow[];
};

export type KbDialogCorrectionIndexEntry = {
  useCaseId: string;
  triggerColumnId: string;
  incompatibleColumnId: string;
  sayTemplate: string;
};

export type KbDialogRuntimeIndex = {
  schemaVersion: typeof import('./kbDialogConstants').KB_DIALOG_RUNTIME_INDEX_SCHEMA_VERSION;
  kbDocumentId?: string;
  completeTemplate: string;
  valueLabels: SelectorValueLabels;
  acquisition: Record<string, KbDialogAcquisitionIndexEntry>;
  correction: readonly KbDialogCorrectionIndexEntry[];
  complete: {
    useCaseId: string;
    sayTemplate: string;
  };
};

export type KbDialogGapIssue = {
  code: string;
  message: string;
  blocking: boolean;
};

export type GenerateKbDialogUseCasesResult = {
  useCases: import('@types/aiAgentUseCases').AIAgentUseCase[];
  categories: AIAgentUseCaseCategory[];
  runtimeIndex: KbDialogRuntimeIndex;
  valueLabels: SelectorValueLabels;
  completeTemplate: string;
  gapIssues: KbDialogGapIssue[];
};
