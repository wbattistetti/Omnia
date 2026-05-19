/**
 * Read-only document viewer for KB files (repository text or loading state).
 */

import React from 'react';
import { Loader2 } from 'lucide-react';
import { KbMarkdownMonaco } from '@components/workspaces/elevenlabs/kb/KbMarkdownMonaco';
import type { KbFileFormat } from '@domain/knowledgeBase/kbFileKinds';
import { isKbBinaryViewerFormat } from '@domain/knowledgeBase/kbFileKinds';
import {
  isKbTabularPreviewName,
  parseKbTabularDocument,
} from '@domain/knowledgeBase/parseKbTabularText';
import { kbDocumentFileUrl } from '@services/kbDocumentRepositoryApi';
import { KbTabularPreview } from './KbTabularPreview';
import { KbPdfViewer } from './viewers/KbPdfViewer';
import { KbWordViewer } from './viewers/KbWordViewer';
import { KbImageViewer } from './viewers/KbImageViewer';
import { OMNIA_KB_MD_LANG } from './kbMarkdownLanguage';
import { kbType } from './kbTypography';

export type KnowledgeBaseDocumentReaderProps = {
  documentName: string;
  format?: KbFileFormat;
  projectId?: string;
  repositoryDocumentId?: string;
  /** Parsed column headers from ingest (improves table detection). */
  knownColumnHeaders?: readonly string[];
  text: string;
  loading?: boolean;
  error?: string | null;
  truncated?: boolean;
  totalChars?: number;
  imageDocIds?: readonly string[];
  currentDocId?: string;
  onSelectImageId?: (docId: string) => void;
  className?: string;
};

function formatReaderText(documentName: string, text: string, format?: KbFileFormat): string {
  const lower = documentName.toLowerCase();
  const isJson = format === 'json' || lower.endsWith('.json');
  if (!isJson) return text;
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}

function shouldTryTabularParse(documentName: string, format?: KbFileFormat): boolean {
  if (format === 'xlsx' || format === 'csv' || format === 'md') return true;
  if (format === 'txt') return true;
  return isKbTabularPreviewName(documentName);
}

export function KnowledgeBaseDocumentReader({
  documentName,
  format,
  projectId,
  repositoryDocumentId,
  knownColumnHeaders,
  text,
  loading = false,
  error = null,
  truncated = false,
  totalChars = 0,
  imageDocIds = [],
  currentDocId = '',
  onSelectImageId,
  className = '',
}: KnowledgeBaseDocumentReaderProps): React.ReactElement {
  const isMd = documentName.toLowerCase().endsWith('.md');
  const fileUrl = React.useMemo(() => {
    const pid = projectId?.trim();
    const rid = repositoryDocumentId?.trim();
    if (!pid || !rid) return null;
    return kbDocumentFileUrl(pid, rid);
  }, [projectId, repositoryDocumentId]);

  const displayText = React.useMemo(
    () => formatReaderText(documentName, text, format),
    [documentName, text, format]
  );

  const tabular = React.useMemo(() => {
    if (isKbBinaryViewerFormat(format)) return null;
    if (!text.trim() || !shouldTryTabularParse(documentName, format)) return null;
    return parseKbTabularDocument(text, { knownColumnHeaders });
  }, [text, documentName, format, knownColumnHeaders]);

  const body = (() => {
    if (loading) {
      return (
        <div className="flex h-full min-h-[120px] items-center justify-center gap-2 text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Caricamento…
        </div>
      );
    }
    if (error) {
      return <p className="p-2 text-rose-300">{error}</p>;
    }
    if (format === 'pdf') {
      if (fileUrl) return <KbPdfViewer fileUrl={fileUrl} className="min-h-0 flex-1" />;
      return <p className="p-2 text-slate-500">PDF in attesa di salvataggio nel repository…</p>;
    }
    if (format === 'docx') {
      if (fileUrl) return <KbWordViewer fileUrl={fileUrl} className="min-h-0 flex-1" />;
      return <p className="p-2 text-slate-500">Documento Word in attesa di salvataggio…</p>;
    }
    if (format === 'image') {
      if (fileUrl) {
        return (
          <KbImageViewer
            fileUrl={fileUrl}
            documentName={documentName}
            imageIds={imageDocIds}
            currentId={currentDocId}
            onSelectId={(id) => onSelectImageId?.(id)}
          />
        );
      }
      return <p className="p-2 text-slate-500">Immagine in attesa di salvataggio nel repository…</p>;
    }
    if (!text.trim() && !isKbBinaryViewerFormat(format)) {
      return <p className="p-2 text-slate-500">Nessun contenuto testuale disponibile.</p>;
    }
    if (tabular) {
      return (
        <KbTabularPreview
          grid={tabular.grid}
          preamble={tabular.preamble}
          className="min-h-0 flex-1 border-0"
        />
      );
    }
    return (
      <KbMarkdownMonaco
        appearance="plain"
        language={isMd ? OMNIA_KB_MD_LANG : format === 'json' ? 'json' : 'plaintext'}
        value={displayText}
        readOnly
        fillHeight
        ariaLabel={`Contenuto ${documentName}`}
      />
    );
  })();

  return (
    <div className={'flex min-h-0 flex-1 flex-col rounded-md border border-slate-800 bg-slate-950/60 ' + className}>
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-800 px-2 py-1">
        <span className={kbType.label}>Reader</span>
        {truncated ? (
          <span className={kbType.warn} title="Anteprima troncata per analisi IA">
            Anteprima {text.length.toLocaleString()}
            {totalChars > 0 ? ` / ${totalChars.toLocaleString()} car.` : ''}
          </span>
        ) : null}
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-1">{body}</div>
    </div>
  );
}
