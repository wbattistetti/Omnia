/**
 * Shared KB upload + tabular parse for task editor and ElevenLabs workspace hooks.
 */

import { isKbTxtFile, isKbXlsxFile, parseKbFile } from '@workspaces/elevenlabs/parseKbDocument';
import { uploadKbDocumentToProject, deleteKbDocumentFromProject } from '@services/kbDocumentRepositoryApi';
import { buildKbTextPreview, fileToBase64 } from './kbTextPreview';
import {
  detectKbFileFormat,
  emptyKbDocument,
  filesToKbStaged,
  isKbParsableTabular,
  type KbStagedFileBase,
  type StagedKbDocument,
} from './kbDocumentTypes';

export type KbDocumentListUpdater = (
  updater: (prev: StagedKbDocument[]) => StagedKbDocument[]
) => void;

/** Stage new files locally (parse status + format). */
export function stageKbFilesFromUpload(files: readonly File[]): StagedKbDocument[] {
  const bases = filesToKbStaged(files);
  return bases.map((base) => {
    const format = detectKbFileFormat(base.file);
    const tabular = isKbParsableTabular(base.file);
    return emptyKbDocument(base, tabular ? 'parsing' : 'ready', format);
  });
}

/** Upload bytes to project repository; patches `repositoryDocumentId` or parse error. */
export async function ingestKbFileToRepository(
  projectId: string | undefined,
  docId: string,
  file: File,
  setDocuments: KbDocumentListUpdater
): Promise<void> {
  const pid = String(projectId || '').trim();
  if (!pid) {
    setDocuments((prev) =>
      prev.map((d) =>
        d.id === docId
          ? {
              ...d,
              parseStatus: 'error' as const,
              parseError: 'projectId mancante: impossibile salvare nel repository.',
            }
          : d
      )
    );
    return;
  }
  try {
    const [contentBase64, textPreview] = await Promise.all([
      fileToBase64(file),
      buildKbTextPreview(file),
    ]);
    const meta = await uploadKbDocumentToProject(pid, {
      name: file.name,
      mimeType: file.type || 'application/octet-stream',
      contentBase64,
      textPreview,
      documentId: docId,
    });
    setDocuments((prev) =>
      prev.map((d) =>
        d.id === docId
          ? {
              ...d,
              repositoryDocumentId: meta.id,
              parseStatus: d.parseStatus === 'parsing' ? ('ready' as const) : d.parseStatus,
              parseError: d.parseStatus === 'error' ? d.parseError : undefined,
            }
          : d
      )
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    setDocuments((prev) =>
      prev.map((d) =>
        d.id === docId ? { ...d, parseStatus: 'error' as const, parseError: message } : d
      )
    );
  }
}

/** Deterministic column extraction for .txt / .xlsx. */
export async function ingestKbTabularParse(
  docId: string,
  file: File,
  setDocuments: KbDocumentListUpdater
): Promise<void> {
  try {
    const result = await parseKbFile(file);
    setDocuments((prev) =>
      prev.map((d) =>
        d.id === docId
          ? {
              ...d,
              parseStatus: d.parseStatus === 'error' ? ('error' as const) : ('ready' as const),
              format: result.format,
              variables: result.variables,
              variableDictionary: result.variableDictionary,
              parseError: d.parseStatus === 'error' ? d.parseError : undefined,
            }
          : d
      )
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    setDocuments((prev) =>
      prev.map((d) =>
        d.id === docId
          ? {
              ...d,
              parseStatus: d.parseStatus === 'error' ? ('error' as const) : ('ready' as const),
              format: detectKbFileFormat(file),
              parseError: d.parseError ?? message,
              variables: [],
              variableDictionary: {},
            }
          : d
      )
    );
  }
}

/** Run repository upload + optional tabular parse for one staged document. */
export function runKbDocumentIngest(
  projectId: string | undefined,
  doc: StagedKbDocument,
  setDocuments: KbDocumentListUpdater
): void {
  if (isKbTxtFile(doc.file) || isKbXlsxFile(doc.file)) {
    void ingestKbTabularParse(doc.id, doc.file, setDocuments);
  }
  void ingestKbFileToRepository(projectId, doc.id, doc.file, setDocuments);
}

/** Delete repository blob when present. */
export function deleteKbRepositoryBlob(
  projectId: string | undefined,
  repositoryDocumentId: string | undefined
): void {
  const pid = String(projectId || '').trim();
  const rid = repositoryDocumentId?.trim();
  if (pid && rid) {
    void deleteKbDocumentFromProject(pid, rid);
  }
}

export type { KbStagedFileBase };
