/**

 * Center column: document title, reader (full text / binary / image).

 */



import React from 'react';

import type { StagedKbDocument, KbDocumentPatch } from '@domain/knowledgeBase/kbDocumentTypes';

import { useKbDocumentContent } from './useKbDocumentContent';

import { KnowledgeBaseDocumentReader } from './KnowledgeBaseDocumentReader';

import { KbFormatIcon } from '@domain/knowledgeBase/kbFileKindIcons';
import { kbType } from './kbTypography';
import { Loader2 } from 'lucide-react';



export type KnowledgeBaseDocumentDetailProps = {

  doc: StagedKbDocument;

  projectId?: string;

  disabled?: boolean;
  imageDocIds: readonly string[];

  onSelectDocumentId: (docId: string) => void;

  onUpdateDoc: (patch: KbDocumentPatch) => void;

};



export function KnowledgeBaseDocumentDetail({

  doc,

  projectId,

  disabled = false,
  imageDocIds,

  onSelectDocumentId,

}: KnowledgeBaseDocumentDetailProps): React.ReactElement {

  const repoId = doc.id?.trim() || doc.repositoryDocumentId?.trim();

  const content = useKbDocumentContent(projectId, repoId);



  const [chipCopied, setChipCopied] = React.useState<string | null>(null);



  const handleChipClick = React.useCallback(async (placeholder: string) => {

    try {

      if (typeof navigator !== 'undefined' && navigator.clipboard) {

        await navigator.clipboard.writeText(placeholder);

        setChipCopied(placeholder);

        window.setTimeout(() => setChipCopied(null), 1400);

      }

    } catch {

      setChipCopied(null);

    }

  }, []);



  return (

    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">

      <div className="shrink-0 space-y-2 border-b border-slate-800 px-3 py-2">

        <div className="flex min-w-0 items-start gap-2">

          <KbFormatIcon format={doc.format} fileName={doc.name} mimeType={doc.mimeType} className="mt-0.5 h-5 w-5 shrink-0" />

          <h3 className={'min-w-0 flex-1 ' + kbType.title} title={doc.name}>
            {doc.name}
          </h3>
        </div>

        {doc.parseStatus === 'parsing' ? (
          <p className={'flex items-center gap-2 ' + kbType.status}>
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
            Caricamento repository…
          </p>
        ) : null}
        {!repoId && doc.parseStatus !== 'parsing' && doc.parseStatus !== 'error' ? (
          <p className={kbType.warn}>Salvataggio repository in corso…</p>
        ) : null}
        {doc.analysisNote ? <p className={kbType.muted}>{doc.analysisNote}</p> : null}

        {doc.variables.length > 0 ? (

          <div className="flex flex-wrap gap-1.5">

            {doc.variables.map((v) => (

              <button

                key={`${v.internalName}-${v.sourceColumn}`}

                type="button"

                title={`Colonna «${v.sourceColumn}»`}

                onClick={() => void handleChipClick(v.placeholder)}

                className={

                  'rounded-full px-2 py-0.5 text-inherit font-medium ' +

                  (chipCopied === v.placeholder

                    ? 'bg-sky-200 text-sky-950'

                    : 'bg-sky-300/90 text-sky-950 hover:bg-sky-200')

                }

              >

                {v.internalName}

              </button>

            ))}

          </div>

        ) : null}

      </div>

      <KnowledgeBaseDocumentReader

        key={doc.id}

        documentName={doc.name}

        format={doc.format}

        projectId={projectId}

        repositoryDocumentId={repoId}

        knownColumnHeaders={doc.variables.map((v) => v.sourceColumn)}

        text={content.text}

        loading={content.loading}

        error={content.error}

        truncated={content.truncated}

        totalChars={content.totalChars}

        imageDocIds={imageDocIds}

        currentDocId={doc.id}

        onSelectImageId={onSelectDocumentId}

        className="min-h-0 flex-1 border-0 bg-transparent"

      />

    </div>

  );

}

