/**
 * Strumenti tab for a ConvAI workflow node: mirror remote tools + workspace webhook draft (catalogo).
 */

import React from 'react';
import type {
  WorkspaceAgentToolInventory,
  WorkspaceNodeTools,
  WorkspaceWorkflowNode,
} from '@workspaces/core/types';
import type { ProjectData } from '@types/project';
import type { StagedNodeFile } from '@workspaces/elevenlabs/elevenLabsStagedNodeFiles';
import { TOOL_FILE_ACCEPT } from '@workspaces/elevenlabs/elevenLabsStagedNodeFiles';
import { ElevenLabsReadOnlyToggle } from './ElevenLabsReadOnlyToggle';
import { ElevenLabsToolListRow } from './ElevenLabsToolListRow';
import { ElevenLabsWorkspaceWebhookSection } from './ElevenLabsWorkspaceWebhookSection';
import {
  ElevenLabsFileDropZone,
  StagedFileListRow,
  type ElevenLabsFileDropZoneHandle,
} from './ElevenLabsFileDropZone';
import { FileCode2, Pencil } from 'lucide-react';

const DEFAULT_TOOLS: WorkspaceNodeTools = {
  inheritsAgentTools: true,
  builtInTools: [],
  additionalTools: [],
};

export type ElevenLabsNodeToolsPanelProps = {
  node: WorkspaceWorkflowNode;
  toolInventory: WorkspaceAgentToolInventory;
  agentId: string;
  projectData?: ProjectData | null;
  projectId?: string;
  updateProjectData?: (data: ProjectData) => void;
  onOpenAgentTab?: () => void;
  stagedToolFiles?: readonly StagedNodeFile[];
  onAddToolFiles?: (files: File[]) => void;
  onRemoveStagedToolFile?: (fileId: string) => void;
};

export function ElevenLabsNodeToolsPanel({
  node,
  toolInventory,
  agentId,
  projectData,
  projectId,
  updateProjectData,
  onOpenAgentTab,
  stagedToolFiles = [],
  onAddToolFiles,
  onRemoveStagedToolFile,
}: ElevenLabsNodeToolsPanelProps): React.ReactElement {
  const tools = node.tools ?? DEFAULT_TOOLS;
  const inheritedTools = tools.inheritsAgentTools ? toolInventory.agentTools : [];
  const localTools = toolInventory.allTools.filter(
    (t) => t.scope === 'node' && t.nodeId === node.id
  );
  const dropRef = React.useRef<ElevenLabsFileDropZoneHandle>(null);
  const canStage = Boolean(onAddToolFiles);

  if (node.kind !== 'subagent' && node.kind !== 'tool') {
    return (
      <p className="text-xs text-slate-500">
        Gli strumenti per nodo si configurano sui subagent del workflow.
      </p>
    );
  }

  const hasAdditional = localTools.length > 0 || stagedToolFiles.length > 0;

  return (
    <div className="space-y-1">
      {tools.builtInTools.length > 0 ? (
        <section className="border-b border-slate-800/80 pb-2">
          <h4 className="py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Strumenti integrati
          </h4>
          <ul className="space-y-0.5">
            {tools.builtInTools.map((t) => (
              <li
                key={t.id}
                className={
                  'flex items-center gap-2 rounded px-1 py-1.5 text-sm ' +
                  (t.enabled ? 'text-slate-200' : 'text-slate-500 line-through')
                }
              >
                <Pencil className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden />
                <span className="min-w-0 truncate">{t.label}</span>
                {!t.enabled ? (
                  <span className="ml-auto text-[10px] text-slate-600">disattivo</span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="py-2 text-xs text-slate-500">
          Nessuno strumento di sistema nel payload del nodo (possono essere ereditati dall&apos;agente).
        </p>
      )}

      <ElevenLabsReadOnlyToggle
        label="Eredita strumenti"
        checked={tools.inheritsAgentTools}
        hint="Include i tool webhook/client definiti sull'agente principale."
      />

      {tools.inheritsAgentTools ? (
        <section className="border-b border-slate-800/80 pb-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Tool ereditati dall&apos;agente ({inheritedTools.length})
            </h4>
            {onOpenAgentTab ? (
              <button
                type="button"
                onClick={onOpenAgentTab}
                className="text-[10px] font-medium text-violet-400 hover:text-violet-300"
              >
                Tab Agente →
              </button>
            ) : null}
          </div>
          {inheritedTools.length > 0 ? (
            <ul className="space-y-1.5">
              {inheritedTools.map((t) => (
                <ElevenLabsToolListRow key={`inh-${t.id}`} tool={t} inherited />
              ))}
            </ul>
          ) : (
            <p className="text-xs text-slate-500">
              Nessun tool webhook/client sull&apos;agente principale.
            </p>
          )}
        </section>
      ) : null}

      <section className="border-b border-slate-800/80 pb-3">
        <div className="flex items-center justify-between gap-3 py-2">
          <p className="text-sm text-slate-200">Webhook (workspace)</p>
        </div>
        <ElevenLabsWorkspaceWebhookSection
          projectData={projectData}
          projectId={projectId}
          updateDataDirectly={updateProjectData}
          catalogScope={{ scope: 'node', nodeId: node.id, agentId }}
          alignDropdownEnd
        />
      </section>

      <section className="flex items-center justify-between gap-3 py-2">
        <p className="text-sm text-slate-200">Definizione file (opzionale)</p>
        <button
          type="button"
          disabled={!canStage}
          onClick={(e) => {
            e.stopPropagation();
            dropRef.current?.openPicker();
          }}
          className={
            'shrink-0 rounded-md border px-3 py-1 text-xs font-medium text-slate-400 transition-colors ' +
            (canStage
              ? 'border-slate-600 hover:border-slate-500 hover:bg-slate-900/50'
              : 'border-slate-700 opacity-50')
          }
        >
          Carica file
        </button>
      </section>

      <ElevenLabsFileDropZone
        ref={dropRef}
        accept={TOOL_FILE_ACCEPT}
        disabled={!canStage}
        onFiles={(files) => onAddToolFiles?.(files)}
        emptyHint="Trascina JSON, YAML o OpenAPI qui oppure clicca per selezionare"
        className="pb-2"
      >
        {hasAdditional ? (
          <ul className="space-y-1.5" onClick={(e) => e.stopPropagation()}>
            {localTools.map((t) => (
              <ElevenLabsToolListRow key={`loc-${t.id}`} tool={t} />
            ))}
            {stagedToolFiles.map((f) => (
              <StagedFileListRow
                key={f.id}
                name={f.name}
                size={f.size}
                badge="ConvAI remoto"
                icon={<FileCode2 className="h-3.5 w-3.5 text-teal-400" aria-hidden />}
                onRemove={
                  onRemoveStagedToolFile ? () => onRemoveStagedToolFile(f.id) : undefined
                }
              />
            ))}
          </ul>
        ) : (
          <p className="py-4 text-center text-xs text-slate-500">
            Nessun tool aggiuntivo risolto da ConvAI su questo nodo.
          </p>
        )}
      </ElevenLabsFileDropZone>

      <p className="border-t border-slate-800 pt-2 text-[11px] text-slate-500">
        I webhook workspace sono salvati nel catalogo backend del progetto (stesso modello dell&apos;editor
        Agente AI). La sync verso ElevenLabs arriverà in un passo successivo.
      </p>
    </div>
  );
}
