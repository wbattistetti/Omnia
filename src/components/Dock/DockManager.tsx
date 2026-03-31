import React from 'react';
import { DockNode, DockRegion, DockTab, DockTabFlow, DockTabResponseEditor, DockTabNonInteractive, DockTabConditionEditor, DockTabTaskEditor, DockTabErrorReport } from '../../dock/types'; // ✅ RINOMINATO: DockTabActEditor → DockTabTaskEditor
import { splitWithTab, addTabCenter, closeTab, activateTab, moveTab, getTab, removeTab } from '../../dock/ops';
import { Workflow, FileText, Code2, GitBranch, MessageSquare, AlertCircle, Waypoints } from 'lucide-react';
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
  /** Direct map of tabId → close handler. Read synchronously — no state update delay. */
  editorCloseRefsMap?: React.MutableRefObject<Map<string, () => Promise<boolean>>>;
  /** Optional callback fired whenever a tab becomes active in any tabset. */
  onActiveTabChanged?: (tab: DockTab) => void;
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
    case 'errorReport': return <AlertCircle size={14} color="#dc2626" />;
    case 'flowMapping': return <Waypoints size={14} color="#14b8a6" />;
    default: return <GitBranch size={14} color="#0c4a6e" />;
  }
}

export const DockManager: React.FC<Props> = ({ root, setRoot, renderTabContent, editorCloseRefsMap, onActiveTabChanged }) => {
  const [dragTab, setDragTab] = React.useState<DockTab | null>(null);
  const [activeTabSetId, setActiveTabSetId] = React.useState<string>('ts_main');
  const [hoverTarget, setHoverTarget] = React.useState<{ tabsetId: string; region: DockRegion } | null>(null);

  const onDropTo = (tabsetId: string, region: DockRegion) => {
    if (!dragTab) return;
    const sizes =
      region === 'bottom'
        ? [0.67, 0.33]
        : region === 'top'
          ? [0.33, 0.67]
          : region === 'right'
            ? [0.75, 0.25]
            : region === 'left'
              ? [0.25, 0.75]
              : undefined;
    setRoot(moveTab(root, dragTab.id, tabsetId, region, sizes));
    setDragTab(null);
    setHoverTarget(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, width: '100%' }}>
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
        onActiveTabChanged={onActiveTabChanged}
        rootNode={root}
        editorCloseRefsMap={editorCloseRefsMap}
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
  onActiveTabChanged?: (tab: DockTab) => void;
  editorCloseRefsMap?: React.MutableRefObject<Map<string, () => Promise<boolean>>>;
}) {
  const { node } = props;
  // ✅ FIX: Removed h-full - flex: 1 in style handles height correctly
  const cls = node.orientation === 'row' ? 'flex flex-row w-full' : 'flex flex-col w-full';
  const [isResizing, setIsResizing] = React.useState(false);
  // Defaults: row + 2 panes = flow/chat lateral layout (matches openLateralChatPanel [0.75, 0.25]); else equal split
  const defaultSizes = React.useMemo(() => {
    const n = node.children.length;
    if (n === 0) return [];
    if (node.orientation === 'row' && n === 2) {
      return [0.75, 0.25];
    }
    return node.children.map(() => 1 / n);
  }, [node.children.length, node.orientation]);
  const [sizes, setSizes] = React.useState<number[]>(() => node.sizes ?? defaultSizes);
  const sizesRef = React.useRef<number[]>(sizes);

  // Sync from tree before paint — useEffect caused one frame at wrong flex % (panel looked wide then narrow).
  React.useLayoutEffect(() => {
    if (!isResizing) {
      const newSizes = node.sizes ?? defaultSizes;
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
    <div className={cls} style={{ flex: 1, minHeight: 0, minWidth: 0, position: 'relative' }}>
      {node.children.map((c, idx) => {
        const size = sizes[idx];
        const isLast = idx === node.children.length - 1;
        return (
          <React.Fragment key={c.id}>
            <div
              className="min-w-0 min-h-0"
              style={{
                flex: `0 0 ${size * 100}%`,
                display: 'flex',
                flexDirection: 'column',
                width: node.orientation === 'row' ? `${size * 100}%` : undefined,
                // ✅ FIX: Removed height: ${size * 100}% - flex: 0 0 ${size * 100}% already handles height in column layout
                // The flex-basis percentage works correctly when parent has flex-determined height
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
  onActiveTabChanged?: (tab: DockTab) => void;
  editorCloseRefsMap?: React.MutableRefObject<Map<string, () => Promise<boolean>>>;
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
      onActiveTabChanged={props.onActiveTabChanged}
      setActive={(idx) => {
        props.setActiveTabSetId(node.id);
        const nextTab = node.tabs[idx];
        if (nextTab) {
          props.onActiveTabChanged?.(nextTab);
          props.setRoot(activateTab(props.rootNode, nextTab.id));
        }
      }}
      onClose={async (tabId) => {
        let shouldClose = true;

        // ✅ PRIORITY 1: Use editorCloseRefsMap directly (no state-update delay, always current)
        const directHandler = props.editorCloseRefsMap?.current.get(tabId);
        if (directHandler) {
          try {
            const result = await directHandler();
            if (result === false) shouldClose = false;
          } catch (err) {
            console.error('[DockManager] ❌ Error in editorCloseRef handler:', err);
          }
        } else {
          // ✅ FALLBACK: tab.onClose for other tab types (e.g. responseEditor)
          const t = getTab(props.rootNode, tabId);
          if (t && 'onClose' in t && typeof t.onClose === 'function') {
            try {
              const result = await (t as any).onClose(t);
              if (result === false) shouldClose = false;
            } catch (err) {
              console.error('[DockManager] ❌ Error in tab.onClose:', err);
            }
          }
        }

        if (shouldClose) {
          const t = getTab(props.rootNode, tabId);
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

/**
 * Renders a single toolbar button inside a dock tab strip.
 * Extracted to avoid duplicating the ref-cloning and tooltip logic.
 */
function renderTabButton(btn: import('../../dock/types').ToolbarButton, idx: number, _tabColor?: string) {
  const buttonRef = btn.buttonRef && 'current' in btn.buttonRef
    ? btn.buttonRef as React.RefObject<HTMLButtonElement>
    : null;
  const buttonId = btn.buttonId;

  const buttonProps = {
    onClick: (e: React.MouseEvent) => {
      e.stopPropagation();
      btn.onClick?.();
    },
    disabled: btn.disabled,
    'data-button-id': buttonId,
    style: {
      display: btn.visible === false ? 'none' : 'flex',
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

  const buttonWithRef = buttonRef
    ? React.cloneElement(button, {
        ref: (el: HTMLButtonElement | null) => {
          if (buttonRef && 'current' in buttonRef) {
            (buttonRef as React.MutableRefObject<HTMLButtonElement | null>).current = el;
          }
        },
      })
    : button;

  return btn.title ? (
    <SmartTooltip key={idx} text={btn.title} tutorId={`toolbar_btn_${idx}_help`} placement="bottom">
      {buttonWithRef}
    </SmartTooltip>
  ) : (
    <React.Fragment key={idx}>{buttonWithRef}</React.Fragment>
  );
}

function TabSet(props: {
  nodeId: string;
  tabs: DockTab[];
  active: number;
  onActiveTabChanged?: (tab: DockTab) => void;
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
  const hideTabStrip = props.tabs.length === 1 && props.tabs[0]?.type === 'chat';

  React.useEffect(() => {
    const activeTab = props.tabs[props.active];
    if (activeTab) {
      props.onActiveTabChanged?.(activeTab);
    }
  }, [props.active, props.tabs, props.onActiveTabChanged]);

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
      className="relative w-full rounded min-h-0 flex flex-col"
      style={{ flex: 1, border: '1px solid #38bdf8', backgroundColor: '#e0f2fe', display: 'flex', flexDirection: 'column' }}
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
      {!hideTabStrip && (
        <div className="flex items-center gap-1 px-2 border-b flex-shrink-0"
          style={{ backgroundColor: '#e0f2fe', borderColor: '#38bdf8', height: 40 }}>
          {props.tabs.map((t, i) => {
          const isActive = props.active === i;
          const isFlowTab = t.type === 'flow';
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
          const titleSuffixButtons = toolbarButtons.filter(b => b.position === 'title-suffix');
          const rightButtons = toolbarButtons.filter(b => b.position !== 'title-suffix');
          /** Only flow tabs are caption-sized; editor tabs keep legacy full-width active behavior. */
          const tabFlexGrow = isFlowTab ? '0 0 auto' : (isActive ? 1 : '0 0 auto');

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
                flex: tabFlexGrow,
                minWidth: isFlowTab ? 'auto' : (isActive ? 0 : 'auto'),
                maxWidth: isFlowTab ? 280 : undefined,
                backgroundColor: isActive
                  ? (tabColor || '#bae6fd')
                  : '#ffffff',
                borderColor: tabColor || '#38bdf8',
                color: isActive && tabColor ? '#ffffff' : '#0c4a6e'
              }}>
              {/* icona dinamica in base al tipo */}
              {getTabIcon(t)}
              {/* Title: no flex:1 here — a spacer div below fills the gap instead,
                  so that title-suffix buttons sit immediately after the label. */}
              <span style={{
                flex: '0 1 auto',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontWeight: 600,
                minWidth: 0
              }}>{t.title}</span>

              {/* title-suffix buttons: immediately after title, not pushed right */}
              {showToolbar && titleSuffixButtons.length > 0 && (
                <div style={{ display: 'flex', gap: 4, marginLeft: 6, alignItems: 'center', flexShrink: 0 }}>
                  {titleSuffixButtons.map((btn, idx) => renderTabButton(btn, idx, tabColor))}
                </div>
              )}

              {/* Spacer: pushes close (×) and right toolbar to the tab end for expanded editor tabs */}
              {isActive && (isResponseEditor || isTaskEditor) && (
                <div style={{ flex: 1, minWidth: 0 }} aria-hidden />
              )}

              {/* Right-aligned toolbar buttons */}
              {showToolbar && rightButtons.length > 0 && (
                <div style={{ display: 'flex', gap: 4, marginLeft: 4, alignItems: 'center', flexShrink: 0 }}>
                  {rightButtons.map((btn, idx) => renderTabButton(btn, idx + titleSuffixButtons.length, tabColor))}
                </div>
              )}

              <button className="ml-1" style={{ color: isActive && tabColor ? '#ffffff' : '#0c4a6e' }} onClick={async (e) => { e.stopPropagation(); await props.onClose(t.id); }}>×</button>
              </div>
            );
          })}
        </div>
      )}
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

        // Key = tab id (unique). Do not use legacy `act` or varying instanceId — that remounts and flickers.
        const stableKey = activeTab.id;

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
            style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, backgroundColor: '#ffffff', overflow: 'hidden' }}
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


