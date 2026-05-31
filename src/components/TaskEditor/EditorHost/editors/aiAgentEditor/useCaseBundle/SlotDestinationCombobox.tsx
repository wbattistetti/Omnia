/**
 * Combo Slot Mapping con albero collassabile (▸/▾, espansione per ramo).
 */

import React from 'react';
import { ChevronRight, Server } from 'lucide-react';
import {
  isUnclassifiedSlotId,
  isValidSlotId,
  normalizeSlotId,
} from '@domain/useCaseBundle/projectSlotLexicon';
import type { ParameterDestination } from '@domain/backendOutputSlotBinding/parameterDestinationTree';
import {
  findDestinationForReceivePath,
  findDestinationForSendHint,
  groupDestinationsByBackend,
} from '@domain/backendOutputSlotBinding/parameterDestinationTree';
import {
  buildSemanticCollapsibleTree,
  buildSlotMappingCollapsibleTree,
  collectBranchIds,
  type CollapsibleTreeNode,
} from '@domain/backendOutputSlotBinding/slotMappingMenuTree';
import type { SurfaceSendHint } from '@domain/backendOutputSlotBinding/types';

const MENU_MAX_HEIGHT_PX = 288;

/** Tooltip foglia: descrizione parametro OpenAPI + path + slot. */
function destinationMenuTitle(dest: ParameterDestination): string {
  const lines: string[] = [];
  if (dest.description?.trim()) lines.push(dest.description.trim());
  const path = dest.receivePath?.trim() || dest.sendPath?.trim();
  if (path) lines.push(path);
  if (dest.kind === 'receive' && dest.slotId) {
    lines.push(`slot: ${dest.slotId}`);
  }
  if (dest.kind === 'send') {
    if (dest.facetLabel?.trim()) lines.push(dest.facetLabel.trim());
    if (dest.valueKind?.trim()) lines.push(`valueKind: ${dest.valueKind}`);
  }
  if (dest.toolName?.trim()) lines.push(`tool: ${dest.toolName}`);
  return lines.length > 0 ? lines.join('\n') : dest.destinationId;
}

export interface SlotDestinationComboboxProps {
  slotId: string;
  sendHint?: SurfaceSendHint;
  receivePath?: string;
  backendTaskId?: string;
  catalog: readonly ParameterDestination[];
  onCommit: (destination: ParameterDestination) => void;
  disabled?: boolean;
  className?: string;
}

function DestinationClosedLabel({
  slotId,
  selected,
}: {
  slotId: string;
  selected: ParameterDestination | undefined;
}): React.ReactElement {
  if (selected?.kind === 'send' || selected?.kind === 'receive') {
    const toolName = selected.toolName?.trim() || (selected.kind === 'receive' ? 'RECEIVE' : 'SEND');
    const path =
      selected.kind === 'receive'
        ? (selected.receivePath?.trim() || selected.slotId)
        : (selected.sendPath?.trim() || selected.facetLabel?.trim() || '');
    return (
      <span className="flex min-w-0 flex-1 items-center gap-1 font-mono text-[11px] leading-tight">
        <Server size={11} className="shrink-0 text-sky-400/90" aria-hidden />
        <span className="shrink-0 text-emerald-300/95">{toolName}</span>
        {path ? (
          <>
            <span className="shrink-0 text-slate-500" aria-hidden>
              ·
            </span>
            <span className="min-w-0 truncate text-amber-200/90">{path}</span>
          </>
        ) : null}
      </span>
    );
  }
  return (
    <span className="min-w-0 flex-1 truncate font-mono text-[11px] leading-tight text-slate-200">
      {normalizeSlotId(slotId)}
    </span>
  );
}

function CollapsibleTreeView({
  nodes,
  expanded,
  onToggle,
  onPick,
  depth,
}: {
  nodes: readonly CollapsibleTreeNode[];
  expanded: ReadonlySet<string>;
  onToggle: (id: string) => void;
  onPick: (d: ParameterDestination) => void;
  depth: number;
}): React.ReactElement {
  return (
    <>
      {nodes.map((node) => {
        if (node.kind === 'leaf') {
          return (
            <li key={node.id}>
              <button
                type="button"
                title={node.destination.description ?? node.destination.receivePath ?? node.destination.sendPath}
                onClick={() => onPick(node.destination)}
                style={{ paddingLeft: 8 + depth * 14 }}
                className="flex w-full items-baseline gap-1.5 py-1 pr-2 text-left hover:bg-violet-900/40"
              >
                <span className="font-mono text-[11px] text-amber-100/95">{node.label}</span>
                {node.hint ? (
                  <span className="truncate text-[9px] text-slate-500">{node.hint}</span>
                ) : null}
              </button>
            </li>
          );
        }

        const isOpen = expanded.has(node.id);
        const hasKids = node.children.length > 0;
        return (
          <li key={node.id}>
            <button
              type="button"
              disabled={!hasKids}
              title={node.label}
              onClick={() => hasKids && onToggle(node.id)}
              style={{ paddingLeft: 8 + depth * 14 }}
              className={[
                'flex w-full items-center gap-1 py-1 pr-2 text-left font-mono text-[11px] leading-snug',
                hasKids ? 'hover:bg-slate-800/80' : 'cursor-default',
                depth === 0 ? 'font-semibold text-cyan-300' : 'text-slate-300',
              ].join(' ')}
            >
              {hasKids ? (
                <ChevronRight
                  size={12}
                  className={`shrink-0 transition-transform ${isOpen ? 'rotate-90' : ''}`}
                  aria-hidden
                />
              ) : (
                <span className="inline-block w-3 shrink-0" />
              )}
              <span className="truncate">{node.label}</span>
            </button>
            {isOpen && hasKids ? (
              <ul>
                <CollapsibleTreeView
                  nodes={node.children}
                  expanded={expanded}
                  onToggle={onToggle}
                  onPick={onPick}
                  depth={depth + 1}
                />
              </ul>
            ) : null}
          </li>
        );
      })}
    </>
  );
}

export function SlotDestinationCombobox({
  slotId,
  sendHint,
  receivePath,
  backendTaskId,
  catalog,
  onCommit,
  disabled = false,
  className = '',
}: SlotDestinationComboboxProps): React.ReactElement {
  const [open, setOpen] = React.useState(false);
  const [filter, setFilter] = React.useState('');
  const [expanded, setExpanded] = React.useState<Set<string>>(() => new Set());
  const [dropUp, setDropUp] = React.useState(false);
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);

  const selected = React.useMemo(() => {
    if (sendHint?.sendPath?.trim()) {
      return findDestinationForSendHint(catalog, sendHint);
    }
    if (receivePath?.trim()) {
      return findDestinationForReceivePath(catalog, receivePath, backendTaskId);
    }
    const sid = normalizeSlotId(slotId);
    if (!isUnclassifiedSlotId(sid)) {
      return catalog.find((d) => d.kind === 'semantic' && d.slotId === sid);
    }
    return undefined;
  }, [catalog, sendHint, receivePath, backendTaskId, slotId]);

  const { semantic, backends } = React.useMemo(
    () => groupDestinationsByBackend(catalog),
    [catalog]
  );

  const f = filter.trim().toLowerCase();

  const forest = React.useMemo(() => {
    const roots: CollapsibleTreeNode[] = [];
    const semDests = f ? semantic.filter((d) => d.slotId.toLowerCase().includes(f)) : semantic;
    if (semDests.length > 0) {
      roots.push(...buildSemanticCollapsibleTree(semDests, f));
    }
    for (const group of backends) {
      roots.push(...buildSlotMappingCollapsibleTree(group.toolName, group, f));
    }
    return roots;
  }, [semantic, backends, f]);

  React.useEffect(() => {
    if (!open) return;
    if (f) {
      setExpanded(new Set(collectBranchIds(forest)));
    } else {
      setExpanded(new Set());
    }
  }, [open, f, forest]);

  React.useLayoutEffect(() => {
    if (!open || !wrapRef.current) return;
    const anchor = wrapRef.current.getBoundingClientRect();
    const menuH = menuRef.current?.offsetHeight ?? MENU_MAX_HEIGHT_PX;
    const gap = 6;
    const fitsBelow = anchor.bottom + menuH + gap <= window.innerHeight;
    const fitsAbove = anchor.top - menuH - gap >= 0;
    if (!fitsBelow && fitsAbove) {
      setDropUp(true);
    } else if (fitsBelow) {
      setDropUp(false);
    } else {
      setDropUp(anchor.top > window.innerHeight - anchor.bottom);
    }
  }, [open, filter, forest, expanded]);

  const toggleBranch = React.useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  React.useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  React.useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const tryCommitDraft = React.useCallback(() => {
    const next = normalizeSlotId(f || filter);
    if (!isValidSlotId(next) || isUnclassifiedSlotId(next)) return;
    const semanticDest = catalog.find((d) => d.kind === 'semantic' && d.slotId === next);
    onCommit(
      semanticDest ?? {
        destinationId: `semantic:${next}`,
        kind: 'semantic',
        slotId: next,
      }
    );
    setOpen(false);
    setFilter('');
  }, [f, filter, catalog, onCommit]);

  const pick = React.useCallback(
    (d: ParameterDestination) => {
      onCommit(d);
      setOpen(false);
      setFilter('');
    },
    [onCommit]
  );

  return (
    <div ref={wrapRef} className={`relative min-w-0 max-w-[min(280px,100%)] ${className}`}>
      <button
        type="button"
        disabled={disabled || catalog.length === 0}
        onClick={() => !disabled && catalog.length > 0 && setOpen((v) => !v)}
        className={[
          'flex min-h-7 w-full min-w-0 flex-row items-center gap-1 rounded border px-1.5 py-0.5',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70',
          disabled ? 'cursor-not-allowed opacity-50' : '',
          'border-slate-600 bg-slate-900 text-left',
        ].join(' ')}
      >
        <DestinationClosedLabel slotId={slotId} selected={selected} />
        <span className="shrink-0 font-mono text-[10px] text-slate-500">{open ? '▴' : '▾'}</span>
      </button>
      {open ? (
        <div
          ref={menuRef}
          className={[
            'absolute left-0 z-50 flex min-w-[min(280px,92vw)] flex-col rounded border border-violet-500/40 bg-slate-950 text-[11px] text-slate-100 shadow-lg',
            dropUp ? 'bottom-full mb-0.5' : 'top-full mt-0.5',
          ].join(' ')}
        >
          <input
            type="text"
            autoFocus
            placeholder="Cerca…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                tryCommitDraft();
              }
              if (e.key === 'Escape') {
                setOpen(false);
                setFilter('');
              }
            }}
            className="h-8 shrink-0 border-b border-slate-700 bg-slate-900 px-2 py-0.5 font-mono text-[11px] outline-none placeholder:text-slate-600"
          />
          <ul className="max-h-72 min-h-0 overflow-y-auto overscroll-contain py-1">
            <CollapsibleTreeView
              nodes={forest}
              expanded={expanded}
              onToggle={toggleBranch}
              onPick={pick}
              depth={0}
            />
            {f && isValidSlotId(f) && !isUnclassifiedSlotId(f) ? (
              <li className="border-t border-slate-700/80 px-3 py-1 font-mono text-[11px] text-slate-500">
                Invio → slot «{f}»
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
