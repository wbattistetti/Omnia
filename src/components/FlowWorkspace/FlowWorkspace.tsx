import React, { useEffect } from 'react';
import { FlowWorkspaceProvider, useFlowWorkspace, useFlowActions } from '../../flows/FlowStore.tsx';
import { FlowTabBar } from './FlowTabBar';
import { loadFlow, saveFlow } from '../../flows/FlowPersistence';
import { dlog } from '../../utils/debug';
import { FlowEditor } from '../Flowchart/FlowEditor';
import { useProjectDataUpdate } from '../../context/ProjectDataContext';

// Adapter: renderizza l'attuale FlowEditor per activeFlowId con nodes/edges del workspace
const FlowHost: React.FC<{ projectId: string }> = ({ projectId }) => {
  const { activeFlowId, flows } = useFlowWorkspace();
  const { upsertFlow, updateFlowGraph, openFlow, openFlowBackground } = useFlowActions();
  const pdUpdate = useProjectDataUpdate();
  const isDraft = (() => { try { return pdUpdate.isDraft(); } catch { return false; } })();

  // Lazy load del flusso se non presente
  useEffect(() => {
    (async () => {
      if (!flows[activeFlowId] || (flows[activeFlowId].nodes?.length === 0 && flows[activeFlowId].edges?.length === 0)) {
        if (isDraft) {
          upsertFlow({ id: activeFlowId, title: activeFlowId === 'main' ? 'Main' : activeFlowId, nodes: [], edges: [] });
          dlog('flow', '[workspace.loaded][draft]', { projectId, activeFlowId });
        } else {
          const data = await loadFlow(projectId, activeFlowId);
          upsertFlow({ id: activeFlowId, title: activeFlowId === 'main' ? 'Main' : activeFlowId, nodes: data.nodes, edges: data.edges });
          dlog('flow', '[workspace.loaded]', { projectId, activeFlowId, nodes: data.nodes.length, edges: data.edges.length });
        }
      }
    })();
  }, [activeFlowId, projectId, isDraft]);

  const flow = flows[activeFlowId];
  return (
    <div className="flex-1 h-full flex flex-col">
      <FlowTabBar />
      <div className="flex-1 min-h-0">
        {/* Riutilizzo FlowEditor per non toccare nulla: passa nodes/edges correnti e updater */}
        <FlowEditor
          nodes={flow?.nodes || []}
          edges={flow?.edges || []}
          setNodes={(updater: any) => updateFlowGraph(activeFlowId, (ns, es) => ({ nodes: typeof updater === 'function' ? updater(ns) : updater, edges: es }))}
          setEdges={(updater: any) => updateFlowGraph(activeFlowId, (ns, es) => ({ nodes: ns, edges: typeof updater === 'function' ? updater(es) : updater }))}
          currentProject={{ id: projectId, name: 'Project' } as any}
          setCurrentProject={() => {}}
          testPanelOpen={false}
          setTestPanelOpen={() => {}}
          testNodeId={null}
          setTestNodeId={() => {}}
          onPlayNode={() => {}}
          onCreateTaskFlow={(newFlowId, title, nodes, edges) => {
            dlog('flow', '[workspace.onCreateTaskFlow]', { newFlowId, title, nodes: nodes.length, edges: edges.length });
            const derivedTitle = (title && String(title).trim()) || 'Task';
            // Apri la tab in background per evitare flicker
            upsertFlow({ id: newFlowId, title: derivedTitle, nodes, edges });
            setTimeout(() => openFlowBackground(newFlowId), 0);
            if (!isDraft) {
              saveFlow(projectId, newFlowId, nodes, edges).catch((e) => {
                try { console.warn('[flow] save subflow failed (kept in memory)', e); } catch {}
              });
            }
          }}
        />
      </div>
    </div>
  );
};

export const FlowWorkspace: React.FC<{ projectId: string }> = ({ projectId }) => {
  return (
    <FlowWorkspaceProvider>
      <FlowHost projectId={projectId} />
    </FlowWorkspaceProvider>
  );
};


