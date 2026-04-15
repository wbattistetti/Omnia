/**
 * Sezioni Input/Output del flow (meta.flowInterface) nel pannello laterale unico.
 * Gestisce drop da canvas, validazione rimozione output e sync subflow parent.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useInMemoryConditions } from '../../context/InMemoryConditionsContext';
import { useProjectTranslations } from '../../context/ProjectTranslationsContext';
import { FlowWorkspaceSnapshot } from '../../flows/FlowWorkspaceSnapshot';
import { flowWorkspaceMetaTranslationsFingerprint } from '../../utils/compileWorkspaceTranslations';
import { getFlowMetaTranslationsFlattened } from '../../utils/activeFlowTranslations';
import { useFlowActions, useFlowWorkspace } from '@flows/FlowStore';
import { ensureFlowVariableBindingForInterfaceRow, shouldSkipInterfaceDuplicate } from '../FlowMappingPanel/interfaceMappingLabels';
import { FlowInterfaceSimpleLists } from './FlowInterfaceSimpleLists';
import {
  FLOW_INTERFACE_ROW_POINTER_DROP,
  type FlowInterfaceRowPointerDropDetail,
  stableInterfacePathForVariable,
} from '../FlowMappingPanel/flowInterfaceDragTypes';
import { createMappingEntry, type MappingEntry } from '../FlowMappingPanel/mappingTypes';
import { insertInterfaceEntryAt } from '../FlowMappingPanel/mappingTreeUtils';
import { syncSubflowChildInterfaceToAllParents } from '../../services/subflowProjectSync';
import { invalidateChildFlowInterfaceCache } from '../../services/childFlowInterfaceService';
import {
  validateRemovalOfInterfaceOutputRow,
  type ReferenceLocation,
} from '../../services/subflowVariableReferenceScan';

export interface FlowInterfaceSideSectionsProps {
  flowId: string;
  projectId?: string;
  /** Es. bump refresh nel rail dopo rinomina variabile. */
  onVariableMetadataChange?: () => void;
}

export function FlowInterfaceSideSections({ flowId, projectId, onVariableMetadataChange }: FlowInterfaceSideSectionsProps) {
  const { flows } = useFlowWorkspace();
  const { translations, addTranslation, flowTranslationRevision } = useProjectTranslations();
  const flowMetaFp = useSyncExternalStore(
    (onStoreChange) => FlowWorkspaceSnapshot.subscribe(onStoreChange),
    flowWorkspaceMetaTranslationsFingerprint,
    flowWorkspaceMetaTranslationsFingerprint
  );
  const flowMetaTranslations = useMemo(
    () => getFlowMetaTranslationsFlattened(flowId),
    [flowId, flowMetaFp, flowTranslationRevision]
  );
  const { conditions } = useInMemoryConditions();
  const flowsRef = useRef(flows);
  flowsRef.current = flows;
  const { updateFlowMeta } = useFlowActions();
  const [removalBlockRefs, setRemovalBlockRefs] = useState<ReferenceLocation[] | null>(null);

  const flow = flows[flowId];
  const iface = flow?.meta?.flowInterface ?? { input: [] as MappingEntry[], output: [] as MappingEntry[] };

  const conditionPayloads = useMemo(
    () =>
      conditions.map((c) => ({
        id: c.id,
        label: c.label || c.name || c.id,
        text: JSON.stringify(c),
      })),
    [conditions]
  );

  const setInput = useCallback(
    (next: MappingEntry[]) => {
      const out = flows[flowId]?.meta?.flowInterface?.output ?? [];
      updateFlowMeta(flowId, { flowInterface: { input: next, output: out } });
    },
    [flowId, flows, updateFlowMeta]
  );

  const setOutput = useCallback(
    (next: MappingEntry[]) => {
      const pid = String(projectId || '').trim();
      const prevOut = flowsRef.current[flowId]?.meta?.flowInterface?.output ?? [];
      if (pid) {
        for (const p of prevOut) {
          const pvid = String(p.variableRefId || '').trim();
          if (!pvid) continue;
          const stillExists = next.some((n) => String(n.variableRefId || '').trim() === pvid);
          if (!stillExists) {
            const v = validateRemovalOfInterfaceOutputRow(
              pid,
              flowId,
              pvid,
              flowsRef.current as any,
              translations,
              conditionPayloads
            );
            if (!v.ok) {
              setRemovalBlockRefs(v.references);
              return;
            }
          }
        }
      }
      const inn = flowsRef.current[flowId]?.meta?.flowInterface?.input ?? [];
      updateFlowMeta(flowId, { flowInterface: { input: inn, output: next } });
      const curr = flowsRef.current[flowId];
      const merged = {
        ...flowsRef.current,
        [flowId]: {
          ...curr,
          meta: {
            ...(typeof curr?.meta === 'object' && curr?.meta ? curr.meta : {}),
            flowInterface: { input: inn, output: next },
          },
        },
      } as typeof flowsRef.current;
      if (pid) {
        invalidateChildFlowInterfaceCache(pid, flowId);
        void syncSubflowChildInterfaceToAllParents(pid, flowId, merged as any);
      }
    },
    [flowId, projectId, translations, conditionPayloads, updateFlowMeta]
  );

  useEffect(() => {
    const handler = (ev: Event) => {
      const e = ev as CustomEvent<FlowInterfaceRowPointerDropDetail>;
      const d = e.detail;
      if (!d || d.flowId !== flowId) return;
      const zone = d.zone === 'input' ? 'input' : 'output';
      const ids = d.variableRefIds?.length ? d.variableRefIds : [d.variableRefId];
      const trimmed = ids.map((x) => String(x || '').trim()).filter(Boolean);
      if (trimmed.length === 0) return;

      const ifaceLocal = flowsRef.current[flowId]?.meta?.flowInterface ?? {
        input: [] as MappingEntry[],
        output: [] as MappingEntry[],
      };
      let nextIn = ifaceLocal.input;
      let nextOut = ifaceLocal.output;
      let insertTarget = d.insertTargetPathKey ?? null;
      let insertPlacement = d.insertPlacement ?? 'append';

      for (let i = 0; i < trimmed.length; i += 1) {
        const variableRefId = trimmed[i]!;
        ensureFlowVariableBindingForInterfaceRow(projectId, flowId, variableRefId);
        const path = stableInterfacePathForVariable(variableRefId);
        const entry = createMappingEntry({
          wireKey: path,
          variableRefId,
        });
        if (zone === 'input') {
          if (shouldSkipInterfaceDuplicate(nextIn, entry)) continue;
          nextIn = insertInterfaceEntryAt(nextIn, entry, insertTarget, insertPlacement);
        } else {
          if (shouldSkipInterfaceDuplicate(nextOut, entry)) continue;
          nextOut = insertInterfaceEntryAt(nextOut, entry, insertTarget, insertPlacement);
        }
        insertTarget = path;
        insertPlacement = 'after';
      }

      updateFlowMeta(flowId, {
        flowInterface: { input: nextIn, output: nextOut },
      });
      const pid = String(projectId || '').trim();
      if (pid) {
        const shell = flowsRef.current[flowId];
        const merged = {
          ...flowsRef.current,
          [flowId]: {
            ...shell,
            meta: {
              ...(typeof shell?.meta === 'object' && shell?.meta ? shell.meta : {}),
              flowInterface: { input: nextIn, output: nextOut },
            },
          },
        } as typeof flowsRef.current;
        invalidateChildFlowInterfaceCache(pid, flowId);
        void syncSubflowChildInterfaceToAllParents(pid, flowId, merged as any);
      }
    };
    window.addEventListener(FLOW_INTERFACE_ROW_POINTER_DROP, handler as EventListener);
    return () => window.removeEventListener(FLOW_INTERFACE_ROW_POINTER_DROP, handler as EventListener);
  }, [flowId, projectId, updateFlowMeta]);

  return (
    <>
      {removalBlockRefs !== null ? (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/55 p-4 pointer-events-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="iface-removal-block-title"
        >
          <div className="max-w-md w-full rounded-lg border border-violet-500/35 bg-[#0f1218] p-4 shadow-xl text-slate-100">
            <h3 id="iface-removal-block-title" className="text-sm font-semibold mb-2">
              Impossibile rimuovere questo output
            </h3>
            <p className="text-xs text-slate-400 mb-3">
              La variabile nel flow parent (collegamento Subflow) è ancora referenziata con token [GUID] nei punti seguenti.
              Rimuovi quei riferimenti, poi riprova.
            </p>
            <ul className="text-xs max-h-52 overflow-y-auto space-y-1.5 border border-slate-700/80 rounded-md p-2 mb-4 bg-black/20">
              {removalBlockRefs.map((r) => (
                <li key={`${r.kind}:${r.id}`} className="flex flex-col gap-0.5">
                  <span className="text-[10px] uppercase tracking-wide text-slate-500">{r.kind}</span>
                  <span className="font-mono text-violet-200/95 break-all">{r.label}</span>
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="rounded-md bg-violet-600/90 hover:bg-violet-500 px-3 py-1.5 text-xs font-medium text-white"
              onClick={() => setRemovalBlockRefs(null)}
            >
              OK
            </button>
          </div>
        </div>
      ) : null}

      <div className="pointer-events-auto flex min-h-0 min-w-0 shrink-0 flex-col overflow-hidden">
        <FlowInterfaceSimpleLists
          flowId={flowId}
          projectId={projectId}
          flowMetaTranslations={flowMetaTranslations}
          addTranslation={addTranslation}
          workspaceFlows={flows}
          interfaceInput={iface.input}
          interfaceOutput={iface.output}
          onInterfaceInputChange={setInput}
          onInterfaceOutputChange={setOutput}
          onVariableMetadataChange={onVariableMetadataChange}
        />
      </div>
    </>
  );
}
