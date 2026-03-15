// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import React from 'react';
import * as ContextMenu from '@radix-ui/react-context-menu';
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
  nodeId: string;
  onEditCaption?: () => void;
  onEditWords?: () => void;
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
 * Complex context menu for grammar nodes.
 * Uses Radix UI ContextMenu for accessibility and submenu support.
 */
export function NodeContextMenu({
  nodeId,
  onEditCaption,
  onEditWords,
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
  return (
    <>
      <style>{`
        .grammar-node-context-menu .context-menu-item[data-highlighted] {
          background-color: #2a2010 !important;
        }
        .grammar-node-context-menu .context-menu-item[data-disabled] {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
      <ContextMenu.Portal>
        <ContextMenu.Content
          className="grammar-node-context-menu"
          style={{
            minWidth: '220px',
            backgroundColor: '#1a1f2e',
            border: '1px solid #4a5568',
            borderRadius: '6px',
            padding: '4px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
            zIndex: 10000,
          }}
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
        {/* Append submenu */}
        <ContextMenu.Sub>
          <ContextMenu.SubTrigger
            className="context-menu-item"
            style={menuItemStyle}
          >
            <span>Append</span>
            <ChevronRight size={14} style={{ marginLeft: 'auto' }} />
          </ContextMenu.SubTrigger>
          <ContextMenu.Portal>
            <ContextMenu.SubContent
              style={submenuStyle}
              onCloseAutoFocus={(e) => e.preventDefault()}
            >
              <ContextMenu.Item
                className="context-menu-item"
                style={menuItemStyle}
                onSelect={(e) => {
                  e.preventDefault();
                  console.log('Append Normal Node');
                }}
              >
                <span>Normal Node</span>
                <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#6b7280' }}>
                  Ctrl+N
                </span>
              </ContextMenu.Item>
              <ContextMenu.Sub>
                <ContextMenu.SubTrigger
                  className="context-menu-item"
                  style={menuItemStyle}
                >
                  <span>Garbage Node</span>
                  <ChevronRight size={14} style={{ marginLeft: 'auto' }} />
                </ContextMenu.SubTrigger>
                <ContextMenu.Portal>
                  <ContextMenu.SubContent
                    style={submenuStyle}
                    onCloseAutoFocus={(e) => e.preventDefault()}
                  >
                    <ContextMenu.Item
                      className="context-menu-item"
                      style={menuItemStyle}
                      onSelect={(e) => {
                        e.preventDefault();
                        console.log('Append Garbage Node');
                      }}
                    >
                      <span>Garbage Node</span>
                    </ContextMenu.Item>
                  </ContextMenu.SubContent>
                </ContextMenu.Portal>
              </ContextMenu.Sub>
              <ContextMenu.Sub>
                <ContextMenu.SubTrigger
                  className="context-menu-item"
                  style={menuItemStyle}
                >
                  <span>Grammar Node</span>
                  <ChevronRight size={14} style={{ marginLeft: 'auto' }} />
                </ContextMenu.SubTrigger>
                <ContextMenu.Portal>
                  <ContextMenu.SubContent
                    style={submenuStyle}
                    onCloseAutoFocus={(e) => e.preventDefault()}
                  >
                    <ContextMenu.Item
                      className="context-menu-item"
                      style={menuItemStyle}
                      onSelect={(e) => {
                        e.preventDefault();
                        console.log('Append Grammar Node');
                      }}
                    >
                      <span>Grammar Node</span>
                    </ContextMenu.Item>
                  </ContextMenu.SubContent>
                </ContextMenu.Portal>
              </ContextMenu.Sub>
            </ContextMenu.SubContent>
          </ContextMenu.Portal>
        </ContextMenu.Sub>

        {/* Edit Caption */}
        <ContextMenu.Item
          className="context-menu-item"
          style={menuItemStyle}
          onSelect={(e) => {
            e.preventDefault();
            onEditCaption?.();
          }}
        >
          <Edit size={14} style={{ marginRight: '8px' }} />
          <span>Edit Caption</span>
          <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#6b7280' }}>
            F2
          </span>
        </ContextMenu.Item>

        {/* Notes */}
        <ContextMenu.Item
          className="context-menu-item"
          style={menuItemStyle}
          onSelect={(e) => {
            e.preventDefault();
            console.log('Notes');
          }}
        >
          <FileText size={14} style={{ marginRight: '8px' }} />
          <span>Notes</span>
        </ContextMenu.Item>

        <ContextMenu.Separator style={separatorStyle} />

        {/* Edit Words */}
        <ContextMenu.Item
          className="context-menu-item"
          style={menuItemStyle}
          onSelect={(e) => {
            e.preventDefault();
            onEditWords?.();
          }}
        >
          <MessageSquare size={14} style={{ marginRight: '8px' }} />
          <span>Edit Words</span>
          <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#6b7280' }}>
            Ctrl+W
          </span>
        </ContextMenu.Item>

        <ContextMenu.Item
          className="context-menu-item"
          style={menuItemStyle}
          onSelect={(e) => {
            e.preventDefault();
            onAddAllWordsToHints?.();
          }}
        >
          <span>Add All Node Words To Hints</span>
        </ContextMenu.Item>

        <ContextMenu.Separator style={separatorStyle} />

        {/* Copy */}
        <ContextMenu.Item
          className="context-menu-item"
          style={menuItemStyle}
          onSelect={(e) => {
            e.preventDefault();
            onCopy?.();
          }}
        >
          <Copy size={14} style={{ marginRight: '8px' }} />
          <span>Copy</span>
          <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#6b7280' }}>
            Ctrl+C
          </span>
        </ContextMenu.Item>

        {/* Delete Node */}
        <ContextMenu.Item
          className="context-menu-item"
          style={{ ...menuItemStyle, color: '#dc2626' }}
          onSelect={(e) => {
            e.preventDefault();
            onDelete?.();
          }}
        >
          <X size={14} style={{ marginRight: '8px' }} />
          <span>Delete Node</span>
          <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#6b7280' }}>
            CANC
          </span>
        </ContextMenu.Item>

        <ContextMenu.Separator style={separatorStyle} />

        {/* Set Repetitions */}
        <ContextMenu.Item
          className="context-menu-item"
          style={menuItemStyle}
          onSelect={(e) => {
            e.preventDefault();
            onSetRepetitions?.();
          }}
        >
          <Hash size={14} style={{ marginRight: '8px' }} />
          <span>Set Repetitions</span>
          <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#6b7280' }}>
            Ctrl+R
          </span>
        </ContextMenu.Item>

        {/* Set As Optional */}
        <ContextMenu.Item
          className="context-menu-item"
          style={menuItemStyle}
          onSelect={(e) => {
            e.preventDefault();
            onSetOptional?.();
          }}
        >
          <Square size={14} style={{ marginRight: '8px' }} />
          <span>Set As Optional</span>
          <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#6b7280' }}>
            Ctrl+O
          </span>
        </ContextMenu.Item>

        {/* Set As Garbage */}
        <ContextMenu.Item
          className="context-menu-item"
          style={menuItemStyle}
          onSelect={(e) => {
            e.preventDefault();
            onSetGarbage?.();
          }}
        >
          <Trash2 size={14} style={{ marginRight: '8px' }} />
          <span>Set As Garbage</span>
        </ContextMenu.Item>

        {/* Regular Expression (with submenu) */}
        <ContextMenu.Sub>
          <ContextMenu.SubTrigger
            className="context-menu-item"
            style={menuItemStyle}
          >
            <Code size={14} style={{ marginRight: '8px' }} />
            <span>Regular Expression</span>
            <ChevronRight size={14} style={{ marginLeft: 'auto' }} />
          </ContextMenu.SubTrigger>
          <ContextMenu.Portal>
            <ContextMenu.SubContent
              style={submenuStyle}
              onCloseAutoFocus={(e) => e.preventDefault()}
            >
              <ContextMenu.Item
                className="context-menu-item"
                style={menuItemStyle}
                onSelect={(e) => {
                  e.preventDefault();
                  console.log('Regular Expression options');
                }}
              >
                <span>Regex Options</span>
              </ContextMenu.Item>
            </ContextMenu.SubContent>
          </ContextMenu.Portal>
        </ContextMenu.Sub>

        {/* Processing (with submenu) */}
        <ContextMenu.Sub>
          <ContextMenu.SubTrigger
            className="context-menu-item"
            style={menuItemStyle}
          >
            <Settings size={14} style={{ marginRight: '8px' }} />
            <span>Processing</span>
            <ChevronRight size={14} style={{ marginLeft: 'auto' }} />
          </ContextMenu.SubTrigger>
          <ContextMenu.Portal>
            <ContextMenu.SubContent
              style={submenuStyle}
              onCloseAutoFocus={(e) => e.preventDefault()}
            >
              <ContextMenu.Item
                className="context-menu-item"
                style={menuItemStyle}
                onSelect={(e) => {
                  e.preventDefault();
                  console.log('Processing options');
                }}
              >
                <span>Processing Options</span>
              </ContextMenu.Item>
            </ContextMenu.SubContent>
          </ContextMenu.Portal>
        </ContextMenu.Sub>

        <ContextMenu.Separator style={separatorStyle} />

        {/* Bind */}
        <ContextMenu.Item
          className="context-menu-item"
          style={menuItemStyle}
          onSelect={(e) => {
            e.preventDefault();
            onBind?.();
          }}
        >
          <Link size={14} style={{ marginRight: '8px' }} />
          <span>Bind</span>
        </ContextMenu.Item>

        {/* No Free Speech */}
        <ContextMenu.Item
          className="context-menu-item"
          style={menuItemStyle}
          onSelect={(e) => {
            e.preventDefault();
            onNoFreeSpeech?.();
          }}
        >
          <Mic size={14} style={{ marginRight: '8px' }} />
          <span>No Free Speech</span>
        </ContextMenu.Item>

        {/* Match In Progress */}
        <ContextMenu.Item
          className="context-menu-item"
          style={menuItemStyle}
          onSelect={(e) => {
            e.preventDefault();
            onMatchInProgress?.();
          }}
        >
          <Play size={14} style={{ marginRight: '8px' }} />
          <span>Match In Progress</span>
        </ContextMenu.Item>

        <ContextMenu.Separator style={separatorStyle} />

        {/* Set node context */}
        <ContextMenu.Item
          className="context-menu-item"
          style={menuItemStyle}
          onSelect={(e) => {
            e.preventDefault();
            onSetNodeContext?.();
          }}
        >
          <Parentheses size={14} style={{ marginRight: '8px' }} />
          <span>Set node context</span>
        </ContextMenu.Item>
      </ContextMenu.Content>
    </ContextMenu.Portal>
    </>
  );
}

// Shared styles
const menuItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  padding: '6px 12px',
  fontSize: '13px',
  color: '#c9d1d9',
  cursor: 'pointer',
  borderRadius: '4px',
  outline: 'none',
  userSelect: 'none',
};

const separatorStyle: React.CSSProperties = {
  height: '1px',
  backgroundColor: '#4a5568',
  margin: '4px 0',
};

const submenuStyle: React.CSSProperties = {
  minWidth: '180px',
  backgroundColor: '#1a1f2e',
  border: '1px solid #4a5568',
  borderRadius: '6px',
  padding: '4px',
  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
};
