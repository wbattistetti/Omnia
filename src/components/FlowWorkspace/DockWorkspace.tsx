import React from 'react';
import { FlowWorkspaceProvider, useFlowActions, useFlowWorkspace } from '../../flows/FlowStore.tsx';
import { FlowCanvasHost } from './FlowCanvasHost';
import { FlowTabBar } from './FlowTabBar';
import { dlog } from '../../utils/debug';

type LayoutMode = 'single' | 'twoCols' | 'twoRows' | 'grid2x2';
type PaneKey = 'tl' | 'tr' | 'bl' | 'br';
type PaneMap = Partial<Record<PaneKey, string>>;
type DockRegion = 'left' | 'right' | 'top' | 'bottom' | 'center';

function computeRegion(e: React.DragEvent<HTMLDivElement>): DockRegion {
  const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const w = rect.width;
  const h = rect.height;
  const left = x < w * 0.33;
  const right = x > w * 0.67;
  const top = y < h * 0.33;
  const bottom = y > h * 0.67;
  if (!left && !right && !top && !bottom) return 'center';
  if (left) return 'left';
  if (right) return 'right';
  if (top) return 'top';
  if (bottom) return 'bottom';
  return 'center';
}

const Pane: React.FC<{ title: string; onDropFlow: (fid: string, region: DockRegion) => void; children?: React.ReactNode }> = ({ title, onDropFlow, children }) => {
  const [region, setRegion] = React.useState<DockRegion | null>(null);
  const hostRef = React.useRef<HTMLDivElement>(null);

  const overlayRect = React.useMemo(() => {
    if (!region || !hostRef.current) return null;
    const r = hostRef.current.getBoundingClientRect();
    const w = r.width, h = r.height;
    const rects: Record<DockRegion, {x:number;y:number;w:number;h:number}> = {
      left: { x: 0, y: 0, w: w * 0.5, h },
      right: { x: w * 0.5, y: 0, w: w * 0.5, h },
      top: { x: 0, y: 0, w, h: h * 0.5 },
      bottom: { x: 0, y: h * 0.5, w, h: h * 0.5 },
      center: { x: w * 0.15, y: h * 0.15, w: w * 0.7, h: h * 0.7 }
    };
    return rects[region];
  }, [region]);

  return (
    <div
      ref={hostRef}
      className="relative border border-slate-200 rounded h-full flex flex-col min-h-0"
      onDragOver={(e) => { e.preventDefault(); setRegion(computeRegion(e)); }}
      onDragLeave={() => setRegion(null)}
      onDrop={(e) => {
        const fid = e.dataTransfer.getData('text/flow-id');
        if (fid && region) onDropFlow(fid, region);
        setRegion(null);
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
      {overlayRect && (
        <div className="pointer-events-none absolute inset-0">
          <div
            className="absolute"
            style={{
              left: overlayRect.x,
              top: overlayRect.y,
              width: overlayRect.w,
              height: overlayRect.h,
              background: 'rgba(59,130,246,0.18)',
              border: '1px solid rgba(59,130,246,0.9)'
            }}
          />
        </div>
      )}
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

  const attachWithRegion = (defaultKey: PaneKey, region: DockRegion, fid: string) => {
    // Mapping semplice per layout: scegli il pane coerente
    if (mode === 'twoCols') {
      const key = region === 'right' ? 'tr' : 'tl';
      attach(key, fid);
      return;
    }
    if (mode === 'twoRows') {
      const key = region === 'bottom' ? 'bl' : 'tl';
      attach(key, fid);
      return;
    }
    if (mode === 'grid2x2') {
      let key: PaneKey = defaultKey;
      if (region === 'left' || region === 'top') key = defaultKey === 'tr' || defaultKey === 'br' ? (defaultKey === 'tr' ? 'tl' : 'bl') : defaultKey;
      if (region === 'right') key = defaultKey === 'tl' || defaultKey === 'bl' ? (defaultKey === 'tl' ? 'tr' : 'br') : defaultKey;
      if (region === 'bottom') key = defaultKey === 'tl' || defaultKey === 'tr' ? (defaultKey === 'tl' ? 'bl' : 'br') : defaultKey;
      attach(key, fid);
      return;
    }
    // single: sempre tl
    attach('tl', fid);
  };

  const grid = (() => {
    switch (mode) {
      case 'single':
        return (
          <div className="flex-1 min-h-0 h-full">
            <Pane title="Main" onDropFlow={(fid, region) => attachWithRegion('tl', region, fid)}>
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
          </div>
        );
      case 'twoCols':
        return (
          <div className="grid grid-cols-2 gap-2 flex-1 min-h-0">
            <Pane title="Left" onDropFlow={(fid, region) => attachWithRegion('tl', region, fid)}>
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
            <Pane title="Right" onDropFlow={(fid, region) => attachWithRegion('tr', region, fid)}>
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
            <Pane title="Top" onDropFlow={(fid, region) => attachWithRegion('tl', region, fid)}>
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
            <Pane title="Bottom" onDropFlow={(fid, region) => attachWithRegion('bl', region, fid)}>
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
            <Pane title="Top Left" onDropFlow={(fid, region) => attachWithRegion('tl', region, fid)}>
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
            <Pane title="Top Right" onDropFlow={(fid, region) => attachWithRegion('tr', region, fid)}>
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
            <Pane title="Bottom Left" onDropFlow={(fid, region) => attachWithRegion('bl', region, fid)}>
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
            <Pane title="Bottom Right" onDropFlow={(fid, region) => attachWithRegion('br', region, fid)}>
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


