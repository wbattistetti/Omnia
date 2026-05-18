/**
 * Knowledge-base document types shared between AI Agent tasks and ElevenLabs workspace.
 */

import type { KbExtractedVariable } from '@workspaces/elevenlabs/parseKbDocument';
import type {
  KbChatMessage,
  KbDocumentStructure,
  KbSemanticAnalysisStatus,
} from './kbRuleTypes';
import { normalizeKbRules } from './kbRuleTypes';
import type { KbInducedRule } from './kbRuleTypes';

export type { KbChatMessage, KbDocumentStructure, KbInducedRule, KbRuleValidation, KbSemanticAnalysisStatus } from './kbRuleTypes';
export { KB_DOCUMENT_ACCEPT } from './kbFileKinds';
export { detectKbFileFormat, isKbGenericTextReadable, isKbParsableTabular } from './kbFileKinds';

export type KbParseStatus = 'parsing' | 'ready' | 'error' | 'unsupported';

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
  structure?: KbDocumentStructure | null;
  /** Data kinds detected on first Analyze (pills in dock). */
  dataTypes: readonly string[];
  rules: readonly KbInducedRule[];
  /** True after guided chat session started (rules may appear from chat). */
  chatStarted: boolean;
  semanticStatus: KbSemanticAnalysisStatus;
  semanticError?: string;
  analysisNote?: string;
  chatMessages: readonly KbChatMessage[];
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
    dataTypes: [],
    rules: [],
    chatStarted: false,
    semanticStatus: 'idle',
    chatMessages: [],
  };
}

export function persistedKbToStaged(p: PersistedKbDocument): StagedKbDocument {
  return {
    ...p,
    file: new File([], p.name, { type: p.mimeType }),
    dataTypes: Array.isArray(p.dataTypes)
      ? p.dataTypes.map((t) => String(t).trim()).filter(Boolean)
      : [],
    rules: normalizeKbRules(p.rules),
    chatStarted: Boolean(p.chatStarted),
    chatMessages: Array.isArray(p.chatMessages) ? p.chatMessages : [],
    semanticStatus: p.semanticStatus ?? 'idle',
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
    | 'structure'
    | 'dataTypes'
    | 'rules'
    | 'chatStarted'
    | 'semanticStatus'
    | 'semanticError'
    | 'analysisNote'
    | 'chatMessages'
    | 'repositoryDocumentId'
    | 'parseStatus'
    | 'variables'
    | 'variableDictionary'
    | 'format'
  >
>;
