// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import React from 'react';
import { Settings, Trash2 } from 'lucide-react';
import { NodeContextMenu } from './NodeContextMenu';

interface NodeToolbarProps {
  nodeId: string;
  onDelete: () => void;
  onEditCaption?: () => void;
  onEditWords?: () => void;
  onAddAllWordsToHints?: () => void;
  onCopy?: () => void;
  onSetRepetitions?: () => void;
  onSetOptional?: () => void;
  onSetGarbage?: () => void;
  onBind?: () => void;
  onNoFreeSpeech?: () => void;
  onMatchInProgress?: () => void;
  onSetNodeContext?: () => void;
}

/**
 * Toolbar displayed to the right of a grammar node.
 * Gear button opens a fully custom dropdown menu on click.
 * Trash button deletes the node.
 */
export function NodeToolbar({
  nodeId,
  onDelete,
  onEditCaption,
  onEditWords,
  onAddAllWordsToHints,
  onCopy,
  onSetRepetitions,
  onSetOptional,
  onSetGarbage,
  onBind,
  onNoFreeSpeech,
  onMatchInProgress,
  onSetNodeContext,
}: NodeToolbarProps) {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const gearRef = React.useRef<HTMLButtonElement>(null);

  return (
    <div
      style={toolbarContainerStyle}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      {/* Gear button — opens menu on click, not on mousedown */}
      <button
        ref={gearRef}
        style={gearButtonStyle}
        onMouseDown={(e) => {
          // Block ReactFlow drag / selection start
          e.stopPropagation();
          // Do NOT prevent default here: we need the click event to fire
        }}
        onClick={(e) => {
          e.stopPropagation();
          setMenuOpen((prev) => !prev);
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = '#2d3448';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
        }}
        title="Node options"
      >
        <Settings size={13} />
      </button>

      {/* Trash button */}
      <button
        style={trashButtonStyle}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = '#dc2626';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = '#c9d1d9';
        }}
        title="Delete node"
      >
        <Trash2 size={13} />
      </button>

      {/* Fully custom dropdown — closes only on outside mousedown */}
      <NodeContextMenu
        anchorRef={gearRef}
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        nodeId={nodeId}
        onEditCaption={onEditCaption}
        onEditWords={onEditWords}
        onAddAllWordsToHints={onAddAllWordsToHints}
        onCopy={onCopy}
        onDelete={onDelete}
        onSetRepetitions={onSetRepetitions}
        onSetOptional={onSetOptional}
        onSetGarbage={onSetGarbage}
        onBind={onBind}
        onNoFreeSpeech={onNoFreeSpeech}
        onMatchInProgress={onMatchInProgress}
        onSetNodeContext={onSetNodeContext}
      />
    </div>
  );
}

const toolbarContainerStyle: React.CSSProperties = {
  position: 'absolute',
  left: '100%',
  top: '0px',
  display: 'flex',
  flexDirection: 'row',
  gap: '2px',
  zIndex: 20,
  backgroundColor: '#1a1f2e',
  borderRadius: '4px',
  padding: '2px',
  border: '1px solid #4a5568',
  marginLeft: '4px',
};

const gearButtonStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  padding: '3px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#c9d1d9',
  borderRadius: '3px',
};

const trashButtonStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  padding: '3px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#c9d1d9',
  borderRadius: '3px',
};
