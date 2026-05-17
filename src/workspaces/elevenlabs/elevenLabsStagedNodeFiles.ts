/**
 * Local file staging for ElevenLabs workspace node panels (KB / tools) before remote upload.
 */

import type { KbExtractedVariable } from './parseKbDocument';

export type StagedNodeFileKind = 'kb' | 'tools';

export type KbParseStatus = 'parsing' | 'ready' | 'error' | 'unsupported';

export type StagedNodeFile = {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  addedAt: string;
  /** Kept in memory for preview/upload; not serialized to sessionStorage. */
  file: File;
};

/** KB document after local parse (.txt / .xlsx). */
export type StagedKbDocument = StagedNodeFile & {
  parseStatus: KbParseStatus;
  parseError?: string;
  format?: 'txt' | 'xlsx';
  variables: readonly KbExtractedVariable[];
  variableDictionary: Readonly<Record<string, string>>;
  /** Designer natural-language notes (How to use). */
  howToUseText: string;
  /** LLM-generated Markdown snippet for this document. */
  markdownSnippet: string;
};

/** Serializable KB row (no File) for workspace sessionStorage. */
export type PersistedKbDocument = Omit<StagedKbDocument, 'file'>;

export function stagedNodeFilesKey(
  agentId: string,
  nodeId: string,
  kind: StagedNodeFileKind
): string {
  return `${agentId.trim()}\x1e${nodeId.trim()}\x1e${kind}`;
}

export function filesToStaged(files: readonly File[]): StagedNodeFile[] {
  const now = new Date().toISOString();
  return files.map((file) => ({
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${file.name}`,
    name: file.name,
    size: file.size,
    mimeType: file.type || 'application/octet-stream',
    addedAt: now,
    file,
  }));
}

export function formatStagedFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** KB upload: tabular .txt and Excel .xlsx (parsed for variables); other types staged only. */
export const KB_DOCUMENT_ACCEPT =
  '.txt,.xlsx,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Tool / webhook definition files. */
export const TOOL_FILE_ACCEPT =
  '.json,.yaml,.yml,.openapi,.txt,application/json,text/yaml,text/plain';
