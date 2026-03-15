// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import React from 'react';
import { Settings, Trash2 } from 'lucide-react';
import * as ContextMenu from '@radix-ui/react-context-menu';
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
 * Toolbar displayed in top-right corner of a grammar node.
 * Contains gear icon (opens context menu) and trash icon (deletes node).
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

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '100%', // Position above the node
        right: '0px',
        display: 'flex',
        gap: '4px',
        zIndex: 10,
        backgroundColor: '#1a1f2e',
        borderRadius: '4px 4px 0 0', // Rounded top corners only
        padding: '2px',
        border: '1px solid #4a5568',
        borderBottom: 'none', // No border on bottom to align with node
        marginBottom: '-1px', // Overlap border to align perfectly
      }}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <ContextMenu.Root open={menuOpen} onOpenChange={setMenuOpen}>
        <ContextMenu.Trigger asChild>
          <button
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#c9d1d9',
              borderRadius: '3px',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#2a2010';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
            title="Node options"
          >
            <Settings size={14} />
          </button>
        </ContextMenu.Trigger>
        <NodeContextMenu
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
      </ContextMenu.Root>

      <button
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          onDelete();
        }}
        style={{
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          padding: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#c9d1d9', // Default color
          borderRadius: '3px',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = '#dc2626'; // Red foreground on hover
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = '#c9d1d9'; // Back to default
        }}
        title="Delete node"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}
