/**
 * Sezioni Input/Output del flow (meta.flowInterface) nel pannello laterale unico.
 * Gestisce drop da canvas, validazione rimozione output e sync subflow parent.
 */

import React, { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { useInMemoryConditions } from '../../context/InMemoryConditionsContext';
import { useProjectTranslations } from '../../context/ProjectTranslationsContext';
import { FlowWorkspaceSnapshot } from '../../flows/FlowWorkspaceSnapshot';
import { flowWorkspaceMetaTranslationsFingerprint } from '../../utils/compileWorkspaceTranslations';
import { getFlowMetaTranslationsFlattened } from '../../utils/activeFlowTranslations';
import { useFlowActions, useFlowWorkspace } from '@flows/FlowStore';
import {
  collectParentBindingSitesForChildInterfaceVariable,
  type ParentInterfaceBindingSite,
} from '../../services/childFlowInterfaceParentBindings';
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
  const { updateFlowMeta, setActiveFlow } = useFlowActions();

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

  const outputRemovalBlockedByVarId = useMemo(() => {
    const m = new Map<string, ReferenceLocation[]>();
    const pid = String(projectId || '').trim();
    if (!pid) return m;
    for (const e of iface.output) {
      const vid = String(e.variableRefId || '').trim();
      if (!vid) continue;
      const v = validateRemovalOfInterfaceOutputRow(
        pid,
        flowId,
        vid,
        flows as any,
        translations,
        conditionPayloads
      );
      if (!v.ok) m.set(vid, v.references);
    }
    return m;
  }, [projectId, flowId, flows, iface.output, translations, conditionPayloads]);

  const parentBindingSitesByVarId = useMemo(() => {
    const m = new Map<string, ParentInterfaceBindingSite[]>();
    const ids = new Set<string>();
    for (const e of iface.input) {
      const v = String(e.variableRefId || '').trim();
      if (v) ids.add(v);
    }
    for (const e of iface.output) {
      const v = String(e.variableRefId || '').trim();
      if (v) ids.add(v);
    }
    for (const vid of ids) {
      m.set(vid, collectParentBindingSitesForChildInterfaceVariable(flowId, vid, flows as any));
    }
    return m;
  }, [flowId, flows, iface.input, iface.output]);

  const navigateToParentBindingSite = useCallback(
    (site: ParentInterfaceBindingSite) => {
      const fid = String(site.parentFlowId || '').trim();
      const nid = String(site.canvasNodeId || '').trim();
      if (!fid || !nid) return;
      setActiveFlow(fid);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          try {
            document.dispatchEvent(
              new CustomEvent('flowchart:centerViewportOnNode', {
                bubbles: true,
                detail: { flowId: fid, nodeId: nid },
              })
            );
          } catch {
            /* noop */
          }
        });
      });
    },
    [setActiveFlow]
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
        outputRemovalBlockedByVarId={outputRemovalBlockedByVarId}
        parentBindingSitesByVarId={parentBindingSitesByVarId}
        onNavigateToParentBindingSite={navigateToParentBindingSite}
      />
    </div>
  );
}
