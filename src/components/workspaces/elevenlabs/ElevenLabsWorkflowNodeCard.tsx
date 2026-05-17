/**
 * React Flow node card styled like ElevenLabs ConvAI workflow nodes (read-only).
 */

import React from 'react';
import { Handle, NodeToolbar, Position, type NodeProps } from 'reactflow';
import type { ElWorkflowNodeData } from '@workspaces/elevenlabs/convaiWorkflowToReactFlow';
import { Bot, CircleDot, Flag, GripVertical, Wrench } from 'lucide-react';

function kindIcon(kind: string): React.ReactElement {
  if (kind === 'start') return <Flag className="h-3.5 w-3.5 text-emerald-400" aria-hidden />;
  if (kind === 'tool') return <Wrench className="h-3.5 w-3.5 text-amber-400" aria-hidden />;
  if (kind === 'subagent') return <Bot className="h-3.5 w-3.5 text-violet-400" aria-hidden />;
  return <CircleDot className="h-3.5 w-3.5 text-slate-400" aria-hidden />;
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
    <div
      className="absolute -right-1 -top-1 z-10 flex opacity-80 transition-opacity group-hover:opacity-100"
      title="Trascina sul canvas Omnia (tasto sinistro)"
    >
      <button
        type="button"
        draggable
        aria-label={`Trascina «${label}» sul canvas Omnia`}
        className="nodrag nopan cursor-grab rounded-md border border-violet-600/70 bg-violet-950 p-1 text-violet-200 shadow active:cursor-grabbing"
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onDragStart={handleDragStart}
      >
        <GripVertical className="h-3.5 w-3.5" aria-hidden />
      </button>
    </div>
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
  const showToolbar = selected && canOmnia && data.onEditInOmnia;
  const targetHandle = data.targetHandlePosition ?? targetPositionProp ?? Position.Left;
  const sourceHandle = data.sourceHandlePosition ?? sourcePositionProp ?? Position.Right;

  return (
    <>
      {showToolbar ? (
        <NodeToolbar
          isVisible
          position={Position.Top}
          offset={10}
          className="!border-0 !bg-transparent !shadow-none"
        >
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={data.importBusy}
              onClick={(e) => {
                e.stopPropagation();
                data.onEditInOmnia?.(id);
              }}
              className="rounded-md border border-violet-500/70 bg-violet-950 px-3 py-1.5 text-xs font-semibold text-violet-50 shadow-lg hover:bg-violet-900 disabled:opacity-50"
            >
              {data.importBusy ? 'Import…' : 'Edit in Omnia'}
            </button>
          </div>
        </NodeToolbar>
      ) : null}
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
        {canOmnia && data.onDragToOmniaFlow ? (
          <OmniaFlowDragHandle
            label={data.label}
            onDragStart={(dataTransfer) => data.onDragToOmniaFlow?.(id, dataTransfer)}
          />
        ) : null}
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
