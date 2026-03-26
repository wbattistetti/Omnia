import React from 'react';
import { ChevronRight, CircleDot, Workflow } from 'lucide-react';

type Props = {
  isOpen: boolean;
  x: number;
  y: number;
  variables: string[];
  variableItems?: Array<{
    varId: string;
    varLabel: string;
    tokenLabel?: string;
    ownerFlowId?: string;
    ownerFlowTitle: string;
    isExposed: boolean;
    isFromActiveFlow?: boolean;
    sourceTaskRowLabel?: string;
  }>;
  onSelect: (variableLabel: string) => void;
  onExposeAndSelect?: (item: {
    varId: string;
    varLabel: string;
    tokenLabel?: string;
    ownerFlowId?: string;
    ownerFlowTitle: string;
    isExposed: boolean;
    isFromActiveFlow?: boolean;
    sourceTaskRowLabel?: string;
  }) => void;
  onClose: () => void;
};

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
  const rootRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!isOpen) return;
    const closeIfOutside = (ev: MouseEvent) => {
      const el = rootRef.current;
      if (!el) return;
      const target = ev.target as Node | null;
      if (target && el.contains(target)) return;
      onClose();
    };
    window.addEventListener('mousedown', closeIfOutside, true);
    return () => window.removeEventListener('mousedown', closeIfOutside, true);
  }, [isOpen, onClose]);

  const labels = variableItems?.map((i) => i.varLabel) ?? variables;
  const items = variableItems ?? variables.map((v) => ({
    varId: v,
    varLabel: v,
    tokenLabel: v,
    ownerFlowId: '',
    ownerFlowTitle: '',
    isExposed: true,
    isFromActiveFlow: true,
    sourceTaskRowLabel: '',
  }));
  const longestLen = items.reduce(
    (max, i) => Math.max(max, i.varLabel.length, i.ownerFlowTitle.length),
    labels.reduce((m, v) => Math.max(m, v.length), 12)
  );
  const menuWidthCh = Math.min(Math.max(longestLen + 8, 18), 48);
  const rootVariables = items.filter((i) => i.isFromActiveFlow !== false);
  const childrenGroups = items
    .filter((i) => i.isFromActiveFlow === false)
    .reduce<Record<string, typeof items>>((acc, item) => {
      const key = item.sourceTaskRowLabel || item.ownerFlowTitle || item.ownerFlowId || 'Subflow';
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    }, {});
  const childFlowNames = Object.keys(childrenGroups).sort((a, b) => a.localeCompare(b));
  const [openChildFlowName, setOpenChildFlowName] = React.useState<string | null>(null);
  const submenuItems = openChildFlowName ? childrenGroups[openChildFlowName] || [] : [];

  if (!isOpen) return null;

  return (
    <div ref={rootRef} style={{ position: 'fixed', left: x, top: y, zIndex: 100000, display: 'flex', alignItems: 'flex-start' }}>
      <div
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width: `${menuWidthCh}ch`,
          maxHeight: 320,
          overflow: 'auto',
          background: '#0b1220',
          color: '#e2e8f0',
          border: '1px solid #475569',
          borderRadius: 4,
          boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
          padding: 4,
        }}
      >
        {items.length === 0 ? (
          <div style={{ fontSize: 12, opacity: 0.75, padding: '4px 6px' }}>Nessuna variabile trovata</div>
        ) : (
          <>
            {rootVariables.map((item) => (
              <button
                key={`${item.ownerFlowTitle}-${item.varId}-${item.varLabel}`}
                type="button"
                onClick={() => {
                  if (!item.isExposed && onExposeAndSelect) {
                    onExposeAndSelect(item);
                    return;
                  }
                  onSelect(item.tokenLabel || item.varLabel);
                }}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  background: 'transparent',
                  color: '#cbd5e1',
                  border: 'none',
                  borderRadius: 2,
                  padding: '4px 6px',
                  cursor: 'pointer',
                  fontSize: 13,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <CircleDot size={14} color={item.isExposed ? '#38bdf8' : '#94a3b8'} />
                <span style={{ flex: 1, minWidth: 0 }}>{item.varLabel}</span>
              </button>
            ))}
            {rootVariables.length > 0 && childFlowNames.length > 0 ? (
              <div style={{ height: 1, background: '#334155', margin: '4px 2px' }} />
            ) : null}
            {childFlowNames.map((flowName) => (
              <button
                key={`flow-${flowName}`}
                type="button"
                onMouseEnter={() => setOpenChildFlowName(flowName)}
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenChildFlowName(flowName);
                }}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  background: openChildFlowName === flowName ? '#1e293b' : 'transparent',
                  color: '#cbd5e1',
                  border: 'none',
                  borderRadius: 2,
                  padding: '4px 6px',
                  cursor: 'pointer',
                  fontSize: 13,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <Workflow size={14} color="#38bdf8" />
                <span style={{ flex: 1, minWidth: 0 }}>{flowName}</span>
                <ChevronRight size={14} color="#94a3b8" />
              </button>
            ))}
          </>
        )}
      </div>
      {openChildFlowName && submenuItems.length > 0 ? (
        <div
          onMouseDown={(e) => e.stopPropagation()}
          style={{
            marginLeft: 2,
            minWidth: `${Math.min(Math.max(longestLen + 6, 16), 42)}ch`,
            maxHeight: 320,
            overflow: 'auto',
            background: '#0b1220',
            color: '#e2e8f0',
            border: '1px solid #475569',
            borderRadius: 4,
            boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
            padding: 4,
          }}
        >
          {submenuItems.map((item) => (
            <button
              key={`child-${item.ownerFlowTitle}-${item.varId}-${item.varLabel}`}
              type="button"
              onClick={() => {
                if (!item.isExposed && onExposeAndSelect) {
                  onExposeAndSelect(item);
                  return;
                }
                onSelect(item.tokenLabel || item.varLabel);
              }}
              style={{
                width: '100%',
                textAlign: 'left',
                background: 'transparent',
                color: '#cbd5e1',
                border: 'none',
                borderRadius: 2,
                padding: '4px 6px',
                cursor: 'pointer',
                fontSize: 13,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <CircleDot size={14} color={item.isExposed ? '#38bdf8' : '#94a3b8'} />
              <span>{item.varLabel}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
