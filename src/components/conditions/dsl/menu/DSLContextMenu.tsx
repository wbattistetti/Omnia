// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight } from 'lucide-react';
import { getAllFunctionNames, getBuiltinFunction } from '../compiler/builtinFunctions';
import { dslFlatVariableDisplayKey, dslTreeNodeDisplayLabel } from '@utils/dslVariableUiLabel';

interface DSLContextMenuProps {
  position: { x: number; y: number };
  variables?: Record<string, any>;
  variablesTree?: any[];
  translations?: Record<string, string>;
  onInsert: (text: string) => void;
  onClose: () => void;
  editor?: any; // Monaco editor instance
  monaco?: any; // Monaco namespace
}

export function DSLContextMenu({
  position,
  variables,
  variablesTree,
  translations = {},
  onInsert,
  onClose,
  editor,
  monaco,
}: DSLContextMenuProps) {
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [expandedSubmenu, setExpandedSubmenu] = useState<'variables' | 'functions' | 'constants' | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const menuRef = useRef<HTMLDivElement>(null);
  const submenuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menuRef.current && !menuRef.current.contains(target)) {
        if (submenuRef.current && submenuRef.current.contains(target)) {
          return; // Don't close if clicking in submenu
        }
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside, { capture: true });
    return () => document.removeEventListener('mousedown', handleClickOutside, { capture: true });
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const handleInsert = (text: string) => {
    onInsert(text);
    onClose();
  };

  const toggleNode = (path: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedNodes(newExpanded);
  };

  const renderVariablesSubmenu = () => {
    // Priority 1: Use variablesTree if available (hierarchical structure from task templates)
    if (variablesTree && Array.isArray(variablesTree) && variablesTree.length > 0) {
      return variablesTree.map((act: any, actIdx: number) => {
        const actMains = act.mains && Array.isArray(act.mains) ? act.mains : [];
        if (actMains.length === 0) return null;
        const actDisp = dslTreeNodeDisplayLabel(act, translations);

        return (
          <div key={actIdx} className="mb-3">
            {actDisp ? (
              <div className="px-2 py-1 text-xs text-gray-400 font-semibold mb-1">{actDisp}</div>
            ) : null}
            {actMains.map((main: any, mainIdx: number) => {
              const mainPath = `${actIdx}-${mainIdx}`;
              const isExpanded = expandedNodes.has(mainPath);
              const hasSubs = main.subs && Array.isArray(main.subs) && main.subs.length > 0;
              const mainDisp = dslTreeNodeDisplayLabel(main, translations);
              const fullMainLabel = actDisp ? `${actDisp}.${mainDisp}` : mainDisp;

              return (
                <div key={mainIdx} className="mb-1">
                  <div
                    className="flex items-center gap-1 px-2 py-1 hover:bg-gray-700 cursor-pointer rounded text-sm"
                    onClick={() => {
                      if (hasSubs) {
                        toggleNode(mainPath);
                      } else {
                        handleInsert(`[${fullMainLabel}]`);
                      }
                    }}
                  >
                    {hasSubs && (
                      isExpanded ? <ChevronRight size={12} className="rotate-90" /> : <ChevronRight size={12} />
                    )}
                    <span className="text-blue-300">[{fullMainLabel}]</span>
                  </div>
                  {hasSubs && isExpanded && (
                    <div className="ml-4">
                      {main.subs.map((sub: any, subIdx: number) => {
                        const subDisp = dslTreeNodeDisplayLabel(sub, translations);
                        const fullSubLabel = `${fullMainLabel}.${subDisp}`;
                        return (
                          <div
                            key={subIdx}
                            className="px-2 py-1 hover:bg-gray-700 cursor-pointer rounded text-sm text-blue-200"
                            onClick={() => handleInsert(`[${fullSubLabel}]`)}
                          >
                            [{fullSubLabel}]
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      }).filter(Boolean);
    }

    // Priority 2: Build flat list from flowchart variables (global variables from flowchart)
    // These are ALL global variables extracted from all tasks in the flowchart
    // This ensures all flowchart variables are visible, even if variablesTree is empty
    if (variables && Object.keys(variables).length > 0) {
      const varKeys = Object.keys(variables).sort();
      return (
        <div className="py-1">
          {varKeys.map((key) => {
            const display = dslFlatVariableDisplayKey(key, translations);
            return (
              <div
                key={key}
                className="px-2 py-1 hover:bg-gray-700 cursor-pointer rounded text-sm text-blue-300"
                onClick={() => handleInsert(`[${display}]`)}
              >
                [{display}]
              </div>
            );
          })}
        </div>
      );
    }

    return <div className="text-sm text-gray-400 px-2 py-2">No flowchart variables available</div>;
  };

  const renderFunctionsSubmenu = () => {
    const functionNames = getAllFunctionNames();
    return functionNames.map((fnName) => {
      const fnDef = getBuiltinFunction(fnName);
      const args = fnDef ? Array(fnDef.minArgs).fill('').map((_, i) => `arg${i + 1}`).join(', ') : '';
      return (
        <div
          key={fnName}
          className="px-2 py-1 hover:bg-gray-700 cursor-pointer rounded text-sm"
          onClick={() => handleInsert(`${fnName}(${args})`)}
        >
          <div className="text-yellow-300 font-mono">{fnName}({args})</div>
          {fnDef && (
            <div className="text-xs text-gray-400 mt-1">{fnDef.description}</div>
          )}
        </div>
      );
    });
  };

  const renderConstantsSubmenu = () => {
    return (
      <>
        <div
          className="px-2 py-1 hover:bg-gray-700 cursor-pointer rounded text-sm text-green-300"
          onClick={() => handleInsert('TRUE')}
        >
          TRUE
        </div>
        <div
          className="px-2 py-1 hover:bg-gray-700 cursor-pointer rounded text-sm text-green-300"
          onClick={() => handleInsert('FALSE')}
        >
          FALSE
        </div>
        <div
          className="px-2 py-1 hover:bg-gray-700 cursor-pointer rounded text-sm text-gray-300"
          onClick={() => handleInsert('""')}
        >
          "string"
        </div>
        <div
          className="px-2 py-1 hover:bg-gray-700 cursor-pointer rounded text-sm text-gray-300"
          onClick={() => handleInsert('0')}
        >
          number
        </div>
      </>
    );
  };

  const handleUndo = () => {
    if (editor) {
      editor.trigger('keyboard', 'undo', {});
    }
    onClose();
  };

  const handleRedo = () => {
    if (editor) {
      editor.trigger('keyboard', 'redo', {});
    }
    onClose();
  };

  const handleCopy = () => {
    if (editor) {
      editor.trigger('keyboard', 'editor.action.clipboardCopyAction', {});
    }
    onClose();
  };

  const handlePaste = () => {
    if (editor) {
      editor.trigger('keyboard', 'editor.action.clipboardPasteAction', {});
    }
    onClose();
  };

  const handleDelete = () => {
    if (editor && monaco) {
      const selection = editor.getSelection();
      if (selection) {
        editor.executeEdits('delete', [{
          range: selection,
          text: '',
        }]);
      }
    }
    onClose();
  };

  const handleSelectAll = () => {
    if (editor && monaco) {
      const model = editor.getModel();
      if (model) {
        const fullRange = model.getFullModelRange();
        editor.setSelection(fullRange);
      }
    }
    onClose();
  };

  const menuStyle: React.CSSProperties = {
    position: 'fixed',
    left: `${position.x}px`,
    top: `${position.y}px`,
    zIndex: 100000,
  };

  const submenuStyle: React.CSSProperties = {
    position: 'fixed',
    left: `${position.x + 200}px`, // Position to the right of main menu
    top: `${position.y}px`,
    zIndex: 100001,
  };

  return createPortal(
    <>
      <div
        ref={menuRef}
        className="bg-gray-800 border border-gray-700 rounded-lg shadow-lg min-w-[180px]"
        style={menuStyle}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="px-3 py-2 hover:bg-gray-700 cursor-pointer flex items-center justify-between text-sm text-gray-200"
          onMouseEnter={() => {
            setHoveredItem('insert');
            if (!expandedSubmenu) {
              setExpandedSubmenu('variables'); // Default to variables
            }
          }}
          onMouseLeave={() => {
            // Don't close immediately - allow time to move to submenu
            setTimeout(() => {
              if (!submenuRef.current?.matches(':hover') && !menuRef.current?.querySelector(':hover')) {
                setExpandedSubmenu(null);
                setHoveredItem(null);
              }
            }, 150);
          }}
        >
          <span>Insert</span>
          <ChevronRight size={14} />
        </div>
        <div className="border-t border-gray-700" />
        <div
          className="px-3 py-2 hover:bg-gray-700 cursor-pointer text-sm text-gray-200"
          onClick={handleUndo}
        >
          Undo
        </div>
        <div
          className="px-3 py-2 hover:bg-gray-700 cursor-pointer text-sm text-gray-200"
          onClick={handleRedo}
        >
          Redo
        </div>
        <div className="border-t border-gray-700" />
        <div
          className="px-3 py-2 hover:bg-gray-700 cursor-pointer text-sm text-gray-200"
          onClick={handleCopy}
        >
          Copy
        </div>
        <div
          className="px-3 py-2 hover:bg-gray-700 cursor-pointer text-sm text-gray-200"
          onClick={handlePaste}
        >
          Paste
        </div>
        <div
          className="px-3 py-2 hover:bg-gray-700 cursor-pointer text-sm text-gray-200"
          onClick={handleDelete}
        >
          Delete
        </div>
        <div className="border-t border-gray-700" />
        <div
          className="px-3 py-2 hover:bg-gray-700 cursor-pointer text-sm text-gray-200"
          onClick={handleSelectAll}
        >
          Select All
        </div>
      </div>

      {/* Submenu for Insert */}
      {hoveredItem === 'insert' && expandedSubmenu && (
        <div
          ref={submenuRef}
          className="bg-gray-800 border border-gray-700 rounded-lg shadow-lg w-64 max-h-96 overflow-auto"
          style={submenuStyle}
          onMouseEnter={() => {
            // Keep submenu open when hovering over it
            setHoveredItem('insert');
          }}
          onMouseLeave={() => {
            // Close when leaving submenu area
            setExpandedSubmenu(null);
            setHoveredItem(null);
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Tabs */}
          <div className="flex border-b border-gray-700">
            <button
              className={`flex-1 px-3 py-2 text-sm font-medium ${
                expandedSubmenu === 'variables'
                  ? 'bg-gray-700 text-blue-300'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
              onClick={() => setExpandedSubmenu('variables')}
            >
              Variables
            </button>
            <button
              className={`flex-1 px-3 py-2 text-sm font-medium ${
                expandedSubmenu === 'functions'
                  ? 'bg-gray-700 text-yellow-300'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
              onClick={() => setExpandedSubmenu('functions')}
            >
              Functions
            </button>
            <button
              className={`flex-1 px-3 py-2 text-sm font-medium ${
                expandedSubmenu === 'constants'
                  ? 'bg-gray-700 text-green-300'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
              onClick={() => setExpandedSubmenu('constants')}
            >
              Constants
            </button>
          </div>

          {/* Content */}
          <div className="p-2 pr-4">
            {expandedSubmenu === 'variables' && renderVariablesSubmenu()}
            {expandedSubmenu === 'functions' && renderFunctionsSubmenu()}
            {expandedSubmenu === 'constants' && renderConstantsSubmenu()}
          </div>
        </div>
      )}
    </>,
    document.body
  );
}
