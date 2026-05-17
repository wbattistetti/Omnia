/**
 * React Flow node card styled like ElevenLabs ConvAI workflow nodes (read-only).
 */

import React from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import type { ElWorkflowNodeData } from '@workspaces/elevenlabs/convaiWorkflowToReactFlow';
import { Anchor, Bot, CircleDot, Flag, GripVertical, Wrench } from 'lucide-react';
import { EL_RIGID_ANCHOR_CLASS } from './useElWorkflowRigidDrag';

function kindIcon(kind: string): React.ReactElement {
  if (kind === 'start') return <Flag className="h-3.5 w-3.5 text-emerald-400" aria-hidden />;
  if (kind === 'tool') return <Wrench className="h-3.5 w-3.5 text-amber-400" aria-hidden />;
  if (kind === 'subagent') return <Bot className="h-3.5 w-3.5 text-violet-400" aria-hidden />;
  return <CircleDot className="h-3.5 w-3.5 text-slate-400" aria-hidden />;
}

/** Anchor: drag su React Flow sposta il nodo e tutti i discendenti (vedi useElWorkflowRigidDrag). */
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

/** Grip isolato dal pan React Flow: solo questo elemento avvia il drag HTML5 verso Omnia. */
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
      title="Trascina sul canvas Omnia (tasto sinistro)"
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

function kindTitle(kind: string): string {
  if (kind === 'start') return 'Inizia';
  if (kind === 'end') return 'Fine';
  if (kind === 'subagent') return 'Subagent';
  if (kind === 'tool') return 'Tool';
  return kind;
}

export function ElevenLabsWorkflowNodeCard({
  id,
  data,
  selected,
  sourcePosition: sourcePositionProp,
  targetPosition: targetPositionProp,
}: NodeProps<ElWorkflowNodeData>): React.ReactElement {
  const isStart = data.kind === 'start';
  const isEnd = data.kind === 'end';
  const canOmnia = data.kind === 'subagent' || data.kind === 'tool';
  const targetHandle = data.targetHandlePosition ?? targetPositionProp ?? Position.Left;
  const sourceHandle = data.sourceHandlePosition ?? sourcePositionProp ?? Position.Right;

  return (
    <>
      <div
        className={
          'group relative min-w-[200px] max-w-[260px] rounded-lg border px-3 py-2.5 shadow-lg ' +
          (selected
            ? 'border-violet-400/80 bg-slate-900 ring-2 ring-violet-500/50'
            : isStart
              ? 'border-emerald-700/60 bg-emerald-950/40'
              : 'border-slate-600/80 bg-slate-900/95')
        }
      >
        {!isStart ? (
          <Handle
            type="target"
            position={targetHandle}
            className="!h-2 !w-2 !border-amber-700/80 !bg-amber-900/90"
          />
        ) : null}
        <div className="absolute -right-1 -top-1 z-10 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <RigidSubtreeAnchor />
          {canOmnia && data.onDragToOmniaFlow ? (
            <OmniaFlowDragHandle
              label={data.label}
              onDragStart={(dataTransfer) => data.onDragToOmniaFlow?.(id, dataTransfer)}
            />
          ) : null}
        </div>
        <div className="flex items-start gap-2 pr-4">
          {kindIcon(data.kind)}
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
              {kindTitle(data.kind)}
            </p>
            <p className="truncate text-sm font-semibold text-slate-100">{data.label}</p>
            {data.promptPreview && !isStart && !isEnd ? (
              <p
                className={
                  'mt-1 line-clamp-2 text-[10px] leading-snug ' +
                  (data.inheritsGlobalPrompt
                    ? 'font-semibold uppercase tracking-wide text-slate-500'
                    : 'text-slate-400')
                }
              >
                {data.promptPreview}
              </p>
            ) : null}
          </div>
        </div>
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
