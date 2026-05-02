import React from 'react';
import { createPortal } from 'react-dom';
import { DockNode, DockRegion, DockTab, DockTabFlow, DockTabResponseEditor, DockTabNonInteractive, DockTabConditionEditor, DockTabTaskEditor, isLockedMainFlowTab } from '../../dock/types'; // ✅ RINOMINATO: DockTabActEditor → DockTabTaskEditor
import { splitWithTab, addTabCenter, closeTab, activateTab, moveTab, getTab, removeTab } from '../../dock/ops';
import { Workflow, FileText, Code2, GitBranch, MessageSquare, Waypoints } from 'lucide-react';
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
        const tabPre = getTab(props.rootNode, tabId);
        if (isLockedMainFlowTab(tabPre)) {
          return;
        }

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

/** Toolbar dropdown (same contract as EditorHeader) for task/flow dock tabs. */
function DockToolbarDropdownButton({
  btn,
  idx,
  tabColor,
}: {
  btn: import('../../dock/types').ToolbarButton;
  idx: number;
  tabColor?: string;
}) {
  const [isOpen, setIsOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const buttonElementRef = React.useRef<HTMLButtonElement | null>(null);
  const [dropdownPosition, setDropdownPosition] = React.useState<{ top: number; left: number } | null>(null);

  React.useEffect(() => {
    if (isOpen && buttonElementRef.current) {
      const rect = buttonElementRef.current.getBoundingClientRect();
      const dropdownWidth = 260;
      setDropdownPosition({
        top: rect.bottom + window.scrollY + 4,
        left: Math.max(8, rect.right + window.scrollX - dropdownWidth),
      });
    } else {
      setDropdownPosition(null);
    }
  }, [isOpen]);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        buttonElementRef.current &&
        !buttonElementRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const fg = isOpen && tabColor ? '#ffffff' : '#0c4a6e';
  const bg = '#ffffff';
  const border = tabColor || '#38bdf8';

  const buttonProps = {
    ref: (el: HTMLButtonElement | null) => {
      buttonElementRef.current = el;
    },
    onClick: (e: React.MouseEvent) => {
      e.stopPropagation();
      setIsOpen((o) => !o);
    },
    disabled: btn.disabled,
    style: {
      display: btn.visible === false ? 'none' : 'flex',
      alignItems: 'center',
      gap: 4,
      background: btn.primary ? '#0b1220' : btn.active ? 'rgba(255,255,255,0.2)' : 'transparent',
      color: btn.primary ? '#ffffff' : fg,
      border: btn.primary ? 'none' : '1px solid rgba(12,74,110,0.35)',
      borderRadius: 6,
      padding: btn.label ? '4px 8px' : '4px 6px',
      cursor: btn.disabled ? 'not-allowed' : 'pointer',
      opacity: btn.disabled ? 0.5 : 1,
      fontSize: 11,
      whiteSpace: 'nowrap' as const,
    },
  };

  return (
    <React.Fragment key={idx}>
      <button {...buttonProps}>
        {btn.icon}
        {btn.label && <span>{btn.label}</span>}
      </button>
      {isOpen &&
        btn.dropdownItems &&
        btn.dropdownItems.length > 0 &&
        dropdownPosition &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={dropdownRef}
            style={{
              position: 'fixed',
              top: dropdownPosition.top,
              left: dropdownPosition.left,
              backgroundColor: bg,
              border: `1px solid ${border}`,
              borderRadius: 8,
              boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
              zIndex: 99999,
              minWidth: 220,
              maxHeight: 320,
              overflowY: 'auto',
              padding: 4,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {btn.dropdownItems.map((item, j) => (
              <button
                key={j}
                type="button"
                onClick={() => {
                  item.onClick();
                  setIsOpen(false);
                }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 12px',
                  background: 'transparent',
                  border: 'none',
                  color: '#0c4a6e',
                  cursor: 'pointer',
                  borderRadius: 4,
                  textAlign: 'left' as const,
                  fontSize: 12,
                }}
              >
                {item.icon && <span>{item.icon}</span>}
                <span>{item.label}</span>
              </button>
            ))}
          </div>,
          document.body
        )}
    </React.Fragment>
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

  const successOn = Boolean(btn.successHighlight && !btn.disabled);
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
      background: successOn
        ? '#059669'
        : btn.primary
          ? '#0b1220'
          : btn.active
            ? 'rgba(255,255,255,0.2)'
            : 'transparent',
      color: '#ffffff',
      border: successOn ? '1px solid #047857' : btn.primary ? 'none' : '1px solid rgba(255,255,255,0.3)',
      borderRadius: 6,
      padding: btn.label ? '4px 8px' : '4px 6px',
      cursor: btn.disabled ? 'not-allowed' : 'pointer',
      opacity: btn.disabled ? 0.5 : 1,
      fontSize: '11px',
      whiteSpace: 'nowrap' as const,
      fontWeight: successOn ? 600 : 400,
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

function renderDockToolbarSelect(
  btn: import('../../dock/types').ToolbarButton,
  idx: number,
  tabColor?: string
) {
  if (btn.type !== 'select' || !btn.options?.length) {
    return null;
  }
  const fg = tabColor ? '#ffffff' : '#0c4a6e';
  const border = '1px solid rgba(255,255,255,0.35)';
  return (
    <div
      key={`dock-select-${idx}`}
      style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}
      onClick={(e) => e.stopPropagation()}
    >
      {btn.label ? (
        <span style={{ fontSize: 11, color: fg, whiteSpace: 'nowrap', flexShrink: 0 }}>{btn.label}</span>
      ) : null}
      <select
        value={btn.value || ''}
        onChange={(e) => btn.onChange?.(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'rgba(255,255,255,0.12)',
          color: fg,
          border,
          borderRadius: 6,
          padding: '4px 8px',
          fontSize: 11,
          cursor: 'pointer',
          outline: 'none',
          maxWidth: 'min(320px, 42vw)',
          minWidth: 0,
        }}
        title={btn.title}
        aria-label={btn.title || btn.label}
      >
        {btn.options.map((opt) => (
          <option key={opt.value} value={opt.value} disabled={opt.disabled}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function renderDockToolbarButton(btn: import('../../dock/types').ToolbarButton, idx: number, tabColor?: string) {
  if (btn.visible === false) {
    return null;
  }
  if (btn.type === 'select' && btn.options && btn.options.length > 0) {
    return renderDockToolbarSelect(btn, idx, tabColor);
  }
  if (btn.dropdownItems && btn.dropdownItems.length > 0) {
    return <DockToolbarDropdownButton key={`dtb-${idx}`} btn={btn} idx={idx} tabColor={tabColor} />;
  }
  return renderTabButton(btn, idx, tabColor);
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
      {!hideTabStrip && (() => {
        const activeDockTab = props.tabs[props.active];
        const tallFlowDockHeader =
          activeDockTab?.type === 'flow' &&
          ((activeDockTab as DockTabFlow).toolbarButtons?.length ?? 0) > 0;
        const stripHeight = tallFlowDockHeader ? 44 : 40;
        return (
        <div className="flex flex-wrap items-center gap-x-1 gap-y-1 px-2 py-1 border-b flex-shrink-0 w-full min-w-0"
          style={{ backgroundColor: '#e0f2fe', borderColor: '#38bdf8', minHeight: stripHeight }}>
          {props.tabs.map((t, i) => {
          const isActive = props.active === i;
          const lockedMainFlow = isLockedMainFlowTab(t);
          const isFlowTab = t.type === 'flow';
          const isResponseEditor = t.type === 'responseEditor';
          const isTaskEditor = t.type === 'taskEditor'; // ✅ RINOMINATO: isActEditor → isTaskEditor, 'actEditor' → 'taskEditor'
          const responseEditorTab = isResponseEditor ? (t as DockTabResponseEditor) : null;
          const taskEditorTab = isTaskEditor ? (t as DockTabTaskEditor) : null; // ✅ RINOMINATO: actEditorTab → taskEditorTab, DockTabActEditor → DockTabTaskEditor
          const flowTab = isFlowTab ? (t as DockTabFlow) : null;
          // Get color from responseEditor, taskEditor, or flow (dock toolbar)
          const tabColor = isActive && (responseEditorTab?.headerColor || taskEditorTab?.headerColor || flowTab?.headerColor)
            ? (responseEditorTab?.headerColor || taskEditorTab?.headerColor || flowTab?.headerColor)
            : undefined;
          const toolbarButtons = isActive && (responseEditorTab?.toolbarButtons || taskEditorTab?.toolbarButtons || flowTab?.toolbarButtons)
            ? (responseEditorTab?.toolbarButtons || taskEditorTab?.toolbarButtons || flowTab?.toolbarButtons || [])
            : [];
          const showToolbar =
            isActive && (isResponseEditor || isTaskEditor || isFlowTab) && toolbarButtons.length > 0;
          const titleSuffixButtons = toolbarButtons.filter(b => b.position === 'title-suffix');
          const rightButtons = toolbarButtons.filter(b => b.position !== 'title-suffix');
          /** Flow + dock toolbar: tab fills strip width so title + Data/Output use full header. */
          const flowToolbarExpanded = Boolean(isFlowTab && isActive && showToolbar);
          const tabFlexGrow = flowToolbarExpanded ? '1 1 0%' : isFlowTab ? '0 0 auto' : (isActive ? 1 : '0 0 auto');

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
              className="px-2 py-0.5 text-xs rounded border cursor-grab flex gap-1 min-w-0"
              style={{
                flex: tabFlexGrow,
                flexWrap: 'wrap',
                alignItems: 'center',
                alignContent: 'center',
                rowGap: 6,
                columnGap: 4,
                minWidth: flowToolbarExpanded ? 0 : (isFlowTab ? 'auto' : (isActive ? 0 : 'auto')),
                maxWidth: flowToolbarExpanded ? undefined : (isFlowTab ? 280 : undefined),
                backgroundColor: isActive
                  ? (tabColor || '#bae6fd')
                  : '#ffffff',
                borderColor: tabColor || '#38bdf8',
                color: isActive && tabColor ? '#ffffff' : '#0c4a6e'
              }}>
              {/* icona dinamica in base al tipo — flow attivo con header colorato: icona chiara */}
              {isFlowTab ? (
                <Workflow size={14} color={isActive && tabColor ? '#ffffff' : '#0c4a6e'} aria-hidden />
              ) : (
                getTabIcon(t)
              )}
              {/* Title: con flow toolbar il titolo usa lo spazio centrale (ellipsis solo se stretto) */}
              <span
                title={t.title}
                style={{
                  flex: flowToolbarExpanded ? 1 : '0 1 auto',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontWeight: 600,
                  minWidth: 0,
                }}
              >{t.title}</span>

              {/* title-suffix buttons: immediately after title, not pushed right */}
              {showToolbar && titleSuffixButtons.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginLeft: 6, alignItems: 'center', minWidth: 0 }}>
                  {titleSuffixButtons.map((btn, idx) => renderDockToolbarButton(btn, idx, tabColor))}
                </div>
              )}

              {/* Spacer: pushes close (×) and right toolbar to the tab end for expanded editor / flow toolbars */}
              {isActive && (isResponseEditor || isTaskEditor || (isFlowTab && showToolbar)) && (
                <div style={{ flex: 1, minWidth: 0 }} aria-hidden />
              )}

              {/* Right-aligned toolbar buttons */}
              {showToolbar && rightButtons.length > 0 && (
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 4,
                    marginLeft: 4,
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    minWidth: 0,
                    flex: isActive && (isResponseEditor || isTaskEditor || (isFlowTab && showToolbar)) ? '1 1 auto' : undefined,
                  }}
                >
                  {rightButtons.map((btn, idx) => renderDockToolbarButton(btn, idx + titleSuffixButtons.length, tabColor))}
                </div>
              )}

              {!lockedMainFlow && (
                <button className="ml-1 shrink-0" style={{ color: isActive && tabColor ? '#ffffff' : '#0c4a6e' }} onClick={async (e) => { e.stopPropagation(); await props.onClose(t.id); }}>×</button>
              )}
              </div>
            );
          })}
        </div>
        );
      })()}
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


