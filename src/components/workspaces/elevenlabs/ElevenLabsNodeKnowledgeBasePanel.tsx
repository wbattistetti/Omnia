/**
 * Knowledge Base tab for a ConvAI workflow node: mirror remote docs + local KB workspace.
 */

import React from 'react';
import type { WorkspaceNodeKnowledgeBase, WorkspaceWorkflowNode } from '@workspaces/core/types';
import type { KbDocumentPatch, StagedKbDocument } from '@domain/knowledgeBase/kbDocumentTypes';
import type { AiCallMeta } from '@services/aiAgentDesignApi';
import { ElevenLabsReadOnlyToggle } from './ElevenLabsReadOnlyToggle';
import { KnowledgeBaseViewer } from '@components/knowledgeBase/KnowledgeBaseViewer';
import { FileText } from 'lucide-react';

const DEFAULT_KB: WorkspaceNodeKnowledgeBase = {
  inheritsAgentKnowledgeBase: true,
  additionalDocuments: [],
};

export type ElevenLabsNodeKnowledgeBasePanelProps = {
  node: WorkspaceWorkflowNode;
  projectId?: string;
  kbCallMeta?: AiCallMeta;
  stagedKbDocuments?: readonly StagedKbDocument[];
  onAddKbFiles?: (files: File[]) => void;
  onRemoveStagedKbFile?: (fileId: string) => void;
  onUpdateKbDoc?: (docId: string, patch: KbDocumentPatch) => void;
};

export function ElevenLabsNodeKnowledgeBasePanel({
  node,
  projectId,
  kbCallMeta,
  stagedKbDocuments = [],
  onAddKbFiles,
  onRemoveStagedKbFile,
  onUpdateKbDoc,
}: ElevenLabsNodeKnowledgeBasePanelProps): React.ReactElement {
  const kb = node.knowledgeBase ?? DEFAULT_KB;
  const canStage = Boolean(onAddKbFiles && onUpdateKbDoc);

  if (node.kind !== 'subagent' && node.kind !== 'tool') {
    return (
      <p className="text-xs text-slate-500">
        Knowledge Base per nodo si applica ai subagent del workflow.
      </p>
    );
  }

  const remoteCount = kb.additionalDocuments.length;

  return (
    <div className="space-y-1">
      <ElevenLabsReadOnlyToggle
        label="Eredita base di conoscenza"
        checked={kb.inheritsAgentKnowledgeBase}
        hint="Include i documenti KB configurati sull'agente principale."
      />
      {remoteCount > 0 ? (
        <section className="space-y-1.5 py-2">
          <p className="text-[11px] font-medium text-slate-400">Documenti ElevenLabs (sola lettura)</p>
          <ul className="space-y-1.5">
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
          </ul>
        </section>
      ) : null}

      <KnowledgeBaseViewer
        documents={stagedKbDocuments}
        projectId={projectId}
        callMeta={kbCallMeta}
        disabled={!canStage}
        onAddFiles={(files) => onAddKbFiles?.(files)}
        onRemoveDocument={onRemoveStagedKbFile}
        onUpdateDocument={(docId, patch) => onUpdateKbDoc?.(docId, patch)}
        footerHint="Documenti locali al workspace ElevenLabs; file nel repository progetto, regole in sessione."
      />
    </div>
  );
}
