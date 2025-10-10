import React from 'react';
import { FlowWorkspaceProvider, useFlowActions, useFlowWorkspace } from '../../flows/FlowStore.tsx';
import { FlowCanvasHost } from './FlowCanvasHost';
import { FlowTabBar } from './FlowTabBar';
import { dlog } from '../../utils/debug';

type LayoutMode = 'single' | 'twoCols' | 'twoRows' | 'grid2x2';
type PaneKey = 'tl' | 'tr' | 'bl' | 'br';
type PaneMap = Partial<Record<PaneKey, string>>;

const Pane: React.FC<{ title: string; onDropFlow: (fid: string) => void; children?: React.ReactNode }> = ({ title, onDropFlow, children }) => {
  return (
    <div
      className="relative border border-slate-200 rounded h-full flex flex-col min-h-0"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        const fid = e.dataTransfer.getData('text/flow-id');
        if (fid) onDropFlow(fid);
      }}
      style={{ minWidth: 200, minHeight: 160, background: '#fff' }}
    >
      {!children && (
        <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-xs">
          {title} – Drop a flow here
        </div>
      )}
      <div className="flex-1 min-h-0 h-full">
        {children}
      </div>
    </div>
  );
};

const DockInner: React.FC<{ projectId: string }> = ({ projectId }) => {
  const { openFlows } = useFlowWorkspace();
  const { openFlowBackground, upsertFlow } = useFlowActions();
  const [mode, setMode] = React.useState<LayoutMode>('single');
  const [panes, setPanes] = React.useState<PaneMap>({ tl: 'main' });

  const attach = (key: PaneKey, fid: string) => {
    setPanes((p) => ({ ...p, [key]: fid }));
    openFlowBackground(fid);
    dlog('flow', '[dock.attach]', { key, fid });
  };

  const grid = (() => {
    switch (mode) {
      case 'single':
        return (
          <div className="flex-1 min-h-0 h-full">
            <Pane title="Main" onDropFlow={(fid) => attach('tl', fid)}>
              {panes.tl && <FlowCanvasHost projectId={projectId} flowId={panes.tl} />}
            </Pane>
          </div>
        );
      case 'twoCols':
        return (
          <div className="grid grid-cols-2 gap-2 flex-1 min-h-0">
            <Pane title="Left" onDropFlow={(fid) => attach('tl', fid)}>
              {panes.tl && (
                <FlowCanvasHost
                  projectId={projectId}
                  flowId={panes.tl}
                  onCreateTaskFlow={(fid, title, nodes, edges) => {
                    upsertFlow({ id: fid, title: title || 'Task', nodes, edges });
                    setTimeout(() => openFlowBackground(fid), 0);
                  }}
                />
              )}
            </Pane>
            <Pane title="Right" onDropFlow={(fid) => attach('tr', fid)}>
              {panes.tr && (
                <FlowCanvasHost
                  projectId={projectId}
                  flowId={panes.tr}
                  onCreateTaskFlow={(fid, title, nodes, edges) => {
                    upsertFlow({ id: fid, title: title || 'Task', nodes, edges });
                    setTimeout(() => openFlowBackground(fid), 0);
                  }}
                />
              )}
            </Pane>
          </div>
        );
      case 'twoRows':
        return (
          <div className="grid grid-rows-2 gap-2 flex-1 min-h-0">
            <Pane title="Top" onDropFlow={(fid) => attach('tl', fid)}>
              {panes.tl && (
                <FlowCanvasHost
                  projectId={projectId}
                  flowId={panes.tl}
                  onCreateTaskFlow={(fid, title, nodes, edges) => {
                    upsertFlow({ id: fid, title: title || 'Task', nodes, edges });
                    setTimeout(() => openFlowBackground(fid), 0);
                  }}
                />
              )}
            </Pane>
            <Pane title="Bottom" onDropFlow={(fid) => attach('bl', fid)}>
              {panes.bl && (
                <FlowCanvasHost
                  projectId={projectId}
                  flowId={panes.bl}
                  onCreateTaskFlow={(fid, title, nodes, edges) => {
                    upsertFlow({ id: fid, title: title || 'Task', nodes, edges });
                    setTimeout(() => openFlowBackground(fid), 0);
                  }}
                />
              )}
            </Pane>
          </div>
        );
      default:
        return (
          <div className="grid grid-cols-2 grid-rows-2 gap-2 flex-1 min-h-0">
            <Pane title="Top Left" onDropFlow={(fid) => attach('tl', fid)}>
              {panes.tl && (
                <FlowCanvasHost
                  projectId={projectId}
                  flowId={panes.tl}
                  onCreateTaskFlow={(fid, title, nodes, edges) => {
                    upsertFlow({ id: fid, title: title || 'Task', nodes, edges });
                    setTimeout(() => openFlowBackground(fid), 0);
                  }}
                />
              )}
            </Pane>
            <Pane title="Top Right" onDropFlow={(fid) => attach('tr', fid)}>
              {panes.tr && (
                <FlowCanvasHost
                  projectId={projectId}
                  flowId={panes.tr}
                  onCreateTaskFlow={(fid, title, nodes, edges) => {
                    upsertFlow({ id: fid, title: title || 'Task', nodes, edges });
                    setTimeout(() => openFlowBackground(fid), 0);
                  }}
                />
              )}
            </Pane>
            <Pane title="Bottom Left" onDropFlow={(fid) => attach('bl', fid)}>
              {panes.bl && (
                <FlowCanvasHost
                  projectId={projectId}
                  flowId={panes.bl}
                  onCreateTaskFlow={(fid, title, nodes, edges) => {
                    upsertFlow({ id: fid, title: title || 'Task', nodes, edges });
                    setTimeout(() => openFlowBackground(fid), 0);
                  }}
                />
              )}
            </Pane>
            <Pane title="Bottom Right" onDropFlow={(fid) => attach('br', fid)}>
              {panes.br && (
                <FlowCanvasHost
                  projectId={projectId}
                  flowId={panes.br}
                  onCreateTaskFlow={(fid, title, nodes, edges) => {
                    upsertFlow({ id: fid, title: title || 'Task', nodes, edges });
                    setTimeout(() => openFlowBackground(fid), 0);
                  }}
                />
              )}
            </Pane>
          </div>
        );
    }
  })();

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-2 py-1 border-b bg-white">
        <FlowTabBar />
        <div className="ml-auto flex items-center gap-1">
          <span className="text-xs text-slate-500">Layout:</span>
          <select
            className="text-xs border border-slate-300 rounded px-1 py-0.5"
            value={mode}
            onChange={(e) => setMode(e.target.value as LayoutMode)}
          >
            <option value="single">Single</option>
            <option value="twoCols">2 Columns</option>
            <option value="twoRows">2 Rows</option>
            <option value="grid2x2">2x2 Grid</option>
          </select>
        </div>
      </div>
      <div className="p-2 flex-1 min-h-0">{grid}</div>
    </div>
  );
};

export const DockWorkspace: React.FC<{ projectId: string }> = ({ projectId }) => {
  return (
    <FlowWorkspaceProvider>
      <DockInner projectId={projectId} />
    </FlowWorkspaceProvider>
  );
};


