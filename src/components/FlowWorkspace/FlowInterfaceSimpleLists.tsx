/**
 * Liste Input/Output per il pannello laterale flow: stesso stile delle altre sezioni (collassabile + righe),
 * senza MappingBlock / FlowMappingTree. Persistenza: meta.flowInterface.
 */

import React, { useCallback, useMemo, useState } from 'react';
import { Brackets, Check, Pencil, Trash2, X } from 'lucide-react';
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
import { variableCreationService } from '../../services/VariableCreationService';
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
        hint="Parametri in ingresso. Trascina variabili dalla sezione Variabili o righe dal canvas (la riga resta sul nodo)."
        onDragOver={onDragOver}
        onDrop={makeDrop(onDropVariableInput)}
        onRemoveEntry={removeInput}
        projectId={projectId}
        workspaceFlows={workspaceFlows}
        flowMetaTranslations={flowMetaTranslations}
        addTranslation={addTranslation}
        onRenamed={refresh}
      />
      <InterfaceZoneCollapsible
        title="Output"
        zone="output"
        flowId={flowId}
        entries={sortedOut}
        hint="Valori esposti in uscita. Stesso trascinamento della sezione Input."
        onDragOver={onDragOver}
        onDrop={makeDrop(onDropVariableOutput)}
        onRemoveEntry={removeOutput}
        projectId={projectId}
        workspaceFlows={workspaceFlows}
        flowMetaTranslations={flowMetaTranslations}
        addTranslation={addTranslation}
        onRenamed={refresh}
      />
    </div>
  );
}

function InterfaceZoneCollapsible({
  title,
  zone,
  flowId,
  entries,
  hint,
  onDragOver,
  onDrop,
  onRemoveEntry,
  projectId,
  workspaceFlows,
  flowMetaTranslations,
  addTranslation,
  onRenamed,
}: {
  title: string;
  zone: 'input' | 'output';
  flowId: string;
  entries: MappingEntry[];
  hint: string;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onRemoveEntry: (entryId: string) => void;
  projectId?: string;
  workspaceFlows: WorkspaceState['flows'];
  flowMetaTranslations: Record<string, string>;
  addTranslation: (key: string, text: string) => void;
  onRenamed: () => void;
}) {
  const borderAccent = zone === 'input' ? 'border-sky-600/35' : 'border-violet-600/35';

  return (
    <CollapsiblePanelSection
      title={title}
      defaultOpen
      className="min-h-0 shrink-0"
      contentClassName="min-h-0 flex flex-col gap-2 overflow-hidden px-1 pb-2"
    >
      <p className="px-0.5 text-[10px] leading-snug text-slate-500">{hint}</p>
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
                  displayLabel={label}
                  variableRefId={vid}
                  wireKey={entry.wireKey}
                  flowId={flowId}
                  projectId={projectId}
                  flowMetaTranslations={flowMetaTranslations}
                  onRemove={() => onRemoveEntry(entry.id)}
                  addTranslation={addTranslation}
                  onRenamed={onRenamed}
                />
              );
            })}
          </ul>
        )}
      </div>
    </CollapsiblePanelSection>
  );
}

function InterfaceVariableRow({
  displayLabel,
  variableRefId,
  wireKey,
  flowId,
  projectId,
  flowMetaTranslations,
  onRemove,
  addTranslation,
  onRenamed,
}: {
  displayLabel: string;
  variableRefId: string;
  wireKey: string;
  flowId: string;
  projectId?: string;
  flowMetaTranslations: Record<string, string>;
  onRemove: () => void;
  addTranslation: (key: string, text: string) => void;
  onRenamed: () => void;
}) {
  const fullLabel = getVariableLabel(variableRefId, flowMetaTranslations);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(fullLabel);

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
          <button
            type="button"
            className="shrink-0 rounded p-0.5 text-slate-600 opacity-0 hover:bg-slate-700 hover:text-red-400 group-hover/iface-row:opacity-100"
            title="Rimuovi dall'interfaccia"
            aria-label={`Rimuovi ${displayLabel}`}
            onClick={onRemove}
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </>
      )}
    </li>
  );
}
