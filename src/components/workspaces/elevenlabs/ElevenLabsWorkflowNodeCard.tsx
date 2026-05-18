/**
 * React Flow node card styled like ElevenLabs ConvAI workflow nodes (read-only).
 */

import React, { useState } from 'react';
import { Handle, NodeToolbar, Position, type NodeProps } from 'reactflow';
import type { ElWorkflowNodeData } from '@workspaces/elevenlabs/convaiWorkflowToReactFlow';
import { truncateAgentLabel } from '@workspaces/elevenlabs/workflowCanvasLocalPatch';
import {
  Anchor,
  Bot,
  CircleDot,
  Copy,
  Flag,
  GripVertical,
  Sparkles,
  Trash2,
  Wrench,
} from 'lucide-react';
import { EL_RIGID_ANCHOR_CLASS } from './useElWorkflowRigidDrag';

function kindIcon(kind: string): React.ReactElement {
  if (kind === 'start') return <Flag className="h-4 w-4 shrink-0 text-emerald-400" aria-hidden />;
  if (kind === 'tool') return <Wrench className="h-4 w-4 shrink-0 text-amber-400" aria-hidden />;
  if (kind === 'subagent') return <Bot className="h-4 w-4 shrink-0 text-violet-400" aria-hidden />;
  return <CircleDot className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />;
}

function kindTitle(kind: string): string {
  if (kind === 'start') return 'Inizia';
  if (kind === 'end') return 'Fine';
  if (kind === 'subagent') return 'Subagent';
  if (kind === 'tool') return 'Tool';
  return kind;
}

function RigidSubtreeAnchor(): React.ReactElement {
  return (
    <button
      type="button"
      title="Trascina nodo e ramo discendente"
      aria-label="Trascina nodo e ramo discendente"
      className={
        `${EL_RIGID_ANCHOR_CLASS} cursor-grab rounded-md border border-amber-600/70 ` +
        'bg-amber-950/90 p-1 text-amber-200 shadow active:cursor-grabbing'
      }
    >
      <Anchor className="h-3.5 w-3.5" aria-hidden />
    </button>
  );
}

function OmniaFlowDragHandle({
  label,
  onDragStart,
}: {
  label: string;
  onDragStart: (dataTransfer: DataTransfer) => void;
}): React.ReactElement {
  const handleDragStart = (e: React.DragEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    const dt = e.dataTransfer;
    if (!dt) return;
    const ghost = document.createElement('div');
    ghost.textContent = label.trim() || 'Nodo ElevenLabs';
    ghost.style.cssText =
      'position:fixed;left:-9999px;top:0;padding:6px 10px;border-radius:6px;' +
      'background:#4c1d95;color:#f5f3ff;font:600 12px system-ui,sans-serif;pointer-events:none;';
    document.body.appendChild(ghost);
    dt.setDragImage(ghost, 12, 14);
    window.setTimeout(() => ghost.remove(), 0);
    onDragStart(dt);
  };

  return (
    <button
      type="button"
      draggable
      title="Trascina sul canvas Omnia"
      aria-label={`Trascina «${label}» sul canvas Omnia`}
      className="nodrag nopan cursor-grab rounded-md border border-violet-600/70 bg-violet-950 p-1 text-violet-200 shadow active:cursor-grabbing"
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onDragStart={handleDragStart}
    >
      <GripVertical className="h-3.5 w-3.5" aria-hidden />
    </button>
  );
}

function PromptTooltipIcon({ text }: { text: string }): React.ReactElement | null {
  const [open, setOpen] = useState(false);
  if (!text.trim()) return null;

  return (
    <span
      className="relative nodrag nopan"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className="rounded-md border border-slate-600/80 bg-slate-800/90 p-1 text-violet-300 hover:text-violet-100"
        aria-label="Mostra system prompt"
        onClick={(e) => e.stopPropagation()}
      >
        <Sparkles className="h-3.5 w-3.5" aria-hidden />
      </button>
      {open ? (
        <div
          role="tooltip"
          className={
            'absolute right-0 top-full z-50 mt-1 max-h-48 w-64 overflow-y-auto ' +
            'rounded-md border border-slate-600 bg-slate-950 px-2.5 py-2 text-left text-[11px] ' +
            'leading-snug text-slate-200 shadow-xl'
          }
          onClick={(e) => e.stopPropagation()}
        >
          {text}
        </div>
      ) : null}
    </span>
  );
}

function NodeSideToolbar({
  nodeId,
  onCopy,
  onDelete,
}: {
  nodeId: string;
  onCopy?: (id: string) => void;
  onDelete?: (id: string) => void;
}): React.ReactElement | null {
  if (!onCopy && !onDelete) return null;

  return (
    <NodeToolbar
      isVisible
      position={Position.Right}
      offset={10}
      className="!border-0 !bg-transparent !p-0 !shadow-none"
    >
      <div
        className="nodrag nopan flex flex-col gap-1 rounded-lg border border-amber-800/50 bg-slate-950/95 p-1 shadow-lg"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {onCopy ? (
          <button
            type="button"
            title="Copia nodo"
            aria-label="Copia nodo"
            className="rounded p-1.5 text-amber-200/90 hover:bg-amber-950/80 hover:text-amber-50"
            onClick={(e) => {
              e.stopPropagation();
              onCopy(nodeId);
            }}
          >
            <Copy className="h-4 w-4" aria-hidden />
          </button>
        ) : null}
        {onDelete ? (
          <button
            type="button"
            title="Rimuovi dal canvas"
            aria-label="Rimuovi dal canvas"
            className="rounded p-1.5 text-amber-200/90 hover:bg-rose-950/80 hover:text-rose-200"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(nodeId);
            }}
          >
            <Trash2 className="h-4 w-4" aria-hidden />
          </button>
        ) : null}
      </div>
    </NodeToolbar>
  );
}

export function ElevenLabsWorkflowNodeCard({
  id,
  data,
  selected,
  sourcePosition: sourcePositionProp,
  targetPosition: targetPositionProp,
}: NodeProps<ElWorkflowNodeData>): React.ReactElement {
  const [hovered, setHovered] = useState(false);
  const isStart = data.kind === 'start';
  const isEnd = data.kind === 'end';
  const isSubagent = data.kind === 'subagent';
  const canOmnia = data.kind === 'subagent' || data.kind === 'tool';
  const showSideToolbar = hovered && (data.onCopyNode || data.onDeleteNode);
  const targetHandle = data.targetHandlePosition ?? targetPositionProp ?? Position.Left;
  const sourceHandle = data.sourceHandlePosition ?? sourcePositionProp ?? Position.Right;
  const displayTitle = isSubagent ? truncateAgentLabel(data.label) : data.label;
  const promptTooltip =
    data.promptTooltip?.trim() ||
    (data.inheritsGlobalPrompt ? 'SYSTEM PROMPT (ereditato dall’agente)' : data.promptPreview) ||
    '';

  return (
    <>
      {showSideToolbar ? (
        <NodeSideToolbar nodeId={id} onCopy={data.onCopyNode} onDelete={data.onDeleteNode} />
      ) : null}
      <div
        className={
          'group relative min-w-[220px] max-w-[340px] rounded-lg border px-3 py-2.5 shadow-lg ' +
          (selected
            ? 'border-violet-400/80 bg-slate-900 ring-2 ring-violet-500/50'
            : isStart
              ? 'border-emerald-700/60 bg-emerald-950/40'
              : 'border-slate-600/80 bg-slate-900/95')
        }
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {!isStart ? (
          <Handle
            type="target"
            position={targetHandle}
            className="!h-2 !w-2 !border-amber-700/80 !bg-amber-900/90"
          />
        ) : null}
        <div
          className={
            'absolute -right-1 -top-1 z-10 flex items-center gap-0.5 ' +
            (hovered ? 'opacity-100' : 'opacity-0') +
            ' transition-opacity'
          }
        >
          {isSubagent ? <PromptTooltipIcon text={promptTooltip} /> : null}
          <RigidSubtreeAnchor />
          {canOmnia && data.onDragToOmniaFlow ? (
            <OmniaFlowDragHandle
              label={data.label}
              onDragStart={(dataTransfer) => data.onDragToOmniaFlow?.(id, dataTransfer)}
            />
          ) : null}
        </div>
        {isSubagent ? (
          <div className="flex items-center gap-2 pr-16">
            {kindIcon(data.kind)}
            <p className="min-w-0 flex-1 text-sm font-semibold leading-snug text-amber-50" title={data.label}>
              {displayTitle}
            </p>
          </div>
        ) : (
          <div className="flex items-start gap-2 pr-4">
            {kindIcon(data.kind)}
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                {kindTitle(data.kind)}
              </p>
              <p className="truncate text-sm font-semibold text-slate-100">{data.label}</p>
            </div>
          </div>
        )}
        {!isEnd ? (
          <Handle
            type="source"
            position={sourceHandle}
            className="!h-2 !w-2 !border-amber-700/80 !bg-amber-900/90"
          />
        ) : null}
      </div>
    </>
  );
}
