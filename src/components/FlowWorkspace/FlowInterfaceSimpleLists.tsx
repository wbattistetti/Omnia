/**
 * Liste Input/Output per il pannello laterale flow: stesso stile delle altre sezioni (collassabile + righe),
 * senza MappingBlock / FlowMappingTree. Persistenza: meta.flowInterface.
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Brackets, Check, Lock, Pencil, Trash2, X } from 'lucide-react';
import type { WorkspaceState } from '@flows/FlowTypes';
import {
  DND_FLOWROW_VAR,
  hasFlowRowVarDrag,
  parseFlowInterfaceDropFromDataTransfer,
  type FlowInterfaceDropPayload,
} from '../FlowMappingPanel/flowInterfaceDragTypes';
import { createMappingEntry, type MappingEntry } from '../FlowMappingPanel/mappingTypes';
import {
  ensureFlowVariableBindingForInterfaceRow,
  getInterfaceLeafDisplayName,
  shouldSkipInterfaceDuplicate,
} from '../FlowMappingPanel/interfaceMappingLabels';
import { CollapsiblePanelSection } from './CollapsiblePanelSection';
import { SidebarPortalTooltip, useSidebarHoverPortal } from './flowSidebarPortalTooltip';
import { variableCreationService } from '../../services/VariableCreationService';
import type { ParentInterfaceBindingSite } from '../../services/childFlowInterfaceParentBindings';
import type { ReferenceLocation } from '../../services/subflowVariableReferenceScan';
import { getVariableLabel } from '../../utils/getVariableLabel';
import { makeTranslationKey } from '../../utils/translationKeys';

function sortEntriesForDisplay(
  entries: MappingEntry[],
  projectId: string | undefined,
  flowId: string,
  flows: WorkspaceState['flows']
): MappingEntry[] {
  return [...entries].sort((a, b) => {
    const la = getInterfaceLeafDisplayName(a, projectId, { flowCanvasId: flowId, flows }) || a.wireKey;
    const lb = getInterfaceLeafDisplayName(b, projectId, { flowCanvasId: flowId, flows }) || b.wireKey;
    return la.localeCompare(lb, undefined, { sensitivity: 'base' });
  });
}

export interface FlowInterfaceSimpleListsProps {
  flowId: string;
  projectId?: string;
  /** Stesso flatten di `flow.meta.translations` usato per le righe Data. */
  flowMetaTranslations: Record<string, string>;
  addTranslation: (key: string, text: string) => void;
  workspaceFlows: WorkspaceState['flows'];
  interfaceInput: MappingEntry[];
  interfaceOutput: MappingEntry[];
  onInterfaceInputChange: (next: MappingEntry[]) => void;
  onInterfaceOutputChange: (next: MappingEntry[]) => void;
  onVariableMetadataChange?: () => void;
  /** Output: variabile → riferimenti [GUID] che bloccano la rimozione (UI: cestino disabilitato + tooltip). */
  outputRemovalBlockedByVarId: Map<string, ReferenceLocation[]>;
  /** Variabile → siti parent con subflowBindings S2 attivi. */
  parentBindingSitesByVarId: Map<string, ParentInterfaceBindingSite[]>;
  onNavigateToParentBindingSite: (site: ParentInterfaceBindingSite) => void;
}

export function FlowInterfaceSimpleLists({
  flowId,
  projectId,
  flowMetaTranslations,
  addTranslation,
  workspaceFlows,
  interfaceInput,
  interfaceOutput,
  onInterfaceInputChange,
  onInterfaceOutputChange,
  onVariableMetadataChange,
  outputRemovalBlockedByVarId,
  parentBindingSitesByVarId,
  onNavigateToParentBindingSite,
}: FlowInterfaceSimpleListsProps) {
  const [, bump] = React.useReducer((n: number) => n + 1, 0);

  const refresh = useCallback(() => {
    bump();
    onVariableMetadataChange?.();
  }, [onVariableMetadataChange]);

  const sortedIn = useMemo(
    () => sortEntriesForDisplay(interfaceInput, projectId, flowId, workspaceFlows),
    [interfaceInput, projectId, flowId, workspaceFlows]
  );
  const sortedOut = useMemo(
    () => sortEntriesForDisplay(interfaceOutput, projectId, flowId, workspaceFlows),
    [interfaceOutput, projectId, flowId, workspaceFlows]
  );

  const onDropVariableInput = useCallback(
    (payload: FlowInterfaceDropPayload) => {
      const vid = String(payload.variableRefId || '').trim();
      if (!vid) return;
      const path = payload.wireKey.trim();
      if (!path) return;
      ensureFlowVariableBindingForInterfaceRow(projectId, flowId, vid);
      const newEntry = createMappingEntry({ wireKey: path, variableRefId: vid });
      if (shouldSkipInterfaceDuplicate(interfaceInput, newEntry)) return;
      onInterfaceInputChange([...interfaceInput, newEntry]);
    },
    [projectId, flowId, interfaceInput, onInterfaceInputChange]
  );

  const onDropVariableOutput = useCallback(
    (payload: FlowInterfaceDropPayload) => {
      const vid = String(payload.variableRefId || '').trim();
      if (!vid) return;
      const path = payload.wireKey.trim();
      if (!path) return;
      ensureFlowVariableBindingForInterfaceRow(projectId, flowId, vid);
      const newEntry = createMappingEntry({ wireKey: path, variableRefId: vid });
      if (shouldSkipInterfaceDuplicate(interfaceOutput, newEntry)) return;
      onInterfaceOutputChange([...interfaceOutput, newEntry]);
    },
    [projectId, flowId, interfaceOutput, onInterfaceOutputChange]
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    if (!hasFlowRowVarDrag(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const makeDrop =
    (onDropVariable: (p: FlowInterfaceDropPayload) => void) => (e: React.DragEvent) => {
      e.preventDefault();
      const fromRow = parseFlowInterfaceDropFromDataTransfer(e.dataTransfer);
      if (fromRow) {
        onDropVariable(fromRow);
      }
    };

  const removeInput = useCallback(
    (entryId: string) => {
      onInterfaceInputChange(interfaceInput.filter((x) => x.id !== entryId));
    },
    [interfaceInput, onInterfaceInputChange]
  );

  const removeOutput = useCallback(
    (entryId: string) => {
      onInterfaceOutputChange(interfaceOutput.filter((x) => x.id !== entryId));
    },
    [interfaceOutput, onInterfaceOutputChange]
  );

  return (
    <div className="flex min-h-0 min-w-0 shrink-0 flex-col gap-2 border-b border-slate-700/50 pb-2">
      <InterfaceZoneCollapsible
        title="Input"
        zone="input"
        flowId={flowId}
        entries={sortedIn}
        onDragOver={onDragOver}
        onDrop={makeDrop(onDropVariableInput)}
        onRemoveEntry={removeInput}
        projectId={projectId}
        workspaceFlows={workspaceFlows}
        flowMetaTranslations={flowMetaTranslations}
        addTranslation={addTranslation}
        onRenamed={refresh}
        outputRemovalBlockedByVarId={outputRemovalBlockedByVarId}
        parentBindingSitesByVarId={parentBindingSitesByVarId}
        onNavigateToParentBindingSite={onNavigateToParentBindingSite}
      />
      <InterfaceZoneCollapsible
        title="Output"
        zone="output"
        flowId={flowId}
        entries={sortedOut}
        onDragOver={onDragOver}
        onDrop={makeDrop(onDropVariableOutput)}
        onRemoveEntry={removeOutput}
        projectId={projectId}
        workspaceFlows={workspaceFlows}
        flowMetaTranslations={flowMetaTranslations}
        addTranslation={addTranslation}
        onRenamed={refresh}
        outputRemovalBlockedByVarId={outputRemovalBlockedByVarId}
        parentBindingSitesByVarId={parentBindingSitesByVarId}
        onNavigateToParentBindingSite={onNavigateToParentBindingSite}
      />
    </div>
  );
}

function InterfaceZoneCollapsible({
  title,
  zone,
  flowId,
  entries,
  onDragOver,
  onDrop,
  onRemoveEntry,
  projectId,
  workspaceFlows,
  flowMetaTranslations,
  addTranslation,
  onRenamed,
  outputRemovalBlockedByVarId,
  parentBindingSitesByVarId,
  onNavigateToParentBindingSite,
}: {
  title: string;
  zone: 'input' | 'output';
  flowId: string;
  entries: MappingEntry[];
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onRemoveEntry: (entryId: string) => void;
  projectId?: string;
  workspaceFlows: WorkspaceState['flows'];
  flowMetaTranslations: Record<string, string>;
  addTranslation: (key: string, text: string) => void;
  onRenamed: () => void;
  outputRemovalBlockedByVarId: Map<string, ReferenceLocation[]>;
  parentBindingSitesByVarId: Map<string, ParentInterfaceBindingSite[]>;
  onNavigateToParentBindingSite: (site: ParentInterfaceBindingSite) => void;
}) {
  const borderAccent = zone === 'input' ? 'border-sky-600/35' : 'border-violet-600/35';
  const headerTone = zone === 'input' ? 'sky' : 'violet';
  const directionIcon =
    zone === 'input' ? (
      <ArrowLeft className="h-3.5 w-3.5 shrink-0 text-sky-400/90" aria-hidden />
    ) : (
      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-violet-400/90" aria-hidden />
    );

  return (
    <CollapsiblePanelSection
      title={
        <span className="flex items-center gap-2 normal-case tracking-normal">
          {directionIcon}
          <span>{title}</span>
        </span>
      }
      headerTone={headerTone}
      defaultOpen
      className="min-h-0 shrink-0"
      contentClassName="min-h-0 flex flex-col gap-2 overflow-hidden px-1 pb-2"
    >
      <div
        className={`min-h-[2.5rem] rounded-md border ${borderAccent} bg-[#080a0d]/80`}
        data-flow-interface-zone={zone}
        data-flow-canvas-id={flowId}
        data-flow-iface-tree-root=""
        onDragOver={onDragOver}
        onDrop={onDrop}
      >
        {entries.length === 0 ? (
          <p className="px-2 py-3 text-center text-[11px] text-slate-500">Nessun elemento. Trascina qui.</p>
        ) : (
          <ul className="space-y-0.5 p-1.5" role="list">
            {entries.map((entry) => {
              const vid = entry.variableRefId?.trim();
              if (!vid) return null;
              const label =
                getInterfaceLeafDisplayName(entry, projectId, { flowCanvasId: flowId, flows: workspaceFlows }) ||
                entry.wireKey;
              return (
                <InterfaceVariableRow
                  key={entry.id}
                  zone={zone}
                  displayLabel={label}
                  variableRefId={vid}
                  wireKey={entry.wireKey}
                  flowId={flowId}
                  projectId={projectId}
                  flowMetaTranslations={flowMetaTranslations}
                  onRemove={() => onRemoveEntry(entry.id)}
                  addTranslation={addTranslation}
                  onRenamed={onRenamed}
                  parentBindingSites={parentBindingSitesByVarId.get(vid) ?? []}
                  outputRemovalBlockedRefs={outputRemovalBlockedByVarId.get(vid)}
                  onNavigateToParentBindingSite={onNavigateToParentBindingSite}
                />
              );
            })}
          </ul>
        )}
      </div>
    </CollapsiblePanelSection>
  );
}

function LockTooltipBody({
  sites,
  onNavigate,
}: {
  sites: ParentInterfaceBindingSite[];
  onNavigate: (site: ParentInterfaceBindingSite) => void;
}) {
  if (sites.length === 0) return null;
  return (
    <>
      <p className="mb-1.5 text-[10px] font-medium text-slate-300">Legata in (flow parent):</p>
      <ul className="max-h-40 space-y-1 overflow-y-auto text-[10px]">
        {sites.map((s) => (
          <li key={`${s.parentFlowId}:${s.canvasNodeId}:${s.subflowTaskId}`}>
            <button
              type="button"
              className="w-full rounded px-1 py-0.5 text-left font-mono text-[10px] text-sky-300/95 underline-offset-2 hover:bg-slate-800/80 hover:underline"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onNavigate(s);
              }}
            >
              {s.parentFlowTitle}
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

function TrashBlockedTooltipBody({
  trashDisabledByGuidRefs,
  trashDisabledByParentInput,
  blockedRefs,
  parentSites,
  onNavigate,
}: {
  trashDisabledByGuidRefs: boolean;
  trashDisabledByParentInput: boolean;
  blockedRefs: ReferenceLocation[] | undefined;
  parentSites: ParentInterfaceBindingSite[];
  onNavigate: (site: ParentInterfaceBindingSite) => void;
}) {
  return (
    <>
      {trashDisabledByGuidRefs && blockedRefs && blockedRefs.length > 0 ? (
        <>
          <p className="mb-2 text-[10px] leading-snug text-slate-400">
            Non puoi scollegare: la variabile nel flow parent è ancora usata con token [GUID] qui:
          </p>
          <ul className="max-h-44 space-y-1.5 overflow-y-auto border border-slate-700/70 rounded bg-black/25 p-1.5 text-[10px]">
            {blockedRefs.map((r) => (
              <li key={`${r.kind}:${r.id}`} className="flex flex-col gap-0.5">
                <span className="text-[9px] uppercase tracking-wide text-slate-500">{r.kind}</span>
                <span className="font-mono text-violet-200/95 break-all">{r.label}</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {trashDisabledByParentInput && parentSites.length > 0 ? (
        <>
          <p className="mb-2 text-[10px] leading-snug text-slate-400">
            Rimuovi prima i collegamenti Subflow nei flow parent, oppure apri:
          </p>
          <ul className="max-h-44 space-y-1 overflow-y-auto text-[10px]">
            {parentSites.map((s) => (
              <li key={`${s.parentFlowId}:${s.canvasNodeId}:${s.subflowTaskId}`}>
                <button
                  type="button"
                  className="w-full rounded px-1 py-0.5 text-left font-mono text-[10px] text-sky-300/95 hover:bg-slate-800/80"
                  onClick={() => onNavigate(s)}
                >
                  {s.parentFlowTitle}
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </>
  );
}

function InterfaceVariableRow({
  zone,
  displayLabel,
  variableRefId,
  wireKey,
  flowId,
  projectId,
  flowMetaTranslations,
  onRemove,
  addTranslation,
  onRenamed,
  parentBindingSites,
  outputRemovalBlockedRefs,
  onNavigateToParentBindingSite,
}: {
  zone: 'input' | 'output';
  displayLabel: string;
  variableRefId: string;
  wireKey: string;
  flowId: string;
  projectId?: string;
  flowMetaTranslations: Record<string, string>;
  onRemove: () => void;
  addTranslation: (key: string, text: string) => void;
  onRenamed: () => void;
  parentBindingSites: ParentInterfaceBindingSite[];
  outputRemovalBlockedRefs: ReferenceLocation[] | undefined;
  onNavigateToParentBindingSite: (site: ParentInterfaceBindingSite) => void;
}) {
  const fullLabel = getVariableLabel(variableRefId, flowMetaTranslations);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(fullLabel);
  const lockRef = useRef<HTMLButtonElement>(null);
  const trashRef = useRef<HTMLButtonElement>(null);
  const lockHover = useSidebarHoverPortal();
  const trashHover = useSidebarHoverPortal();

  const trashDisabledByGuidRefs =
    zone === 'output' &&
    outputRemovalBlockedRefs !== undefined &&
    outputRemovalBlockedRefs.length > 0;
  const trashDisabledByParentInput = zone === 'input' && parentBindingSites.length > 0;
  const trashDisabled = trashDisabledByGuidRefs || trashDisabledByParentInput;
  const showLock = parentBindingSites.length > 0;

  React.useEffect(() => {
    setDraft(getVariableLabel(variableRefId, flowMetaTranslations));
  }, [variableRefId, flowMetaTranslations]);

  const pid = String(projectId || '').trim();

  const commit = useCallback(() => {
    const t = draft.trim();
    const current = getVariableLabel(variableRefId, flowMetaTranslations);
    if (!t || t === current) {
      setDraft(current);
      setEditing(false);
      return;
    }
    const ok = variableCreationService.renameVariableById(pid, variableRefId, t);
    if (ok) {
      addTranslation(makeTranslationKey('var', variableRefId), t);
      onRenamed();
    } else {
      setDraft(current);
    }
    setEditing(false);
  }, [draft, variableRefId, flowMetaTranslations, pid, addTranslation, onRenamed]);

  const cancel = useCallback(() => {
    setDraft(getVariableLabel(variableRefId, flowMetaTranslations));
    setEditing(false);
  }, [variableRefId, flowMetaTranslations]);

  return (
    <li
      className="group/iface-row flex min-w-0 items-center gap-1 rounded px-1 py-1 hover:bg-slate-800/50"
      data-flow-iface-row=""
      data-path-key={wireKey}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', displayLabel);
        try {
          e.dataTransfer.setData(
            DND_FLOWROW_VAR,
            JSON.stringify({
              variableRefId,
              suggestedWireKey: wireKey,
              displayLabel,
            })
          );
        } catch {
          /* ignore */
        }
        e.dataTransfer.effectAllowed = 'move';
      }}
    >
      <Brackets className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden />
      {showLock ? (
        <>
          <button
            ref={lockRef}
            type="button"
            className="shrink-0 rounded p-0.5 text-amber-300/90 hover:bg-slate-800/80"
            aria-label="Legata nei flow parent — passa il mouse per i dettagli"
            onMouseEnter={lockHover.anchorEnter}
            onMouseLeave={lockHover.anchorLeave}
          >
            <Lock className="h-3 w-3" strokeWidth={2.2} aria-hidden />
          </button>
          <SidebarPortalTooltip
            anchorRef={lockRef}
            active={lockHover.active}
            panelEnter={lockHover.panelEnter}
            panelLeave={lockHover.panelLeave}
            className="border-amber-500/35"
          >
            <LockTooltipBody sites={parentBindingSites} onNavigate={onNavigateToParentBindingSite} />
          </SidebarPortalTooltip>
        </>
      ) : null}
      {editing ? (
        <div className="flex min-w-0 flex-1 items-center gap-0.5">
          <input
            className="min-w-0 flex-1 rounded border border-amber-500/45 bg-slate-950/90 px-1.5 py-0.5 text-[11px] text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-400/60"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commit();
              }
              if (e.key === 'Escape') {
                e.preventDefault();
                cancel();
              }
            }}
            autoFocus
            aria-label="Rinomina variabile"
          />
          <button
            type="button"
            className="shrink-0 rounded p-0.5 text-emerald-400 hover:bg-slate-800"
            title="Conferma"
            onMouseDown={(e) => e.preventDefault()}
            onClick={commit}
          >
            <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
          </button>
          <button
            type="button"
            className="shrink-0 rounded p-0.5 text-slate-400 hover:bg-slate-800 hover:text-red-400"
            title="Annulla"
            onMouseDown={(e) => e.preventDefault()}
            onClick={cancel}
          >
            <X className="h-3.5 w-3.5" strokeWidth={2.5} />
          </button>
        </div>
      ) : (
        <>
          <span className="min-w-0 flex-1 truncate text-[11px] text-slate-100" title={fullLabel}>
            {displayLabel}
          </span>
          <button
            type="button"
            className="shrink-0 rounded p-0.5 text-slate-500 opacity-0 hover:bg-slate-700 hover:text-amber-200 group-hover/iface-row:opacity-100"
            title="Rinomina"
            aria-label="Rinomina"
            onClick={() => {
              setDraft(fullLabel);
              setEditing(true);
            }}
          >
            <Pencil className="h-3 w-3" strokeWidth={2} />
          </button>
          <div className="relative shrink-0">
            {trashDisabled ? (
              <>
                <button
                  ref={trashRef}
                  type="button"
                  className="shrink-0 rounded p-0.5 text-slate-500 opacity-50 cursor-not-allowed group-hover/iface-row:opacity-100"
                  aria-label={`Non è possibile rimuovere ${displayLabel} dall'interfaccia. Passa il mouse per i dettagli.`}
                  onMouseEnter={trashHover.anchorEnter}
                  onMouseLeave={trashHover.anchorLeave}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
                <SidebarPortalTooltip
                  anchorRef={trashRef}
                  active={trashHover.active}
                  panelEnter={trashHover.panelEnter}
                  panelLeave={trashHover.panelLeave}
                  className="border-violet-500/40"
                >
                  <TrashBlockedTooltipBody
                    trashDisabledByGuidRefs={trashDisabledByGuidRefs}
                    trashDisabledByParentInput={trashDisabledByParentInput}
                    blockedRefs={outputRemovalBlockedRefs}
                    parentSites={parentBindingSites}
                    onNavigate={onNavigateToParentBindingSite}
                  />
                </SidebarPortalTooltip>
              </>
            ) : (
              <button
                type="button"
                className="shrink-0 rounded p-0.5 text-slate-600 opacity-0 hover:bg-slate-700 hover:text-red-400 group-hover/iface-row:opacity-100"
                title="Rimuovi dall'interfaccia"
                aria-label={`Rimuovi ${displayLabel}`}
                onClick={onRemove}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            )}
          </div>
        </>
      )}
    </li>
  );
}
