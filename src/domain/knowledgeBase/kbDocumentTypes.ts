/**
 * Knowledge-base document types shared between AI Agent tasks and ElevenLabs workspace.
 */

import type { KbExtractedVariable } from '@workspaces/elevenlabs/parseKbDocument';

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
  };
}

export function persistedKbToStaged(p: PersistedKbDocument): StagedKbDocument {
  const raw = p as PersistedKbDocument & {
    documentAnalysisMarkdown?: unknown;
    agentAnalysisBaselineMarkdown?: unknown;
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
    kbDocumentKind:
      raw.kbDocumentKind === 'invalidated_use_case_note' ? 'invalidated_use_case_note' : 'upload',
    linkedUseCaseId:
      typeof raw.linkedUseCaseId === 'string' && raw.linkedUseCaseId.trim()
        ? raw.linkedUseCaseId.trim()
        : undefined,
  };
}

export function stagedKbToPersisted(d: StagedKbDocument): PersistedKbDocument {
  const { file: _file, ...rest } = d;
  return rest;
}

export type KbDocumentPatch = Partial<
  Pick<
    StagedKbDocument,
    | 'howToUseText'
    | 'markdownSnippet'
    | 'documentAnalysisMarkdown'
    | 'agentAnalysisBaselineMarkdown'
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
