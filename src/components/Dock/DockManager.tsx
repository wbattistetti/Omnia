import React from 'react';
import { DockNode, DockRegion, DockTab } from '../../dock/types';
import { splitWithTab, addTabCenter, closeTab, activateTab, moveTab, getTab, removeTab } from '../../dock/ops';
import { Workflow } from 'lucide-react';

type Props = {
  root: DockNode;
  setRoot: (n: DockNode) => void;
  renderTabContent: (tab: DockTab) => React.ReactNode;
};

export const DockManager: React.FC<Props> = ({ root, setRoot, renderTabContent }) => {
  const [dragTab, setDragTab] = React.useState<DockTab | null>(null);
  const [closedTabs, setClosedTabs] = React.useState<DockTab[]>([]);
  const [activeTabSetId, setActiveTabSetId] = React.useState<string>('ts_main');
  const [hoverTarget, setHoverTarget] = React.useState<{ tabsetId: string; region: DockRegion } | null>(null);

  const onDropTo = (tabsetId: string, region: DockRegion) => {
    if (!dragTab) return;
    setRoot(moveTab(root, dragTab.id, tabsetId, region));
    setDragTab(null);
    setHoverTarget(null);
  };

  return (
    <div className="flex w-full h-full min-h-0">
      {/* Shelf globale */}
      {closedTabs.length > 0 && (
        <div className="flex items-center gap-1 px-2 py-1 border-b bg-slate-50">
          <span className="text-[11px] text-slate-500">Closed:</span>
          {closedTabs.map(t => (
            <button key={t.id} className="px-2 py-0.5 text-[11px] rounded border bg-white hover:bg-slate-100"
              onClick={() => {
                // riapri nella tabset attiva
                setRoot(addTabCenter(root, activeTabSetId, t));
                setClosedTabs(prev => prev.filter(x => x.id !== t.id));
              }}>
              {t.title}
            </button>
          ))}
        </div>
      )}

      <DockRenderer
        node={root}
        onDragTabStart={(tab) => setDragTab(tab)}
        onDragTabEnd={() => { setDragTab(null); setHoverTarget(null); }}
        onHover={(tabsetId, region) => setHoverTarget({ tabsetId, region })}
        onDrop={onDropTo}
        hover={hoverTarget}
        renderTabContent={renderTabContent}
        setRoot={setRoot}
        setActiveTabSetId={setActiveTabSetId}
        onTabClosed={(tab) => {
          if (!tab) return;
          setClosedTabs(prev => (prev.find(x => x.id === tab.id) ? prev : [...prev, tab]));
        }}
        rootNode={root}
      />
    </div>
  );
};

function DockRenderer(props: {
  node: DockNode;
  rootNode: DockNode;
  onDragTabStart: (tab: DockTab) => void;
  onDragTabEnd: () => void;
  onHover: (tabsetId: string, region: DockRegion) => void;
  onDrop: (tabsetId: string, region: DockRegion) => void;
  hover: { tabsetId: string; region: DockRegion } | null;
  renderTabContent: (tab: DockTab) => React.ReactNode;
  setRoot: (n: DockNode) => void;
  setActiveTabSetId: (id: string) => void;
  onTabClosed: (tab: DockTab | null) => void;
}) {
  const { node } = props;
  if (node.kind === 'split') {
    const cls = node.orientation === 'row' ? 'flex flex-row gap-2 w-full h-full' : 'flex flex-col gap-2 w-full h-full';
    return (
      <div className={cls} style={{ minHeight: 0, minWidth: 0 }}>
        {node.children.map((c) => (
          <div key={c.id} className="flex-1 min-w-0 min-h-0">
            <DockRenderer {...props} node={c} />
          </div>
        ))}
      </div>
    );
  }
  return (
    <TabSet
      nodeId={node.id}
      tabs={node.tabs}
      active={node.active}
      setActive={(idx) => { props.setActiveTabSetId(node.id); props.setRoot(activateTab(props.rootNode, node.tabs[idx].id)); }}
      onClose={(tabId) => {
        // Chiudi la tab nel suo tabset; non spostarla automaticamente altrove.
        // Delego all'header "Closed" (shelf) la riapertura esplicita.
        const t = getTab(props.rootNode, tabId);
        if (t) props.onTabClosed(t);
        props.setRoot(closeTab(props.rootNode, tabId));
      }}
      onDragTabStart={props.onDragTabStart}
      onDragTabEnd={props.onDragTabEnd}
      onHover={props.onHover}
      onDrop={props.onDrop}
      hover={props.hover}
      renderTabContent={props.renderTabContent}
    />
  );
}

function TabSet(props: {
  nodeId: string;
  tabs: DockTab[];
  active: number;
  setActive: (idx: number) => void;
  onClose: (tabId: string) => void;
  onDragTabStart: (tab: DockTab) => void;
  onDragTabEnd: () => void;
  onHover: (tabsetId: string, region: DockRegion) => void;
  onDrop: (tabsetId: string, region: DockRegion) => void;
  hover: { tabsetId: string; region: DockRegion } | null;
  renderTabContent: (tab: DockTab) => React.ReactNode;
}) {
  const hostRef = React.useRef<HTMLDivElement>(null);
  const [region, setRegion] = React.useState<DockRegion | null>(null);

  const computeRegion = (e: React.DragEvent<HTMLDivElement>): DockRegion => {
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const x = e.clientX - rect.left; const y = e.clientY - rect.top; const w = rect.width; const h = rect.height;
    const left = x < w * 0.33, right = x > w * 0.67, top = y < h * 0.33, bottom = y > h * 0.67;
    if (!left && !right && !top && !bottom) return 'center';
    if (left) return 'left'; if (right) return 'right'; if (top) return 'top'; if (bottom) return 'bottom';
    return 'center';
  };

  return (
    <div
      ref={hostRef}
      className="relative w-full h-full rounded min-h-0"
      style={{ border: '1px solid #38bdf8', backgroundColor: '#e0f2fe' }}
      onDragOver={(e) => { e.preventDefault(); const r = computeRegion(e); setRegion(r); props.onHover(props.nodeId, r); }}
      onDragLeave={() => { setRegion(null); props.onHover(props.nodeId, 'center'); }}
      onDrop={(e) => { const r = region || 'center'; props.onDrop(props.nodeId, r); setRegion(null); }}
    >
      <div className="flex items-center gap-1 px-2 border-b"
           style={{ backgroundColor: '#e0f2fe', borderColor: '#38bdf8', height: 40 }}>
        {props.tabs.map((t, i) => (
          <div key={t.id}
            draggable
            onDragStart={() => props.onDragTabStart(t)}
            onDragEnd={props.onDragTabEnd}
            onClick={() => props.setActive(i)}
            className="px-2 py-0.5 text-xs rounded border cursor-grab flex items-center gap-1"
            style={{
              backgroundColor: props.active===i ? '#bae6fd' : '#ffffff',
              borderColor: '#38bdf8',
              color: '#0c4a6e'
            }}>
            {/* icona diagramma lucide */}
            <Workflow size={14} color="#0c4a6e" />
            <span style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>{t.title}</span>
            <button className="ml-1" style={{ color: '#0c4a6e' }} onClick={(e) => { e.stopPropagation(); props.onClose(t.id); }}>×</button>
          </div>
        ))}
      </div>
      <div className="w-full min-h-0" style={{ height: 'calc(100% - 40px)', backgroundColor: '#ffffff' }}>
        {props.tabs[props.active] && props.renderTabContent(props.tabs[props.active])}
      </div>
      {!!region && (
        <div className="pointer-events-none absolute inset-0">
          <DockOverlay region={region} hostRef={hostRef} />
        </div>
      )}
    </div>
  );
}

function DockOverlay({ region, hostRef }: { region: DockRegion; hostRef: React.RefObject<HTMLDivElement> }) {
  const rect = hostRef.current?.getBoundingClientRect();
  if (!rect) return null;
  const w = rect.width, h = rect.height;
  const r: Record<DockRegion, { x:number;y:number;w:number;h:number }> = {
    left: { x: 0, y: 0, w: w * 0.5, h },
    right: { x: w * 0.5, y: 0, w: w * 0.5, h },
    top: { x: 0, y: 0, w, h: h * 0.5 },
    bottom: { x: 0, y: h * 0.5, w, h: h * 0.5 },
    center: { x: w * 0.15, y: h * 0.15, w: w * 0.7, h: h * 0.7 }
  };
  const o = r[region];
  return (
    <div className="absolute" style={{
      left: o.x, top: o.y, width: o.w, height: o.h,
      background: 'rgba(59,130,246,0.18)', border: '1px solid rgba(59,130,246,0.9)'
    }} />
  );
}


