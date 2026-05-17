/**
 * Knowledge Base tab for a ConvAI workflow node: mirror remote docs + local KB parse (.txt / .xlsx).
 */

import React from 'react';
import type { WorkspaceNodeKnowledgeBase, WorkspaceWorkflowNode } from '@workspaces/core/types';
import type { StagedKbDocument } from '@workspaces/elevenlabs/elevenLabsStagedNodeFiles';
import { KB_DOCUMENT_ACCEPT } from '@workspaces/elevenlabs/elevenLabsStagedNodeFiles';
import { ElevenLabsReadOnlyToggle } from './ElevenLabsReadOnlyToggle';
import { ElevenLabsFileDropZone, type ElevenLabsFileDropZoneHandle } from './ElevenLabsFileDropZone';
import { KbStagedDocumentCard } from './KbStagedDocumentCard';
import { FileText } from 'lucide-react';

const DEFAULT_KB: WorkspaceNodeKnowledgeBase = {
  inheritsAgentKnowledgeBase: true,
  additionalDocuments: [],
};

export type ElevenLabsNodeKnowledgeBasePanelProps = {
  node: WorkspaceWorkflowNode;
  stagedKbDocuments?: readonly StagedKbDocument[];
  onAddKbFiles?: (files: File[]) => void;
  onRemoveStagedKbFile?: (fileId: string) => void;
  onUpdateKbDoc?: (
    docId: string,
    patch: Partial<Pick<StagedKbDocument, 'howToUseText' | 'markdownSnippet'>>
  ) => void;
};

export function ElevenLabsNodeKnowledgeBasePanel({
  node,
  stagedKbDocuments = [],
  onAddKbFiles,
  onRemoveStagedKbFile,
  onUpdateKbDoc,
}: ElevenLabsNodeKnowledgeBasePanelProps): React.ReactElement {
  const kb = node.knowledgeBase ?? DEFAULT_KB;
  const dropRef = React.useRef<ElevenLabsFileDropZoneHandle>(null);
  const canStage = Boolean(onAddKbFiles);

  if (node.kind !== 'subagent' && node.kind !== 'tool') {
    return (
      <p className="text-xs text-slate-500">
        Knowledge Base per nodo si applica ai subagent del workflow.
      </p>
    );
  }

  const remoteCount = kb.additionalDocuments.length;
  const stagedCount = stagedKbDocuments.length;
  const hasAny = remoteCount + stagedCount > 0;

  return (
    <div className="space-y-1">
      <ElevenLabsReadOnlyToggle
        label="Eredita base di conoscenza"
        checked={kb.inheritsAgentKnowledgeBase}
        hint="Include i documenti KB configurati sull'agente principale."
      />
      <section className="flex items-center justify-between gap-3 py-3">
        <p className="text-sm text-slate-200">Base di conoscenza aggiuntiva</p>
        <button
          type="button"
          disabled={!canStage}
          onClick={(e) => {
            e.stopPropagation();
            dropRef.current?.openPicker();
          }}
          className={
            'shrink-0 rounded-md border px-3 py-1 text-xs font-medium transition-colors ' +
            (canStage
              ? 'border-violet-600/70 text-violet-200 hover:border-violet-500 hover:bg-violet-950/40'
              : 'border-slate-600 text-slate-400 opacity-60')
          }
        >
          Aggiungi documento
        </button>
      </section>

      <ElevenLabsFileDropZone
        ref={dropRef}
        accept={KB_DOCUMENT_ACCEPT}
        disabled={!canStage}
        onFiles={(files) => onAddKbFiles?.(files)}
        emptyHint="Trascina .txt o .xlsx qui: le colonne diventano variabili cliccabili (es. serviceId)"
        className="pb-2"
      >
        {hasAny ? (
          <ul className="space-y-1.5" onClick={(e) => e.stopPropagation()}>
            {kb.additionalDocuments.map((doc) => (
              <li
                key={doc.id}
                className="flex items-start gap-2 rounded-md border border-slate-700/60 bg-slate-900/50 px-2.5 py-2 text-xs text-slate-300"
              >
                <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-400" aria-hidden />
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="block truncate font-medium">{doc.name}</span>
                    <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">
                      ElevenLabs
                    </span>
                  </span>
                  <span className="font-mono text-[10px] text-slate-500">{doc.id}</span>
                </span>
              </li>
            ))}
            {stagedKbDocuments.map((doc) => (
              <KbStagedDocumentCard
                key={doc.id}
                doc={doc}
                onRemove={onRemoveStagedKbFile ? () => onRemoveStagedKbFile(doc.id) : undefined}
                onUpdateDoc={
                  onUpdateKbDoc
                    ? (patch) => onUpdateKbDoc(doc.id, patch)
                    : () => undefined
                }
              />
            ))}
          </ul>
        ) : (
          <p className="py-4 text-center text-xs text-slate-500">
            Nessun documento aggiuntivo su questo nodo.
          </p>
        )}
      </ElevenLabsFileDropZone>

      <p className="border-t border-slate-800 pt-2 text-[11px] text-slate-500">
        Colonne → variabili {'{{…}}'}. How to use + Analyze generano uno snippet Markdown locale.
        Il prompt agente (tab Agente) può aggregare tutti gli snippet KB.
      </p>
    </div>
  );
}
