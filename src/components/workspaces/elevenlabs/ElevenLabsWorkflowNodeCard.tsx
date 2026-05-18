/**
 * React Flow node card styled like ElevenLabs ConvAI workflow nodes (read-only).
 */

import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';
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

/** Max prompt tip width as a multiple of the node body width. */
const PROMPT_TIP_WIDTH_MULTIPLIER = 3;

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

function isWithinRef(target: EventTarget | null, ref: React.RefObject<HTMLElement | null>): boolean {
  return target instanceof HTMLElement && Boolean(ref.current?.contains(target));
}

/** Tip width: at least node width, up to 3× for long prompts (left-aligned under the card). */
function resolvePromptTipWidth(nodeWidth: number): { minWidth: number; maxWidth: number } {
  return { minWidth: nodeWidth, maxWidth: nodeWidth * PROMPT_TIP_WIDTH_MULTIPLIER };
}

function PromptTooltipPanel({
  text,
  nodeWidth,
  onMouseEnter,
  onMouseLeave,
}: {
  text: string;
  nodeWidth: number;
  onMouseEnter: () => void;
  onMouseLeave: (e: React.MouseEvent) => void;
}): React.ReactElement {
  const { minWidth, maxWidth } = resolvePromptTipWidth(nodeWidth);

  return (
    <div
      role="tooltip"
      className={
        'el-workflow-prompt-tip absolute left-0 top-full z-[1100] mt-1 max-h-56 overflow-y-auto ' +
        'rounded-md border border-slate-600 bg-slate-950 px-2.5 py-2 text-left text-[11px] ' +
        'leading-snug whitespace-pre-wrap text-slate-200 shadow-xl'
      }
      style={{ minWidth, maxWidth, width: 'max-content' }}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {text}
    </div>
  );
}

function NodeSideToolbar({
  nodeId,
  onCopy,
  onDelete,
  toolbarRef,
  onMouseEnter,
  onMouseLeave,
}: {
  nodeId: string;
  onCopy?: (id: string) => void;
  onDelete?: (id: string) => void;
  toolbarRef: React.RefObject<HTMLDivElement | null>;
  onMouseEnter: () => void;
  onMouseLeave: (e: React.MouseEvent) => void;
}): React.ReactElement | null {
  if (!onCopy && !onDelete) return null;

  return (
    <NodeToolbar
      isVisible
      position={Position.Right}
      offset={0}
      align="start"
      className="!border-0 !bg-transparent !p-0 !shadow-none"
    >
      <div
        ref={toolbarRef}
        className="nodrag nopan -ml-1 flex flex-col gap-0.5 rounded-lg bg-slate-950/95 py-1 pl-1 pr-0.5 shadow-lg"
        onMouseDown={(e) => e.stopPropagation()}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
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
  const [promptOpen, setPromptOpen] = useState(false);
  const [nodeWidth, setNodeWidth] = useState(220);
  const cardRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  const isStart = data.kind === 'start';
  const isEnd = data.kind === 'end';
  const isSubagent = data.kind === 'subagent';
  const canOmnia = data.kind === 'subagent' || data.kind === 'tool';
  const hasSideActions = Boolean(data.onCopyNode || data.onDeleteNode);
  const showSideToolbar = hovered && hasSideActions;
  const targetHandle = data.targetHandlePosition ?? targetPositionProp ?? Position.Left;
  const sourceHandle = data.sourceHandlePosition ?? sourcePositionProp ?? Position.Right;
  const displayTitle = isSubagent ? truncateAgentLabel(data.label) : data.label;
  const promptTooltip =
    data.promptTooltip?.trim() ||
    (data.inheritsGlobalPrompt ? 'SYSTEM PROMPT (ereditato dall’agente)' : data.promptPreview) ||
    '';
  const hasPromptTip = isSubagent && promptTooltip.trim().length > 0;
  const elevated = hovered || promptOpen || selected;

  const measureNodeWidth = useCallback(() => {
    const w = cardRef.current?.offsetWidth;
    if (w && w > 0) setNodeWidth(w);
  }, []);

  useLayoutEffect(() => {
    measureNodeWidth();
  }, [measureNodeWidth, displayTitle, data.label, isSubagent]);

  useLayoutEffect(() => {
    if (!promptOpen) return;
    measureNodeWidth();
  }, [promptOpen, measureNodeWidth]);

  const keepToolbarHover = useCallback(() => {
    setHovered(true);
  }, []);

  const handleCardMouseLeave = useCallback((e: React.MouseEvent) => {
    if (isWithinRef(e.relatedTarget, toolbarRef)) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (el && toolbarRef.current?.contains(el)) return;
    setHovered(false);
  }, []);

  const handleToolbarMouseLeave = useCallback((e: React.MouseEvent) => {
    if (isWithinRef(e.relatedTarget, cardRef)) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (el && cardRef.current?.contains(el)) return;
    setHovered(false);
  }, []);

  const handlePromptPanelLeave = useCallback((e: React.MouseEvent) => {
    const tip = cardRef.current?.querySelector('.el-workflow-prompt-tip');
    if (isWithinRef(e.relatedTarget, cardRef)) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (el && tip?.contains(el)) return;
    setPromptOpen(false);
  }, []);

  const handlePromptIconLeave = useCallback(
    (e: React.MouseEvent) => {
      const tip = cardRef.current?.querySelector('.el-workflow-prompt-tip');
      if (isWithinRef(e.relatedTarget, cardRef) && tip?.contains(e.relatedTarget as HTMLElement)) return;
      const el = document.elementFromPoint(e.clientX, e.clientY);
      if (el && tip?.contains(el)) return;
      setPromptOpen(false);
    },
    []
  );

  return (
    <>
      {showSideToolbar ? (
        <NodeSideToolbar
          nodeId={id}
          onCopy={data.onCopyNode}
          onDelete={data.onDeleteNode}
          toolbarRef={toolbarRef}
          onMouseEnter={keepToolbarHover}
          onMouseLeave={handleToolbarMouseLeave}
        />
      ) : null}
      <div
        ref={cardRef}
        className={
          'group relative min-w-[220px] max-w-[340px] rounded-lg border px-3 py-2.5 shadow-lg ' +
          (elevated ? 'el-workflow-node-elevated ' : '') +
          (selected
            ? 'border-violet-400/80 bg-slate-900 ring-2 ring-violet-500/50'
            : isStart
              ? 'border-emerald-700/60 bg-emerald-950/40'
              : 'border-slate-600/80 bg-slate-900/95')
        }
        style={elevated ? { zIndex: 1000 } : undefined}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={handleCardMouseLeave}
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
            (hovered || promptOpen ? 'opacity-100' : 'opacity-0') +
            ' transition-opacity'
          }
        >
          {hasPromptTip ? (
            <span
              className="relative nodrag nopan"
              onMouseEnter={() => {
                measureNodeWidth();
                setPromptOpen(true);
              }}
              onMouseLeave={handlePromptIconLeave}
            >
              <button
                type="button"
                className="rounded-md border border-slate-600/80 bg-slate-800/90 p-1 text-violet-300 hover:text-violet-100"
                aria-label="Mostra system prompt"
                onClick={(e) => e.stopPropagation()}
              >
                <Sparkles className="h-3.5 w-3.5" aria-hidden />
              </button>
            </span>
          ) : null}
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
        {promptOpen && hasPromptTip ? (
          <PromptTooltipPanel
            text={promptTooltip}
            nodeWidth={nodeWidth}
            onMouseEnter={() => setPromptOpen(true)}
            onMouseLeave={handlePromptPanelLeave}
          />
        ) : null}
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
