/**
 * Local file staging for ElevenLabs workspace node panels (KB / tools) before remote upload.
 */

export type {
  KbParseStatus,
  PersistedKbDocument,
  StagedKbDocument,
} from '@domain/knowledgeBase/kbDocumentTypes';

export {
  emptyKbDocument as emptyKbDoc,
  filesToKbStaged as filesToStaged,
  formatKbFileSize as formatStagedFileSize,
  KB_DOCUMENT_ACCEPT,
  persistedKbToStaged as persistedToStaged,
  stagedKbToPersisted as stagedToPersisted,
} from '@domain/knowledgeBase/kbDocumentTypes';

export type StagedNodeFileKind = 'kb' | 'tools';

export type StagedNodeFile = {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  addedAt: string;
  file: File;
};

export function stagedNodeFilesKey(
  agentId: string,
  nodeId: string,
  kind: StagedNodeFileKind
): string {
  return `${agentId.trim()}\x1e${nodeId.trim()}\x1e${kind}`;
}

/** Tool / webhook definition files. */
export const TOOL_FILE_ACCEPT =
  '.json,.yaml,.yml,.openapi,.txt,application/json,text/yaml,text/plain';
