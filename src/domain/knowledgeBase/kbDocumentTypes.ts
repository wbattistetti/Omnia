/**
 * Knowledge-base document types shared between AI Agent tasks and ElevenLabs workspace.
 */

import type { KbExtractedVariable } from '@workspaces/elevenlabs/parseKbDocument';
import type { KbRestructureClarificationQuestion } from './kbDocumentRestructureWorkflow';
import {
  parseKbDocumentSelectorSpec,
  type KbDocumentSelectorSpec,
} from './kbSelectorSpec';

export { KB_DOCUMENT_ACCEPT } from './kbFileKinds';
export {
  detectKbFileFormat,
  isKbGenericTextReadable,
  isKbImageFormat,
  isKbParsableTabular,
} from './kbFileKinds';

export type KbParseStatus = 'parsing' | 'ready' | 'error' | 'unsupported';

/** Documenti KB generati dal designer (non upload file). */
export type KbDocumentKind = 'upload' | 'invalidated_use_case_note';

export type KbStagedFileBase = {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  addedAt: string;
  file: File;
};

/** KB document after local parse / repository upload. */
export type StagedKbDocument = KbStagedFileBase & {
  parseStatus: KbParseStatus;
  parseError?: string;
  format?: import('./kbFileKinds').KbFileFormat;
  variables: readonly KbExtractedVariable[];
  variableDictionary: Readonly<Record<string, string>>;
  howToUseText: string;
  markdownSnippet: string;
  /** Project repository blob id (persisted). */
  repositoryDocumentId?: string;
  /** Analisi markdown del documento — unica fonte di verità (tab Analisi del documento). */
  documentAnalysisMarkdown: string;
  /** Ultima versione proposta/concordata dall'agente (base esplicita per il diff). */
  agentAnalysisBaselineMarkdown: string;
  /** Baseline per sezione ### (chiave = kbSection:…). */
  documentAnalysisSectionBaselines?: Record<string, string>;
  /** Distillazione estrema LLM per runtime (cache; hash su input euristico). */
  documentAnalysisRuntimeDistillMarkdown?: string;
  documentAnalysisRuntimeDistillSourceHash?: string;
  /** Vista canonica meno ambigua (tab Documento riformattato). */
  documentRestructuredMarkdown: string;
  /** Baseline IA per diff designer sul documento riformattato. */
  agentRestructuredBaselineMarkdown: string;
  /** Se true, runtime agente usa documentRestructuredMarkdown al posto del sorgente grezzo. */
  documentRestructuredApprovedForRuntime?: boolean;
  /** Note meta riformattazione (origine, ambiguità, …) — tab Analisi accordion. */
  documentRestructureNotesMarkdown: string;
  /** Baseline IA note riformattazione. */
  agentRestructureNotesBaselineMarkdown: string;
  /** Note designer per riga tabella riformattata (chiave = restructureRowKey). */
  documentRestructureRowNotes?: Record<string, string>;
  /** Domande IA su ambiguità strutturali + risposte designer. */
  documentRestructureQuestions?: readonly KbRestructureClarificationQuestion[];
  /** Osservazioni libere designer prima del refine con feedback. */
  documentRestructureDesignerFeedback?: string;
  /** Snapshot feedback applicato con l'ultimo «Aggiorna formattazione». */
  documentRestructureFeedbackAppliedSnapshot?: string;
  /** Istruzioni designer per colonne (inviate al refine IA). */
  documentRestructureColumnInstructions?: Record<string, string>;
  /** Metadati selettori dialogo per tabella riformattata (sidecar design time). */
  documentSelectorSpec?: KbDocumentSelectorSpec;
  /** Default `upload` per documenti caricati; note invalidazione scenario = `invalidated_use_case_note`. */
  kbDocumentKind?: KbDocumentKind;
  /** Use case collegato (note invalidazione scenario). */
  linkedUseCaseId?: string;
};

export type PersistedKbDocument = Omit<StagedKbDocument, 'file'>;

export function filesToKbStaged(files: readonly File[]): KbStagedFileBase[] {
  const now = new Date().toISOString();
  return files.map((file) => ({
    id:
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${file.name}`,
    name: file.name,
    size: file.size,
    mimeType: file.type || 'application/octet-stream',
    addedAt: now,
    file,
  }));
}

export function formatKbFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function emptyKbDocument(
  base: KbStagedFileBase,
  parseStatus: KbParseStatus,
  format?: StagedKbDocument['format']
): StagedKbDocument {
  return {
    ...base,
    parseStatus,
    format,
    variables: [],
    variableDictionary: {},
    howToUseText: '',
    markdownSnippet: '',
    documentAnalysisMarkdown: '',
    agentAnalysisBaselineMarkdown: '',
    documentRestructuredMarkdown: '',
    agentRestructuredBaselineMarkdown: '',
    documentRestructureNotesMarkdown: '',
    agentRestructureNotesBaselineMarkdown: '',
  };
}

export function persistedKbToStaged(p: PersistedKbDocument): StagedKbDocument {
  const raw = p as PersistedKbDocument & {
    documentAnalysisMarkdown?: unknown;
    agentAnalysisBaselineMarkdown?: unknown;
    documentRestructuredMarkdown?: unknown;
    agentRestructuredBaselineMarkdown?: unknown;
    documentRestructuredApprovedForRuntime?: unknown;
    documentRestructureNotesMarkdown?: unknown;
    agentRestructureNotesBaselineMarkdown?: unknown;
    documentRestructureRowNotes?: unknown;
    documentRestructureQuestions?: unknown;
    documentRestructureDesignerFeedback?: unknown;
    documentRestructureFeedbackAppliedSnapshot?: unknown;
    documentRestructureColumnInstructions?: unknown;
    documentSelectorSpec?: unknown;
  };
  return {
    ...p,
    file: new File([], p.name, { type: p.mimeType }),
    variables: Array.isArray(p.variables) ? p.variables : [],
    variableDictionary:
      p.variableDictionary && typeof p.variableDictionary === 'object'
        ? p.variableDictionary
        : {},
    howToUseText: typeof p.howToUseText === 'string' ? p.howToUseText : '',
    markdownSnippet: typeof p.markdownSnippet === 'string' ? p.markdownSnippet : '',
    documentAnalysisMarkdown:
      typeof raw.documentAnalysisMarkdown === 'string' ? raw.documentAnalysisMarkdown : '',
    agentAnalysisBaselineMarkdown:
      typeof raw.agentAnalysisBaselineMarkdown === 'string'
        ? raw.agentAnalysisBaselineMarkdown
        : '',
    documentAnalysisSectionBaselines:
      raw.documentAnalysisSectionBaselines &&
      typeof raw.documentAnalysisSectionBaselines === 'object'
        ? Object.fromEntries(
            Object.entries(raw.documentAnalysisSectionBaselines).filter(
              (entry): entry is [string, string] => typeof entry[1] === 'string'
            )
          )
        : undefined,
    documentAnalysisRuntimeDistillMarkdown:
      typeof raw.documentAnalysisRuntimeDistillMarkdown === 'string'
        ? raw.documentAnalysisRuntimeDistillMarkdown
        : undefined,
    documentAnalysisRuntimeDistillSourceHash:
      typeof raw.documentAnalysisRuntimeDistillSourceHash === 'string'
        ? raw.documentAnalysisRuntimeDistillSourceHash
        : undefined,
    documentRestructuredMarkdown:
      typeof raw.documentRestructuredMarkdown === 'string' ? raw.documentRestructuredMarkdown : '',
    agentRestructuredBaselineMarkdown:
      typeof raw.agentRestructuredBaselineMarkdown === 'string'
        ? raw.agentRestructuredBaselineMarkdown
        : '',
    documentRestructuredApprovedForRuntime:
      raw.documentRestructuredApprovedForRuntime === true ? true : undefined,
    documentRestructureNotesMarkdown:
      typeof raw.documentRestructureNotesMarkdown === 'string'
        ? raw.documentRestructureNotesMarkdown
        : '',
    agentRestructureNotesBaselineMarkdown:
      typeof raw.agentRestructureNotesBaselineMarkdown === 'string'
        ? raw.agentRestructureNotesBaselineMarkdown
        : '',
    ...(raw.documentRestructureRowNotes &&
    typeof raw.documentRestructureRowNotes === 'object' &&
    !Array.isArray(raw.documentRestructureRowNotes)
      ? {
          documentRestructureRowNotes: Object.fromEntries(
            Object.entries(raw.documentRestructureRowNotes).filter(
              (entry): entry is [string, string] =>
                typeof entry[0] === 'string' &&
                typeof entry[1] === 'string' &&
                entry[1].trim().length > 0
            )
          ),
        }
      : {}),
    ...(Array.isArray(raw.documentRestructureQuestions)
      ? { documentRestructureQuestions: raw.documentRestructureQuestions }
      : {}),
    ...(typeof raw.documentRestructureDesignerFeedback === 'string' &&
    raw.documentRestructureDesignerFeedback.trim()
      ? { documentRestructureDesignerFeedback: raw.documentRestructureDesignerFeedback.trim() }
      : {}),
    ...(typeof raw.documentRestructureFeedbackAppliedSnapshot === 'string' &&
    raw.documentRestructureFeedbackAppliedSnapshot.trim()
      ? {
          documentRestructureFeedbackAppliedSnapshot:
            raw.documentRestructureFeedbackAppliedSnapshot.trim(),
        }
      : {}),
    ...(raw.documentRestructureColumnInstructions &&
    typeof raw.documentRestructureColumnInstructions === 'object' &&
    !Array.isArray(raw.documentRestructureColumnInstructions)
      ? {
          documentRestructureColumnInstructions: Object.fromEntries(
            Object.entries(raw.documentRestructureColumnInstructions).filter(
              (entry): entry is [string, string] =>
                typeof entry[0] === 'string' &&
                typeof entry[1] === 'string' &&
                entry[1].trim().length > 0
            )
          ),
        }
      : {}),
    ...((): { documentSelectorSpec?: KbDocumentSelectorSpec } => {
      const parsed = parseKbDocumentSelectorSpec(raw.documentSelectorSpec);
      return parsed ? { documentSelectorSpec: parsed } : {};
    })(),
    ...(raw.kbDocumentKind === 'invalidated_use_case_note'
      ? { kbDocumentKind: 'invalidated_use_case_note' as const }
      : {}),
    linkedUseCaseId:
      typeof raw.linkedUseCaseId === 'string' && raw.linkedUseCaseId.trim()
        ? raw.linkedUseCaseId.trim()
        : undefined,
  };
}

/** Persisted JSON: omit optional fields when unset (stable roundtrip). */
export function stagedKbToPersisted(d: StagedKbDocument): PersistedKbDocument {
  const { file: _file, ...rest } = d;
  return Object.fromEntries(
    Object.entries(rest).filter(([, value]) => value !== undefined)
  ) as PersistedKbDocument;
}

export type KbDocumentPatch = Partial<
  Pick<
    StagedKbDocument,
    | 'howToUseText'
    | 'markdownSnippet'
    | 'documentAnalysisMarkdown'
    | 'agentAnalysisBaselineMarkdown'
    | 'documentAnalysisSectionBaselines'
    | 'documentAnalysisRuntimeDistillMarkdown'
    | 'documentAnalysisRuntimeDistillSourceHash'
    | 'documentRestructuredMarkdown'
    | 'agentRestructuredBaselineMarkdown'
    | 'documentRestructuredApprovedForRuntime'
    | 'documentRestructureNotesMarkdown'
    | 'agentRestructureNotesBaselineMarkdown'
    | 'documentRestructureRowNotes'
    | 'documentRestructureQuestions'
    | 'documentRestructureDesignerFeedback'
    | 'documentRestructureFeedbackAppliedSnapshot'
    | 'documentRestructureColumnInstructions'
    | 'documentSelectorSpec'
    | 'repositoryDocumentId'
    | 'parseStatus'
    | 'parseError'
    | 'variables'
    | 'variableDictionary'
    | 'format'
    | 'kbDocumentKind'
    | 'linkedUseCaseId'
    | 'name'
  >
>;
