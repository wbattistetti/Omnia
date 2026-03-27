import React from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { CircleDot, Folder, Workflow } from 'lucide-react';
import {
  buildRadixVariableMenuTree,
  type RadixVariableMenuEntry,
} from './utils/variableMenuTree';

export type VariableMenuRowItem = {
  varId: string;
  varLabel: string;
  tokenLabel?: string;
  ownerFlowId?: string;
  ownerFlowTitle: string;
  isExposed: boolean;
  isFromActiveFlow?: boolean;
  sourceTaskRowLabel?: string;
  subflowTaskId?: string;
  isInterfaceUnbound?: boolean;
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
};

const menuSurfaceStyle: React.CSSProperties = {
  minWidth: '12rem',
  maxHeight: 320,
  overflow: 'auto',
  background: '#0b1220',
  color: '#e2e8f0',
  border: '1px solid #475569',
  borderRadius: 4,
  boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
  padding: 4,
  zIndex: 100000,
};

const itemRowStyle = (muted: boolean): React.CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '6px 10px',
  fontSize: 13,
  cursor: 'pointer',
  borderRadius: 2,
  outline: 'none',
  color: muted ? '#64748b' : '#cbd5e1',
});

const subTriggerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '6px 10px',
  fontSize: 13,
  cursor: 'pointer',
  borderRadius: 2,
  outline: 'none',
  color: '#cbd5e1',
  width: '100%',
  border: 'none',
  background: 'transparent',
  textAlign: 'left',
};

function applyVariableSelection(
  item: VariableMenuRowItem,
  onSelect: (label: string) => void,
  onExposeAndSelect?: (item: VariableMenuRowItem) => void
): void {
  if (item.isFromActiveFlow === false && onExposeAndSelect) {
    onExposeAndSelect(item);
    return;
  }
  if (!item.isExposed && onExposeAndSelect) {
    onExposeAndSelect(item);
    return;
  }
  onSelect(item.tokenLabel || item.varLabel);
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
      const item = entry.item;
      const isUnboundInterface = item.isInterfaceUnbound === true;
      const isSubflowRow = item.isFromActiveFlow === false;
      return (
        <DropdownMenu.Item
          key={key}
          className="outline-none select-none data-[highlighted]:bg-slate-700/80"
          style={itemRowStyle(isUnboundInterface)}
          onSelect={() => {
            applyVariableSelection(item, onSelect, onExposeAndSelect);
          }}
        >
          {isSubflowRow ? (
            <Workflow size={14} color={isUnboundInterface ? '#64748b' : '#38bdf8'} />
          ) : (
            <CircleDot size={14} color={item.isExposed ? '#38bdf8' : '#94a3b8'} />
          )}
          <span style={{ flex: 1, minWidth: 0 }}>{entry.displayLabel}</span>
        </DropdownMenu.Item>
      );
    }

    const Icon = entry.subflowGroup ? Workflow : Folder;
    const iconColor = entry.subflowGroup ? '#38bdf8' : '#64748b';
    return (
      <DropdownMenu.Sub key={key}>
        <DropdownMenu.SubTrigger style={subTriggerStyle} className="data-[state=open]:bg-slate-800/90 outline-none">
          <Icon size={14} color={iconColor} />
          <span style={{ flex: 1, minWidth: 0 }}>{entry.label}</span>
          <span style={{ color: '#64748b', fontSize: 10, marginLeft: 4 }} aria-hidden>
            ▸
          </span>
        </DropdownMenu.SubTrigger>
        <DropdownMenu.Portal>
          <DropdownMenu.SubContent
            sideOffset={4}
            alignOffset={-4}
            style={menuSurfaceStyle}
            className="outline-none"
          >
            {renderRadixEntries(entry.children, key, onSelect, onExposeAndSelect)}
          </DropdownMenu.SubContent>
        </DropdownMenu.Portal>
      </DropdownMenu.Sub>
    );
  });
}

export default function VariableTokenContextMenu({
  isOpen,
  x,
  y,
  variables,
  variableItems,
  onSelect,
  onExposeAndSelect,
  onClose,
}: Props) {
  const items: VariableMenuRowItem[] =
    variableItems ??
    variables.map((v) => ({
      varId: v,
      varLabel: v,
      tokenLabel: v,
      ownerFlowId: '',
      ownerFlowTitle: '',
      isExposed: true,
      isFromActiveFlow: true,
      sourceTaskRowLabel: '',
    }));

  const radixEntries = React.useMemo(() => buildRadixVariableMenuTree(items), [items]);

  const longestLen = items.reduce(
    (max, i) => Math.max(max, i.varLabel.length, i.ownerFlowTitle.length),
    variables.reduce((m, v) => Math.max(m, v.length), 12)
  );
  const menuMinWidthCh = Math.min(Math.max(longestLen + 8, 18), 48);

  if (!isOpen) return null;

  return (
    <DropdownMenu.Root
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      modal={false}
    >
      <DropdownMenu.Trigger asChild>
        <div
          style={{
            position: 'fixed',
            left: x,
            top: y,
            width: 1,
            height: 1,
            pointerEvents: 'none',
            zIndex: 99999,
          }}
          aria-hidden
        />
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          side="bottom"
          align="start"
          sideOffset={0}
          alignOffset={0}
          style={{ ...menuSurfaceStyle, minWidth: `${menuMinWidthCh}ch` }}
          className="outline-none"
          onEscapeKeyDown={() => onClose()}
          onPointerDownOutside={() => onClose()}
          onInteractOutside={() => onClose()}
        >
          {radixEntries.length === 0 ? (
            <div style={{ fontSize: 12, opacity: 0.75, padding: '4px 6px' }}>Nessuna variabile trovata</div>
          ) : (
            renderRadixEntries(radixEntries, 'root', onSelect, onExposeAndSelect)
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
