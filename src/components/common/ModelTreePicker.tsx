/**
 * Combobox + collapsible-tree popover to pick an LLM model.
 *
 * Replaces the flat `<select>` dropdown that used to render entries like `[OpenAI] gpt-5`. The
 * tree is provider -> deep model path, computed by `buildModelTree`, so the user scans:
 *
 *   [v] Groq (12)
 *         [v] llama
 *               [v] 3.3
 *                     [v] 70b
 *                           versatile
 *   [>] OpenAI (158)
 *
 * Selection contract: a selectable node's `selectableModelId` is the value forwarded to `onChange`. No string
 * manipulation, no implicit defaults — the caller decides what to do (typically save in
 * `OmniaTutorSetup` / `AIProviderContext`).
 *
 * Expand/collapse state persists in localStorage across reloads (`STORAGE_KEY`). The provider
 * and ancestors of the currently selected model are auto-expanded on first render so the user
 * always sees their choice.
 */

import React from 'react';
import { ChevronDown, ChevronRight, Search, X } from 'lucide-react';
import {
  buildModelTree,
  filterModelTree,
  findLeafByModelId,
  type ModelTreeNode,
  type ModelTreeProvider,
  type ProviderSpec,
} from '@domain/llmModelTree/buildModelTree';
import type { AvailableLlmModelOption } from '@hooks/useAvailableLlmModels';

const STORAGE_KEY = 'omnia.modelTreePicker.expanded.v1';

export interface ModelTreePickerProps {
  /** Currently selected model id (matches a selectable node, or empty/legacy id). */
  value: string;
  /** Live catalog options merged across providers, sorted by label. */
  options: ReadonlyArray<AvailableLlmModelOption>;
  /** Stable provider order shown at the top level. */
  providers: ReadonlyArray<ProviderSpec>;
  /** Notifies the parent with the picked model id (and the provider that owns it). */
  onChange: (modelId: string, providerId: ModelTreeNode['providerId']) => void;
  /** Disable the trigger and ignore clicks (e.g. while loading). */
  disabled?: boolean;
  /** Placeholder rendered when no model is selected. */
  placeholder?: string;
  /** Extra classes applied to the trigger button. */
  triggerClassName?: string;
}

interface ExpansionState {
  providers: Set<string>;
  nodes: Set<string>;
}

function readExpansion(): ExpansionState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { providers: new Set(), nodes: new Set() };
    const parsed = JSON.parse(raw) as { providers?: unknown; nodes?: unknown; families?: unknown };
    return {
      providers: new Set(Array.isArray(parsed.providers) ? parsed.providers.map(String) : []),
      nodes: new Set(
        Array.isArray(parsed.nodes)
          ? parsed.nodes.map(String)
          : Array.isArray(parsed.families)
            ? parsed.families.map(String)
            : []
      ),
    };
  } catch {
    return { providers: new Set(), nodes: new Set() };
  }
}

function writeExpansion(state: ExpansionState): void {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        providers: [...state.providers],
        nodes: [...state.nodes],
      })
    );
  } catch {
    // localStorage may be unavailable; expansion remains in-memory for the session
  }
}

function expansionNodeId(providerId: string, nodeKey: string): string {
  return `${providerId}::${nodeKey}`;
}

export function ModelTreePicker({
  value,
  options,
  providers,
  onChange,
  disabled,
  placeholder = 'Scegli un modello…',
  triggerClassName,
}: ModelTreePickerProps): React.ReactElement {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [expansion, setExpansion] = React.useState<ExpansionState>(() => readExpansion());
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const searchInputRef = React.useRef<HTMLInputElement | null>(null);

  const tree = React.useMemo<ModelTreeProvider[]>(
    () => buildModelTree(options, { providers }),
    [options, providers]
  );

  const selected = React.useMemo(() => findLeafByModelId(tree, value), [tree, value]);

  const triggerLabel = React.useMemo(() => {
    if (selected) return `${selected.node.selectableModelId}`;
    if (value) return value;
    return placeholder;
  }, [selected, value, placeholder]);

  const triggerProviderHint = selected ? selected.provider.label : null;

  React.useEffect(() => {
    if (!selected) return;
    setExpansion((prev) => {
      const next: ExpansionState = {
        providers: new Set(prev.providers),
        nodes: new Set(prev.nodes),
      };
      let changed = false;
      if (!next.providers.has(selected.provider.providerId)) {
        next.providers.add(selected.provider.providerId);
        changed = true;
      }
      for (const ancestor of selected.ancestors) {
        const nodeId = expansionNodeId(selected.provider.providerId, ancestor.nodeKey);
        if (!next.nodes.has(nodeId)) {
          next.nodes.add(nodeId);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [selected]);

  React.useEffect(() => {
    writeExpansion(expansion);
  }, [expansion]);

  React.useEffect(() => {
    if (!open) return undefined;
    const onDown = (e: MouseEvent): void => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => searchInputRef.current?.focus(), 30);
    return () => window.clearTimeout(id);
  }, [open]);

  const visibleTree = React.useMemo(
    () => filterModelTree(tree, query),
    [tree, query]
  );

  const queryActive = query.trim().length > 0;

  const toggleProvider = (providerId: string): void => {
    setExpansion((prev) => {
      const providers = new Set(prev.providers);
      if (providers.has(providerId)) providers.delete(providerId);
      else providers.add(providerId);
      return { providers, nodes: prev.nodes };
    });
  };

  const toggleNode = (providerId: string, nodeKey: string): void => {
    setExpansion((prev) => {
      const nodes = new Set(prev.nodes);
      const nodeId = expansionNodeId(providerId, nodeKey);
      if (nodes.has(nodeId)) nodes.delete(nodeId);
      else nodes.add(nodeId);
      return { providers: prev.providers, nodes };
    });
  };

  const isProviderExpanded = (providerId: string): boolean =>
    queryActive || expansion.providers.has(providerId);
  const isNodeExpanded = (providerId: string, nodeKey: string): boolean =>
    queryActive || expansion.nodes.has(expansionNodeId(providerId, nodeKey));

  const handlePick = (node: ModelTreeNode): void => {
    if (!node.selectableModelId) return;
    onChange(node.selectableModelId, node.providerId);
    setOpen(false);
    setQuery('');
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="tree"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={
          triggerClassName ??
          'flex w-full items-center justify-between gap-2 rounded-md border border-slate-600 bg-slate-950 px-2 py-1.5 text-left text-sm text-slate-100 hover:border-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 disabled:opacity-60'
        }
      >
        <span className="flex min-w-0 flex-1 items-center gap-2">
          {triggerProviderHint ? (
            <span className="shrink-0 rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-300">
              {triggerProviderHint}
            </span>
          ) : null}
          <span className={value ? 'truncate text-slate-100' : 'truncate text-slate-500'}>
            {triggerLabel}
          </span>
        </span>
        <ChevronDown
          size={14}
          className={`shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>

      {open ? (
        <div
          role="tree"
          aria-label="Modelli disponibili"
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-80 overflow-hidden rounded-md border border-slate-600 bg-slate-950 shadow-xl"
        >
          <div className="flex items-center gap-1.5 border-b border-slate-700/70 px-2 py-1.5">
            <Search size={12} className="text-slate-400" aria-hidden />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Cerca modello…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 bg-transparent text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none"
            />
            {query ? (
              <button
                type="button"
                aria-label="Pulisci ricerca"
                onClick={() => setQuery('')}
                className="rounded p-0.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              >
                <X size={11} aria-hidden />
              </button>
            ) : null}
          </div>
          <div className="max-h-72 overflow-y-auto py-1 text-xs">
            {visibleTree.length === 0 ? (
              <div className="px-3 py-3 text-center text-slate-500">
                Nessun modello corrisponde alla ricerca.
              </div>
            ) : (
              visibleTree.map((provider) => (
                <ProviderRow
                  key={provider.providerId}
                  provider={provider}
                  expanded={isProviderExpanded(provider.providerId)}
                  isNodeExpanded={isNodeExpanded}
                  selectedModelId={value}
                  onToggleProvider={toggleProvider}
                  onToggleNode={toggleNode}
                  onPick={handlePick}
                />
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ProviderRow({
  provider,
  expanded,
  isNodeExpanded,
  selectedModelId,
  onToggleProvider,
  onToggleNode,
  onPick,
}: {
  provider: ModelTreeProvider;
  expanded: boolean;
  isNodeExpanded: (providerId: string, nodeKey: string) => boolean;
  selectedModelId: string;
  onToggleProvider: (providerId: string) => void;
  onToggleNode: (providerId: string, nodeKey: string) => void;
  onPick: (node: ModelTreeNode) => void;
}): React.ReactElement {
  return (
    <div role="treeitem" aria-expanded={expanded} className="select-none">
      <button
        type="button"
        onClick={() => onToggleProvider(provider.providerId)}
        className="flex w-full items-center gap-1.5 px-2 py-1 text-left font-semibold text-slate-100 hover:bg-slate-800/70 focus:outline-none focus-visible:bg-slate-800/70"
      >
        {expanded ? (
          <ChevronDown size={12} className="shrink-0 text-slate-400" aria-hidden />
        ) : (
          <ChevronRight size={12} className="shrink-0 text-slate-400" aria-hidden />
        )}
        <span className="flex-1 truncate">{provider.label}</span>
        <span className="shrink-0 rounded bg-slate-800 px-1 py-0 text-[10px] text-slate-400">
          {provider.modelCount}
        </span>
      </button>
      {expanded ? (
        <div role="group">
          {provider.children.length === 0 ? (
            <div className="pl-7 pr-3 py-1 text-[11px] italic text-slate-500">
              Nessun modello disponibile per questo provider.
            </div>
          ) : (
            provider.children.map((node) => (
              <NodeRow
                key={node.nodeKey}
                provider={provider}
                node={node}
                depth={0}
                expanded={isNodeExpanded(provider.providerId, node.nodeKey)}
                isNodeExpanded={isNodeExpanded}
                selectedModelId={selectedModelId}
                onToggleNode={onToggleNode}
                onPick={onPick}
              />
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

function NodeRow({
  provider,
  node,
  depth,
  expanded,
  isNodeExpanded,
  selectedModelId,
  onToggleNode,
  onPick,
}: {
  provider: ModelTreeProvider;
  node: ModelTreeNode;
  depth: number;
  expanded: boolean;
  isNodeExpanded: (providerId: string, nodeKey: string) => boolean;
  selectedModelId: string;
  onToggleNode: (providerId: string, nodeKey: string) => void;
  onPick: (node: ModelTreeNode) => void;
}): React.ReactElement {
  const hasChildren = node.children.length > 0;
  const isSelected = node.selectableModelId === selectedModelId;
  const leftPadding = 20 + depth * 14;

  return (
    <div role="treeitem" aria-expanded={expanded} className="select-none">
      <div
        className={`flex w-full items-center gap-1.5 pr-2 py-0.5 text-left hover:bg-slate-800/60 ${
          isSelected ? 'bg-emerald-900/35 text-emerald-100' : 'text-slate-300'
        }`}
        style={{ paddingLeft: leftPadding }}
      >
        {hasChildren ? (
          <button
            type="button"
            aria-label={expanded ? `Comprimi ${node.label}` : `Espandi ${node.label}`}
            onClick={() => onToggleNode(provider.providerId, node.nodeKey)}
            className="rounded p-0.5 text-slate-500 hover:bg-slate-700 hover:text-slate-200 focus:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500/70"
          >
            {expanded ? (
              <ChevronDown size={11} aria-hidden />
            ) : (
              <ChevronRight size={11} aria-hidden />
            )}
          </button>
        ) : (
          <span className="w-4 shrink-0" aria-hidden />
        )}
        <button
          type="button"
          role="treeitem"
          aria-selected={isSelected}
          disabled={!node.selectableModelId}
          onClick={() => onPick(node)}
          className={`min-w-0 flex-1 truncate text-left focus:outline-none focus-visible:text-emerald-100 ${
            node.selectableModelId
              ? 'font-mono text-[11px] text-slate-100 hover:text-emerald-100 disabled:cursor-default'
              : 'text-slate-400 disabled:cursor-default'
          }`}
          title={node.selectableModelId ?? undefined}
        >
          {node.label}
        </button>
        <span className="shrink-0 text-[10px] text-slate-500">{node.modelCount}</span>
      </div>
      {expanded ? (
        <div role="group">
          {node.children.map((child) => (
            <NodeRow
              key={child.nodeKey}
              provider={provider}
              node={child}
              depth={depth + 1}
              expanded={isNodeExpanded(provider.providerId, child.nodeKey)}
              isNodeExpanded={isNodeExpanded}
              selectedModelId={selectedModelId}
              onToggleNode={onToggleNode}
              onPick={onPick}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
