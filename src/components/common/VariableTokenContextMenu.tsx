/**
 * Variable picker. Two rendering modes:
 *   - Normal: Radix DropdownMenu with nested Sub (click-to-insert workflow).
 *   - Drag (dragFlowRowPayload set): plain native div panel, NO Radix.
 *     Radix intercepts pointer events and fires onInteractOutside/onPointerDownOutside
 *     the moment a drag starts, closing the menu and cancelling the drag before it begins.
 */

import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { CircleDot, Folder, Workflow } from 'lucide-react';
import {
  buildFlatVariableMenuRows,
  buildRadixVariableMenuTree,
  type FlatMenuRow,
  type RadixVariableMenuEntry,
} from './utils/variableMenuTree';
import {
  DND_FLOWROW_VAR,
  stableInterfacePathForVariable,
} from '../FlowMappingPanel/flowInterfaceDragTypes';

export type VariableMenuRowItem = {
  id: string;
  varLabel: string;
  tokenLabel?: string;
  ownerFlowId?: string;
  ownerFlowTitle: string;
  isExposed: boolean;
  isFromActiveFlow?: boolean;
  sourceTaskRowLabel?: string;
  subflowTaskId?: string;
  isInterfaceUnbound?: boolean;
  missingChildVariableRef?: boolean;
};

type Props = {
  isOpen: boolean;
  x: number;
  y: number;
  variables: string[];
  variableItems?: VariableMenuRowItem[];
  onSelect: (variableLabel: string) => void;
  onExposeAndSelect?: (item: VariableMenuRowItem) => void;
  onClose: () => void;
  /**
   * When set, renders a native-div panel (no Radix) so HTML5 drag is not intercepted.
   * Leaf rows are draggable with DND_FLOWROW_VAR payload.
   */
  dragFlowRowPayload?: { nodeId: string };
};

/* ─── Styles ─────────────────────────────────────────────────────────────── */
const SURFACE: React.CSSProperties = {
  minWidth: '14rem',
  maxHeight: 340,
  overflowY: 'auto',
  background: '#0b1220',
  color: '#e2e8f0',
  border: '1px solid #475569',
  borderRadius: 6,
  boxShadow: '0 8px 28px rgba(0,0,0,0.45)',
  padding: '4px 0',
  zIndex: 100000,
};

const itemBase: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '7px 12px',
  fontSize: 13,
  borderRadius: 2,
  outline: 'none',
  color: '#cbd5e1',
  userSelect: 'none',
};

const headerBase: React.CSSProperties = {
  padding: '8px 12px 3px',
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.06em',
  color: '#94a3b8',
  textTransform: 'uppercase',
};

/* ─── Drag preview ghost ─────────────────────────────────────────────────── */
function setDragPreview(e: React.DragEvent, label: string): void {
  const text = label.trim() || 'Variabile';
  const ghost = document.createElement('div');
  ghost.textContent = text;
  ghost.setAttribute('aria-hidden', 'true');
  Object.assign(ghost.style, {
    position: 'fixed',
    top: '-200px',
    left: '-200px',
    zIndex: '2147483647',
    padding: '8px 14px',
    background: '#0b1220',
    border: '1px solid #a78bfa',
    borderRadius: '6px',
    boxShadow: '0 8px 24px rgba(0,0,0,0.55)',
    color: '#e2e8f0',
    fontSize: '13px',
    fontWeight: '600',
    fontFamily: 'system-ui,Segoe UI,sans-serif',
    whiteSpace: 'nowrap',
    pointerEvents: 'none',
  });
  document.body.appendChild(ghost);
  try {
    e.dataTransfer.setDragImage(ghost, 12, 12);
  } catch {
    /* ignore */
  }
  const rm = () => {
    ghost.remove();
    document.removeEventListener('dragend', rm);
  };
  document.addEventListener('dragend', rm);
}

/* ─── Drag-mode native panel ─────────────────────────────────────────────── */
interface NativePanelProps {
  x: number;
  y: number;
  items: VariableMenuRowItem[];
  nodeId: string;
  onClose: () => void;
}

function NativeDraggablePanel({ x, y, items, nodeId, onClose }: NativePanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  /**
   * Close on Escape or click outside.
   * Must use bubble phase (not capture): capture runs before React handlers, so the panel
   * cannot stopPropagation in time and outside-close logic can race with drag start.
   * With bubble, mousedown inside the panel is stopped at the panel root and never reaches document.
   */
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const onMouseDown = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onMouseDown, false);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onMouseDown, false);
    };
  }, [onClose]);

  const flat = buildFlatVariableMenuRows(items);

  /* Keep panel on screen */
  const LEFT = Math.min(x, window.innerWidth - 240);
  const TOP  = Math.min(y, window.innerHeight - 60);

  const buildDragStart = (item: VariableMenuRowItem) => (e: React.DragEvent) => {
    e.stopPropagation();
    /**
     * Without this, the fixed panel (high z-index) stays under the cursor and steals
     * dragover/drop — the backend SEND/RECEIVE tree never receives the drop.
     */
    if (panelRef.current) {
      panelRef.current.style.pointerEvents = 'none';
    }
    const label = String(item.tokenLabel || item.varLabel || '').trim();
    e.dataTransfer.effectAllowed = 'copy';
    try {
      e.dataTransfer.setData(
        DND_FLOWROW_VAR,
        JSON.stringify({
          variableRefId: item.id,
          suggestedInternalPath: stableInterfacePathForVariable(item.id),
          displayLabel: label,
          nodeId,
        })
      );
      e.dataTransfer.setData('text/plain', label);
    } catch { /* ignore */ }
    setDragPreview(e, label);
    /* Close after drop/cancel */
    const closeOnEnd = () => {
      onClose();
      document.removeEventListener('dragend', closeOnEnd);
    };
    document.addEventListener('dragend', closeOnEnd);
  };

  return createPortal(
    <div
      ref={panelRef}
      style={{ ...SURFACE, position: 'fixed', left: LEFT, top: TOP }}
      /* Block React Flow / canvas from seeing pointer/mouse down — otherwise state updates close the menu before drag starts. */
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {flat.length === 0 && (
        <div style={{ ...itemBase, color: '#64748b', fontSize: 12 }}>Nessuna variabile</div>
      )}
      {flat.map((row, idx) => {
        if (row.kind === 'header') {
          return (
            <div
              key={`h-${idx}`}
              style={{ ...headerBase, paddingLeft: 12 + row.depth * 12 }}
            >
              {row.label}
            </div>
          );
        }
        const { item } = row;
        const isMuted = item.isInterfaceUnbound === true || item.missingChildVariableRef === true;
        const isSubflow = item.isFromActiveFlow === false;
        const label = row.displayLabel;
        return (
          <div
            key={`l-${idx}`}
            draggable
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onDragStart={buildDragStart(item)}
            style={{
              ...itemBase,
              paddingLeft: 12 + row.depth * 12,
              cursor: 'grab',
              color: isMuted ? '#64748b' : '#cbd5e1',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(100,116,139,0.18)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          >
            {isSubflow
              ? <Workflow size={13} color={isMuted ? '#64748b' : '#38bdf8'} />
              : <CircleDot size={13} color={item.isExposed ? '#38bdf8' : '#94a3b8'} />
            }
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {label}
            </span>
          </div>
        );
      })}
    </div>,
    document.body
  );
}

/* ─── Radix leaf for normal (click) mode ─────────────────────────────────── */
const radixItemStyle = (muted: boolean): React.CSSProperties => ({
  ...itemBase,
  color: muted ? '#64748b' : '#cbd5e1',
  cursor: 'pointer',
});

function applyVariableSelection(
  item: VariableMenuRowItem,
  onSelect: (label: string) => void,
  onExposeAndSelect?: (item: VariableMenuRowItem) => void
): void {
  if ((item.isFromActiveFlow === false || !item.isExposed) && onExposeAndSelect) {
    onExposeAndSelect(item);
    return;
  }
  onSelect(item.tokenLabel || item.varLabel);
}

function renderRadixLeaf(
  item: VariableMenuRowItem,
  displayLabel: string,
  key: string,
  onSelect: (label: string) => void,
  onExposeAndSelect: Props['onExposeAndSelect']
): React.ReactNode {
  const muted = item.isInterfaceUnbound === true || item.missingChildVariableRef === true;
  const isSubflow = item.isFromActiveFlow === false;
  return (
    <DropdownMenu.Item
      key={key}
      className="outline-none select-none data-[highlighted]:bg-slate-700/60"
      style={radixItemStyle(muted)}
      onSelect={() => applyVariableSelection(item, onSelect, onExposeAndSelect)}
    >
      {isSubflow
        ? <Workflow size={13} color={muted ? '#64748b' : '#38bdf8'} />
        : <CircleDot size={13} color={item.isExposed ? '#38bdf8' : '#94a3b8'} />
      }
      <span style={{ flex: 1, minWidth: 0 }}>{displayLabel}</span>
    </DropdownMenu.Item>
  );
}

function renderRadixEntries(
  entries: RadixVariableMenuEntry<VariableMenuRowItem>[],
  keyPrefix: string,
  onSelect: (label: string) => void,
  onExposeAndSelect: Props['onExposeAndSelect']
): React.ReactNode {
  return entries.map((entry, idx) => {
    const key = `${keyPrefix}-${idx}`;
    if (entry.kind === 'item') {
      return renderRadixLeaf(entry.item, entry.displayLabel, key, onSelect, onExposeAndSelect);
    }
    const Icon = entry.subflowGroup ? Workflow : Folder;
    const iconColor = entry.subflowGroup ? '#38bdf8' : '#64748b';
    return (
      <DropdownMenu.Sub key={key}>
        <DropdownMenu.SubTrigger
          style={{ ...itemBase, cursor: 'pointer', border: 'none', background: 'transparent', width: '100%', textAlign: 'left' }}
          className="data-[state=open]:bg-slate-800/80 outline-none"
        >
          <Icon size={13} color={iconColor} />
          <span style={{ flex: 1, minWidth: 0 }}>{entry.label}</span>
          <span style={{ color: '#64748b', fontSize: 10 }} aria-hidden>▸</span>
        </DropdownMenu.SubTrigger>
        <DropdownMenu.Portal>
          <DropdownMenu.SubContent
            sideOffset={4}
            alignOffset={-4}
            style={SURFACE}
            className="outline-none"
          >
            {renderRadixEntries(entry.children, key, onSelect, onExposeAndSelect)}
          </DropdownMenu.SubContent>
        </DropdownMenu.Portal>
      </DropdownMenu.Sub>
    );
  });
}

/* ─── Public component ───────────────────────────────────────────────────── */
export default function VariableTokenContextMenu({
  isOpen,
  x,
  y,
  variables,
  variableItems,
  onSelect,
  onExposeAndSelect,
  onClose,
  dragFlowRowPayload,
}: Props) {
  if (!isOpen) return null;

  const items: VariableMenuRowItem[] =
    variableItems ??
    variables.map((v) => ({
      id: v, varLabel: v, tokenLabel: v,
      ownerFlowId: '', ownerFlowTitle: '',
      isExposed: true, isFromActiveFlow: true, sourceTaskRowLabel: '',
    }));

  /* Drag mode: native div panel, bypasses Radix entirely */
  if (dragFlowRowPayload) {
    return (
      <NativeDraggablePanel
        x={x}
        y={y}
        items={items}
        nodeId={dragFlowRowPayload.nodeId}
        onClose={onClose}
      />
    );
  }

  /* Normal click mode: Radix DropdownMenu */
  const radixEntries = buildRadixVariableMenuTree(items);
  const longestLen = items.reduce((m, i) => Math.max(m, i.varLabel.length, i.ownerFlowTitle.length), 12);
  const minW = `${Math.min(Math.max(longestLen + 8, 18), 48)}ch`;

  return (
    <DropdownMenu.Root open modal={false} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DropdownMenu.Trigger asChild>
        <div
          style={{ position: 'fixed', left: x, top: y, width: 1, height: 1, pointerEvents: 'none', zIndex: 99999 }}
          aria-hidden
        />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          side="bottom"
          align="start"
          sideOffset={0}
          style={{ ...SURFACE, minWidth: minW }}
          className="outline-none"
          onEscapeKeyDown={() => onClose()}
          onPointerDownOutside={() => onClose()}
          onInteractOutside={() => onClose()}
        >
          {radixEntries.length === 0
            ? <div style={{ ...itemBase, color: '#64748b', fontSize: 12 }}>Nessuna variabile trovata</div>
            : renderRadixEntries(radixEntries, 'root', onSelect, onExposeAndSelect)
          }
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
