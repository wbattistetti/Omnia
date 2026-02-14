import React from 'react';
import { DockNode, DockRegion, DockTab, DockTabFlow, DockTabResponseEditor, DockTabNonInteractive, DockTabConditionEditor, DockTabTaskEditor } from '../../dock/types'; // ✅ RINOMINATO: DockTabActEditor → DockTabTaskEditor
import { splitWithTab, addTabCenter, closeTab, activateTab, moveTab, getTab, removeTab } from '../../dock/ops';
import { Workflow, FileText, Code2, GitBranch, MessageSquare } from 'lucide-react';
import SmartTooltip from '../SmartTooltip';

// Helper to map over dock tree nodes
function mapNode(n: DockNode, f: (n: DockNode) => DockNode): DockNode {
  let mapped: DockNode;
  if (n.kind === 'split') {
    const children = n.children.map(c => mapNode(c, f));
    mapped = { ...n, children };
  } else {
    mapped = { ...n };
  }
  const res = f(mapped);
  return res;
}

type Props = {
  root: DockNode;
  setRoot: (n: DockNode) => void;
  renderTabContent: (tab: DockTab) => React.ReactNode;
};

// Helper to get icon for tab type
function getTabIcon(tab: DockTab) {
  switch (tab.type) {
    case 'flow': return <Workflow size={14} color="#0c4a6e" />;
    case 'responseEditor': return <FileText size={14} color="#7c3aed" />;
    case 'taskEditor': return <FileText size={14} color="#94a3b8" />; // ✅ RINOMINATO: 'actEditor' → 'taskEditor'
    case 'nonInteractive': return <FileText size={14} color="#059669" />;
    case 'conditionEditor': return <Code2 size={14} color="#dc2626" />;
    case 'chat': return <MessageSquare size={14} color="#10b981" />;
    default: return <GitBranch size={14} color="#0c4a6e" />;
  }
}

export const DockManager: React.FC<Props> = ({ root, setRoot, renderTabContent }) => {
  const [dragTab, setDragTab] = React.useState<DockTab | null>(null);
  const [activeTabSetId, setActiveTabSetId] = React.useState<string>('ts_main');
  const [hoverTarget, setHoverTarget] = React.useState<{ tabsetId: string; region: DockRegion } | null>(null);

  const onDropTo = (tabsetId: string, region: DockRegion) => {
    if (!dragTab) return;
    // Preserve sizes when moving (use default if not specified)
    const sizes = region === 'bottom' ? [0.67, 0.33] : region === 'top' ? [0.33, 0.67] : undefined;
    setRoot(moveTab(root, dragTab.id, tabsetId, region, sizes));
    setDragTab(null);
    setHoverTarget(null);
  };

  return (
    <div className="flex w-full h-full min-h-0">
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
          // Tab closed - no shelf, just remove it
        }}
        rootNode={root}
      />
    </div>
  );
};

// Separate component for split nodes to avoid conditional hooks
function SplitRenderer(props: {
  node: Extract<DockNode, { kind: 'split' }>;
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
  const cls = node.orientation === 'row' ? 'flex flex-row w-full h-full' : 'flex flex-col w-full h-full';
  const [isResizing, setIsResizing] = React.useState(false);
  // Initialize sizes from node.sizes or default to equal distribution
  const defaultSizes = React.useMemo(() => node.children.map(() => 1 / node.children.length), [node.children.length]);
  const [sizes, setSizes] = React.useState<number[]>(() => node.sizes || defaultSizes);
  const sizesRef = React.useRef<number[]>(sizes);

  // Update sizes only when node.sizes changes externally (not during resize)
  React.useEffect(() => {
    if (!isResizing) {
      const newSizes = node.sizes || defaultSizes;
      // Only update if actually different to avoid unnecessary re-renders
      if (JSON.stringify(newSizes) !== JSON.stringify(sizesRef.current)) {
        setSizes(newSizes);
        sizesRef.current = newSizes;
      }
    }
  }, [node.sizes, defaultSizes, isResizing]);

  const handleMouseDown = React.useCallback((idx: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    const startX = e.clientX;
    const startY = e.clientY;
    const startSizes = [...sizesRef.current];
    const container = (e.currentTarget as HTMLElement).parentElement;
    if (!container) return;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = node.orientation === 'row'
        ? (e.clientX - startX) / container.offsetWidth
        : (e.clientY - startY) / container.offsetHeight;

      const newSizes = [...startSizes];
      newSizes[idx] = Math.max(0.1, Math.min(0.9, startSizes[idx] + delta));
      newSizes[idx + 1] = Math.max(0.1, Math.min(0.9, startSizes[idx + 1] - delta));

      // Normalize to sum to 1
      const sum = newSizes.reduce((a, b) => a + b, 0);
      const normalized = newSizes.map(s => s / sum);
      setSizes(normalized);
      sizesRef.current = normalized;
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      // Update the tree with final sizes from ref (most up-to-date)
      const finalSizes = sizesRef.current;
      props.setRoot(mapNode(props.rootNode, n => {
        if (n.id === node.id && n.kind === 'split') {
          return { ...n, sizes: finalSizes };
        }
        return n;
      }));
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [node.id, node.orientation, props.rootNode, props.setRoot]);

  return (
    <div className={cls} style={{ minHeight: 0, minWidth: 0, position: 'relative' }}>
      {node.children.map((c, idx) => {
        const size = sizes[idx];
        const isLast = idx === node.children.length - 1;
        return (
          <React.Fragment key={c.id}>
            <div
              className="min-w-0 min-h-0"
              style={{
                flex: `0 0 ${size * 100}%`,
                width: node.orientation === 'row' ? `${size * 100}%` : undefined,
                height: node.orientation === 'col' ? `${size * 100}%` : undefined
              }}
            >
              <DockRenderer {...props} node={c} />
            </div>
            {!isLast && (
              <div
                onMouseDown={(e) => handleMouseDown(idx, e)}
                className={node.orientation === 'row' ? 'cursor-col-resize' : 'cursor-row-resize'}
                style={{
                  width: node.orientation === 'row' ? '4px' : '100%',
                  height: node.orientation === 'col' ? '4px' : '100%',
                  backgroundColor: isResizing ? '#38bdf8' : 'transparent',
                  flexShrink: 0,
                  position: 'relative',
                  zIndex: 10,
                  transition: isResizing ? 'none' : 'background-color 0.2s'
                }}
                onMouseEnter={(e) => {
                  if (!isResizing) {
                    (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(56, 189, 248, 0.3)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isResizing) {
                    (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                  }
                }}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

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
    return <SplitRenderer {...props} node={node} />;
  }
  return (
    <TabSet
      nodeId={node.id}
      tabs={node.tabs}
      active={node.active}
      setActive={(idx) => { props.setActiveTabSetId(node.id); props.setRoot(activateTab(props.rootNode, node.tabs[idx].id)); }}
      onClose={async (tabId) => {
        console.log('[DockManager] 🔴 onClose called', { tabId });
        // ✅ PRIMA: Chiama onClose del tab se presente (per salvataggio sincrono)
        const t = getTab(props.rootNode, tabId);
        console.log('[DockManager] 🔍 Tab found', {
          tabId,
          hasTab: !!t,
          tabType: t?.type,
          hasOnClose: t && 'onClose' in t,
          onCloseType: t && 'onClose' in t ? typeof t.onClose : 'N/A'
        });
        let shouldClose = true; // Default: chiudi il tab

        if (t && 'onClose' in t && typeof t.onClose === 'function') {
          console.log('[DockManager] 🟢 Calling tab.onClose', { tabId, tabType: t.type });
          try {
            // ✅ Pass the tab to onClose so it can read tab.ddt (which is updated during editing)
            const result = await t.onClose(t);
            console.log('[DockManager] ✅ tab.onClose completed', { tabId, result, shouldClose: result !== false });
            // ✅ Se onClose ritorna false, non chiudere il tab
            if (result === false) {
              shouldClose = false;
              console.log('[DockManager] ⏸️ Tab close prevented by tab.onClose', { tabId });
            }
          } catch (err) {
            console.error('[DockManager] ❌ Error in tab.onClose:', err);
            // ✅ In caso di errore, chiudi comunque il tab (comportamento precedente)
          }
        } else {
          console.warn('[DockManager] ⚠️ Tab.onClose not available', {
            tabId,
            hasTab: !!t,
            hasOnClose: t && 'onClose' in t,
            onCloseType: t && 'onClose' in t ? typeof t.onClose : 'N/A'
          });
        }

        // ✅ POI: Chiudi la tab solo se onClose non ha ritornato false
        if (shouldClose) {
          if (t) props.onTabClosed(t);
          props.setRoot(closeTab(props.rootNode, tabId));
        }
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
  onClose: (tabId: string) => void | Promise<void>;
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
      className="relative w-full h-full rounded min-h-0 flex flex-col"
      style={{ border: '1px solid #38bdf8', backgroundColor: '#e0f2fe', height: '100%', display: 'flex', flexDirection: 'column' }}
      onDragOver={(e) => {
        e.preventDefault();
        // Only show overlay when dragging dock tabs, not other elements like tasks
        const isTabDrag = e.dataTransfer.types.includes('text/plain');
        if (isTabDrag) {
          const r = computeRegion(e);
          setRegion(r);
          props.onHover(props.nodeId, r);
        }
      }}
      onDragLeave={() => { setRegion(null); props.onHover(props.nodeId, 'center'); }}
      onDrop={(e) => {
        const isTabDrag = e.dataTransfer.types.includes('text/plain');
        if (isTabDrag) {
          const r = region || 'center';
          props.onDrop(props.nodeId, r);
        }
        setRegion(null);
      }}
    >
      <div className="flex items-center gap-1 px-2 border-b flex-shrink-0"
        style={{ backgroundColor: '#e0f2fe', borderColor: '#38bdf8', height: 40 }}>
        {props.tabs.map((t, i) => {
          const isActive = props.active === i;
          const isResponseEditor = t.type === 'responseEditor';
          const isTaskEditor = t.type === 'taskEditor'; // ✅ RINOMINATO: isActEditor → isTaskEditor, 'actEditor' → 'taskEditor'
          const responseEditorTab = isResponseEditor ? (t as DockTabResponseEditor) : null;
          const taskEditorTab = isTaskEditor ? (t as DockTabTaskEditor) : null; // ✅ RINOMINATO: actEditorTab → taskEditorTab, DockTabActEditor → DockTabTaskEditor
          // Get color from either responseEditor or taskEditor
          const tabColor = isActive && (responseEditorTab?.headerColor || taskEditorTab?.headerColor) // ✅ RINOMINATO: actEditorTab → taskEditorTab
            ? (responseEditorTab?.headerColor || taskEditorTab?.headerColor) // ✅ RINOMINATO: actEditorTab → taskEditorTab
            : undefined;
          // Get toolbar buttons from either responseEditor or taskEditor
          const toolbarButtons = isActive && (responseEditorTab?.toolbarButtons || taskEditorTab?.toolbarButtons) // ✅ RINOMINATO: actEditorTab → taskEditorTab
            ? (responseEditorTab?.toolbarButtons || taskEditorTab?.toolbarButtons || []) // ✅ RINOMINATO: actEditorTab → taskEditorTab
            : [];
          const showToolbar = isActive && (isResponseEditor || isTaskEditor) && toolbarButtons.length > 0; // ✅ RINOMINATO: isActEditor → isTaskEditor

          return (
            <div key={t.id}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', t.id);
                props.onDragTabStart(t);
              }}
              onDragEnd={(e) => {
                e.dataTransfer.clearData();
                props.onDragTabEnd();
              }}
              onClick={() => props.setActive(i)}
              className="px-2 py-0.5 text-xs rounded border cursor-grab flex items-center gap-1"
              style={{
                flex: isActive ? 1 : '0 0 auto',
                minWidth: isActive ? 0 : 'auto',
                backgroundColor: isActive
                  ? (tabColor || '#bae6fd')
                  : '#ffffff',
                borderColor: tabColor || '#38bdf8',
                color: isActive && tabColor ? '#ffffff' : '#0c4a6e'
              }}>
              {/* icona dinamica in base al tipo */}
              {getTabIcon(t)}
              <span style={{
                flex: isActive ? 1 : '0 0 auto',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontWeight: 600,
                minWidth: 0
              }}>{t.title}</span>

              {/* Toolbar dalla tab (solo se tab attiva e ResponseEditor) */}
              {showToolbar && (
                <div style={{ display: 'flex', gap: 4, marginLeft: 8, alignItems: 'center' }}>
                  {toolbarButtons.map((btn, idx) => {
                    // ✅ FIX: Monta sempre il pulsante, controlla visibilità con CSS
                    // NON usare return null - il pulsante deve essere sempre montato per il ref

                    // ✅ FIX: Estrai buttonRef e buttonId
                    const buttonRef = btn.buttonRef && 'current' in btn.buttonRef
                      ? btn.buttonRef as React.RefObject<HTMLButtonElement>
                      : null;
                    const buttonId = btn.buttonId;

                    const buttonProps = {
                      onClick: (e: React.MouseEvent) => {
                        e.stopPropagation();
                        btn.onClick();
                      },
                      disabled: btn.disabled,
                      'data-button-id': buttonId, // ✅ FIX: Aggiungi data-button-id per fallback
                      style: {
                        display: btn.visible === false ? 'none' : 'flex', // ✅ FIX: Usa display invece di return null
                        alignItems: 'center',
                        gap: 4,
                        background: btn.primary ? '#0b1220' : (btn.active ? 'rgba(255,255,255,0.2)' : 'transparent'),
                        color: '#ffffff',
                        border: btn.primary ? 'none' : '1px solid rgba(255,255,255,0.3)',
                        borderRadius: 6,
                        padding: btn.label ? '4px 8px' : '4px 6px',
                        cursor: btn.disabled ? 'not-allowed' : 'pointer',
                        opacity: btn.disabled ? 0.5 : 1,
                        fontSize: '11px',
                        whiteSpace: 'nowrap' as const,
                      },
                    };

                    const button = (
                      <button {...buttonProps}>
                        {btn.icon}
                        {btn.label && <span>{btn.label}</span>}
                      </button>
                    );

                    // ✅ FIX: Gestisci il ref per entrambi i casi (con e senza title)
                    // ✅ FIX: Callback ref semplificato senza log per evitare loop infiniti
                    const buttonWithRef = buttonRef ? React.cloneElement(button, {
                      ref: (el: HTMLButtonElement | null) => {
                        // ✅ FIX: Propaga il ref senza log (rimosso per evitare loop infiniti)
                        if (buttonRef && 'current' in buttonRef) {
                          (buttonRef as React.MutableRefObject<HTMLButtonElement | null>).current = el;
                        }
                      }
                    }) : button;

                    return btn.title ? (
                      <SmartTooltip key={idx} text={btn.title} tutorId={`toolbar_btn_${idx}_help`} placement="bottom">
                        {buttonWithRef}
                      </SmartTooltip>
                    ) : (
                      <React.Fragment key={idx}>{buttonWithRef}</React.Fragment>
                    );
                  })}
                </div>
              )}

              <button className="ml-1" style={{ color: isActive && tabColor ? '#ffffff' : '#0c4a6e' }} onClick={async (e) => { e.stopPropagation(); await props.onClose(t.id); }}>×</button>
            </div>
          );
        })}
      </div>
      {/* ✅ Key stabile sul contenuto del tab per preservare lo stato quando si cambia tab */}
      {(() => {
        const activeTab = props.tabs[props.active];
        // ✅ LOG DISABILITATO - troppo rumoroso
        // console.log('[DEBUG_MEMO] TabSet rendering content', {
        //   activeTabId: activeTab?.id,
        //   activeTabType: activeTab?.type,
        //   activeIndex: props.active,
        //   tabsCount: props.tabs.length,
        //   willRender: !!activeTab
        // });
        if (!activeTab) return null;

        // ✅ Per responseEditor, usa una key stabile basata su instanceId per preservare lo stato
        const stableKey = activeTab.type === 'responseEditor' && (activeTab as any).act?.instanceId
          ? `response-editor-${(activeTab as any).act.instanceId}`
          : activeTab.id;

        // ✅ LOG DISABILITATO - troppo rumoroso
        // console.log('[DEBUG_DOCK_KEY] TabSet stableKey calculated', {
        //   activeTabId: activeTab.id,
        //   activeTabType: activeTab.type,
        //   stableKey,
        //   instanceId: (activeTab as any).act?.instanceId
        // });

        return (
          <div
            key={stableKey}
            className="w-full min-h-0 flex-1"
            style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, height: '100%', backgroundColor: '#ffffff', overflow: 'hidden' }}
          >
            {props.renderTabContent(activeTab)}
          </div>
        );
      })()}
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
  const r: Record<DockRegion, { x: number; y: number; w: number; h: number }> = {
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


