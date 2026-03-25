// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import React from 'react';
import ReactDOM from 'react-dom';
import {
  Edit,
  FileText,
  MessageSquare,
  Copy,
  X,
  Hash,
  Square,
  Trash2,
  Code,
  Settings,
  Link,
  Mic,
  Play,
  Parentheses,
  ChevronRight,
} from 'lucide-react';

interface NodeContextMenuProps {
  /** Anchor element — the gear button DOM node */
  anchorRef: React.RefObject<HTMLButtonElement>;
  open: boolean;
  onClose: () => void;
  nodeId: string;
  onEditCaption?: () => void;
  onEditWords?: () => void;
  editWordsDisabled?: boolean;
  editWordsDisabledTitle?: string;
  onAddAllWordsToHints?: () => void;
  onCopy?: () => void;
  onDelete?: () => void;
  onSetRepetitions?: () => void;
  onSetOptional?: () => void;
  onSetGarbage?: () => void;
  onBind?: () => void;
  onNoFreeSpeech?: () => void;
  onMatchInProgress?: () => void;
  onSetNodeContext?: () => void;
}

/**
 * Fully custom dropdown menu for grammar nodes.
 * Opens on click, closes only on outside mousedown.
 * Does NOT use Radix DropdownMenu to avoid mousedown/mouseup conflicts.
 */
export function NodeContextMenu({
  anchorRef,
  open,
  onClose,
  onEditCaption,
  onEditWords,
  editWordsDisabled,
  editWordsDisabledTitle,
  onAddAllWordsToHints,
  onCopy,
  onDelete,
  onSetRepetitions,
  onSetOptional,
  onSetGarbage,
  onBind,
  onNoFreeSpeech,
  onMatchInProgress,
  onSetNodeContext,
}: NodeContextMenuProps) {
  const menuRef = React.useRef<HTMLDivElement>(null);
  const [pos, setPos] = React.useState({ top: 0, left: 0 });
  const [activeSubmenu, setActiveSubmenu] = React.useState<string | null>(null);

  // Compute position from anchor when open
  React.useLayoutEffect(() => {
    if (!open || !anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    setPos({
      top: rect.bottom + 4,
      left: rect.right,
    });
    setActiveSubmenu(null);
  }, [open, anchorRef]);

  // Close on outside mousedown
  React.useEffect(() => {
    if (!open) return;

    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        menuRef.current && menuRef.current.contains(target)
      ) return;
      if (
        anchorRef.current && anchorRef.current.contains(target)
      ) return;
      onClose();
    };

    // Use mousedown (not click) so it fires before click
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [open, onClose, anchorRef]);

  // Close on ESC
  React.useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  const handleItem = (callback?: () => void) => {
    callback?.();
    onClose();
  };

  const menu = (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        top: pos.top,
        left: pos.left,
        transform: 'translateX(-100%)',
        minWidth: '220px',
        backgroundColor: '#1a1f2e',
        border: '1px solid #4a5568',
        borderRadius: '6px',
        padding: '4px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
        zIndex: 99999,
        userSelect: 'none',
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <style>{`
        .gcm-item:hover { background-color: #2d3448; }
        .gcm-item { cursor: pointer; }
      `}</style>

      {/* Append submenu */}
      <div style={{ position: 'relative' }}>
        <div
          className="gcm-item"
          style={itemStyle}
          onMouseEnter={() => setActiveSubmenu('append')}
          onMouseLeave={() => setActiveSubmenu(null)}
        >
          <span>Append</span>
          <ChevronRight size={14} style={{ marginLeft: 'auto' }} />
        </div>
        {activeSubmenu === 'append' && (
          <div
            style={submenuStyle}
            onMouseEnter={() => setActiveSubmenu('append')}
            onMouseLeave={() => setActiveSubmenu(null)}
          >
            <div className="gcm-item" style={itemStyle} onClick={() => handleItem()}>
              <span>Normal Node</span>
              <span style={kbdStyle}>Ctrl+N</span>
            </div>
            <div className="gcm-item" style={itemStyle} onClick={() => handleItem()}>
              <span>Garbage Node</span>
            </div>
            <div className="gcm-item" style={itemStyle} onClick={() => handleItem()}>
              <span>Grammar Node</span>
            </div>
          </div>
        )}
      </div>

      <div className="gcm-item" style={itemStyle} onClick={() => handleItem(onEditCaption)}>
        <Edit size={14} style={iconStyle} />
        <span>Edit Caption</span>
        <span style={kbdStyle}>F2</span>
      </div>

      <div className="gcm-item" style={itemStyle} onClick={() => handleItem()}>
        <FileText size={14} style={iconStyle} />
        <span>Notes</span>
      </div>

      <div style={separatorStyle} />

      <div
        className="gcm-item"
        style={{
          ...itemStyle,
          ...(editWordsDisabled ? { opacity: 0.45, cursor: 'not-allowed' } : {}),
        }}
        title={editWordsDisabled ? editWordsDisabledTitle : undefined}
        onClick={() => {
          if (editWordsDisabled) return;
          handleItem(onEditWords);
        }}
      >
        <MessageSquare size={14} style={iconStyle} />
        <span>Edit Words</span>
        <span style={kbdStyle}>Ctrl+W</span>
      </div>

      <div className="gcm-item" style={itemStyle} onClick={() => handleItem(onAddAllWordsToHints)}>
        <span>Add All Node Words To Hints</span>
      </div>

      <div style={separatorStyle} />

      <div className="gcm-item" style={itemStyle} onClick={() => handleItem(onCopy)}>
        <Copy size={14} style={iconStyle} />
        <span>Copy</span>
        <span style={kbdStyle}>Ctrl+C</span>
      </div>

      <div
        className="gcm-item"
        style={{ ...itemStyle, color: '#dc2626' }}
        onClick={() => handleItem(onDelete)}
      >
        <X size={14} style={iconStyle} />
        <span>Delete Node</span>
        <span style={{ ...kbdStyle, color: '#dc2626' }}>CANC</span>
      </div>

      <div style={separatorStyle} />

      <div className="gcm-item" style={itemStyle} onClick={() => handleItem(onSetRepetitions)}>
        <Hash size={14} style={iconStyle} />
        <span>Set Repetitions</span>
        <span style={kbdStyle}>Ctrl+R</span>
      </div>

      <div className="gcm-item" style={itemStyle} onClick={() => handleItem(onSetOptional)}>
        <Square size={14} style={iconStyle} />
        <span>Set As Optional</span>
        <span style={kbdStyle}>Ctrl+O</span>
      </div>

      <div className="gcm-item" style={itemStyle} onClick={() => handleItem(onSetGarbage)}>
        <Trash2 size={14} style={iconStyle} />
        <span>Set As Garbage</span>
      </div>

      {/* Regular Expression submenu */}
      <div style={{ position: 'relative' }}>
        <div
          className="gcm-item"
          style={itemStyle}
          onMouseEnter={() => setActiveSubmenu('regex')}
          onMouseLeave={() => setActiveSubmenu(null)}
        >
          <Code size={14} style={iconStyle} />
          <span>Regular Expression</span>
          <ChevronRight size={14} style={{ marginLeft: 'auto' }} />
        </div>
        {activeSubmenu === 'regex' && (
          <div
            style={submenuStyle}
            onMouseEnter={() => setActiveSubmenu('regex')}
            onMouseLeave={() => setActiveSubmenu(null)}
          >
            <div className="gcm-item" style={itemStyle} onClick={() => handleItem()}>
              <span>Regex Options</span>
            </div>
          </div>
        )}
      </div>

      {/* Processing submenu */}
      <div style={{ position: 'relative' }}>
        <div
          className="gcm-item"
          style={itemStyle}
          onMouseEnter={() => setActiveSubmenu('processing')}
          onMouseLeave={() => setActiveSubmenu(null)}
        >
          <Settings size={14} style={iconStyle} />
          <span>Processing</span>
          <ChevronRight size={14} style={{ marginLeft: 'auto' }} />
        </div>
        {activeSubmenu === 'processing' && (
          <div
            style={submenuStyle}
            onMouseEnter={() => setActiveSubmenu('processing')}
            onMouseLeave={() => setActiveSubmenu(null)}
          >
            <div className="gcm-item" style={itemStyle} onClick={() => handleItem()}>
              <span>Processing Options</span>
            </div>
          </div>
        )}
      </div>

      <div style={separatorStyle} />

      <div className="gcm-item" style={itemStyle} onClick={() => handleItem(onBind)}>
        <Link size={14} style={iconStyle} />
        <span>Bind</span>
      </div>

      <div className="gcm-item" style={itemStyle} onClick={() => handleItem(onNoFreeSpeech)}>
        <Mic size={14} style={iconStyle} />
        <span>No Free Speech</span>
      </div>

      <div className="gcm-item" style={itemStyle} onClick={() => handleItem(onMatchInProgress)}>
        <Play size={14} style={iconStyle} />
        <span>Match In Progress</span>
      </div>

      <div style={separatorStyle} />

      <div className="gcm-item" style={itemStyle} onClick={() => handleItem(onSetNodeContext)}>
        <Parentheses size={14} style={iconStyle} />
        <span>Set node context</span>
      </div>
    </div>
  );

  return ReactDOM.createPortal(menu, document.body);
}

const itemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  padding: '6px 12px',
  fontSize: '13px',
  color: '#c9d1d9',
  borderRadius: '4px',
  outline: 'none',
  gap: '8px',
  whiteSpace: 'nowrap',
};

const iconStyle: React.CSSProperties = {
  flexShrink: 0,
};

const kbdStyle: React.CSSProperties = {
  marginLeft: 'auto',
  fontSize: '11px',
  color: '#6b7280',
  paddingLeft: '16px',
};

const separatorStyle: React.CSSProperties = {
  height: '1px',
  backgroundColor: '#4a5568',
  margin: '4px 0',
};

const submenuStyle: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  right: '100%',
  marginRight: '2px',
  minWidth: '180px',
  backgroundColor: '#1a1f2e',
  border: '1px solid #4a5568',
  borderRadius: '6px',
  padding: '4px',
  boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
  zIndex: 100000,
};
