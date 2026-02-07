import React, { useState, useRef } from 'react';
import { useResizablePanel } from '@hooks/useResizablePanel';
import { Trash2, MessageCircle } from 'lucide-react';
import { useNotes } from '@responseEditor/hooks/useNotes';

export interface TestResult {
  matched: boolean;
  fullMatch?: string;
  extracted?: Record<string, any>;
  groups?: string[];
  error?: string;
}

interface TestValuesColumnProps {
  testCases: string[];
  onTestCasesChange: (cases: string[]) => void;
  testFunction: (value: string) => TestResult;
  extractorType: 'regex' | 'extractor' | 'ner' | 'llm';
  node?: any; // For mapping groups to sub-data
  enabled?: boolean; // Show column only when enabled (e.g., when extractor is configured)
}

/**
 * Shared component for testing extractor values
 * Used by RegexInlineEditor, ExtractorInlineEditor, NERInlineEditor, LLMInlineEditor
 */
export default function TestValuesColumn({
  testCases,
  onTestCasesChange,
  testFunction,
  extractorType,
  node,
  enabled = true,
}: TestValuesColumnProps) {


  const [newTestCase, setNewTestCase] = React.useState('');
  const [selectedRow, setSelectedRow] = useState<number | null>(null);
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  const [notaAttiva, setNotaAttiva] = useState<Record<number, boolean>>({});
  const [editingValue, setEditingValue] = useState<number | null>(null);
  const [editingValueText, setEditingValueText] = useState<string>('');
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<Record<number, HTMLDivElement>>({});
  // Focus input when editing starts - using callback ref
  const editingInputRef = React.useCallback((node: HTMLInputElement | null) => {
    if (node && editingValue !== null) {
      node.focus();
      node.select();
    }
  }, [editingValue]);

  // Notes management
  const {
    getNote,
    hasNote,
    addNote,
    deleteNote,
    startEditing,
    stopEditing,
    isEditing,
    setHovered,
    isHovered,
  } = useNotes();

  // Toggle nota attiva for a row
  const toggleNotaAttiva = (rowIndex: number) => {
    const willBeActive = !notaAttiva[rowIndex];
    setNotaAttiva(prev => ({
      ...prev,
      [rowIndex]: willBeActive
    }));
    // If activating note, start editing; if deactivating, stop editing
    if (willBeActive) {
      startEditing(rowIndex, 'note');
    } else {
      stopEditing();
    }
  };

  // Resizable panel for test cases column
  const { size: testColumnWidth, handleResize, style: testColumnStyle } = useResizablePanel({
    initialSize: 280,
    min: 150,
    max: 800, // Increased to allow expansion to at least double
    direction: 'horizontal',
    persistKey: `test-values-column-width-${extractorType}`,
  });

  const [isResizing, setIsResizing] = React.useState(false);

  // Check if any note column should be shown (if any row has notaAttiva === true)
  const showNoteColumn = testCases.some((_, idx) => notaAttiva[idx] === true);

  // Handle add test case with duplicate check
  const handleAddTestCase = () => {
    const trimmed = newTestCase.trim();
    if (!trimmed) return;

    // Check for duplicate (case-insensitive)
    const existingIndex = testCases.findIndex(
      tc => tc.trim().toLowerCase() === trimmed.toLowerCase()
    );

    if (existingIndex !== -1) {
      // Duplicate found: select existing and scroll to it
      setSelectedRow(existingIndex);
      setTimeout(() => {
        const rowEl = rowRefs.current[existingIndex];
        if (rowEl && scrollContainerRef.current) {
          rowEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 50);
      setNewTestCase('');
      return;
    }

    // New value: add it
    const newIndex = testCases.length;
    const newTestCases = [...testCases, trimmed];

    onTestCasesChange(newTestCases);

    setNewTestCase('');
    // Select and scroll to new row
    setTimeout(() => {
      setSelectedRow(newIndex);
      const rowEl = rowRefs.current[newIndex];
      if (rowEl && scrollContainerRef.current) {
        rowEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 50);
  };

  // Don't render if not enabled
  if (!enabled) {
    return null;
  }

  return (
    <>
      {/* Custom scrollbar styles */}
      <style>{`
        .test-values-scroll-container::-webkit-scrollbar {
          width: 8px;
        }
        .test-values-scroll-container::-webkit-scrollbar-track {
          background: #1e293b;
          border-radius: 4px;
        }
        .test-values-scroll-container::-webkit-scrollbar-thumb {
          background: #64748b;
          border-radius: 4px;
        }
        .test-values-scroll-container::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
      `}</style>

      {/* Resize Handle - Always visible */}
      <div
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsResizing(true);
          const startX = e.clientX;
          const startWidth = testColumnWidth;

          const onMouseMove = (ev: MouseEvent) => {
            ev.preventDefault();
            const delta = ev.clientX - startX;
            const maxAllowed = typeof window !== 'undefined' ? Math.min(800, window.innerWidth * 0.5) : 800;
            const newWidth = Math.max(150, Math.min(maxAllowed, startWidth - delta));
            handleResize(newWidth);
          };

          const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            setIsResizing(false);
          };

          document.addEventListener('mousemove', onMouseMove);
          document.addEventListener('mouseup', onMouseUp);
          document.body.style.cursor = 'col-resize';
          document.body.style.userSelect = 'none';
        }}
        style={{
          width: 8,
          minWidth: 8,
          cursor: 'col-resize',
          background: isResizing
            ? 'rgba(59, 130, 246, 0.6)'
            : 'rgba(148, 163, 184, 0.2)',
          borderLeft: '1px solid rgba(148, 163, 184, 0.3)',
          borderRight: '1px solid rgba(148, 163, 184, 0.3)',
          flexShrink: 0,
          position: 'relative',
          zIndex: 10,
          transition: isResizing ? 'none' : 'background 0.2s',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        onMouseEnter={(e) => {
          if (!isResizing) {
            e.currentTarget.style.background = 'rgba(59, 130, 246, 0.4)';
            e.currentTarget.style.borderLeft = '1px solid rgba(59, 130, 246, 0.6)';
            e.currentTarget.style.borderRight = '1px solid rgba(59, 130, 246, 0.6)';
          }
        }}
        onMouseLeave={(e) => {
          if (!isResizing) {
            e.currentTarget.style.background = 'rgba(148, 163, 184, 0.2)';
            e.currentTarget.style.borderLeft = '1px solid rgba(148, 163, 184, 0.3)';
            e.currentTarget.style.borderRight = '1px solid rgba(148, 163, 184, 0.3)';
          }
        }}
        title="Trascina per ridimensionare il pannello"
      >
        <div
          style={{
            width: 2,
            height: 20,
            background: isResizing ? '#3b82f6' : 'rgba(148, 163, 184, 0.5)',
            borderRadius: 1,
          }}
        />
      </div>

      {/* Test Values Column */}
      <div
        style={{
          ...testColumnStyle,
          border: '1px solid #334155',
          borderRadius: 8,
          padding: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          background: '#1e1e1e',
          flexShrink: 0, // ✅ Non si restringe nel layout a due colonne
          minWidth: 150,
          maxWidth: typeof window !== 'undefined' ? `${Math.min(800, window.innerWidth * 0.5)}px` : '50%',
          width: testColumnWidth > 0 ? `${Math.min(testColumnWidth, typeof window !== 'undefined' ? window.innerWidth * 0.5 : 800)}px` : '280px',
          minHeight: 0,
          maxHeight: '100%',
          height: '100%',
          overflow: 'hidden', // Hide overflow but allow absolute positioned toolbar
          position: 'relative', // For absolute positioned toolbar
        }}
      >
        {/* Header - Fixed */}
        <div style={{ flexShrink: 0 }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 8
          }}>
            {/* Titolo "Test Values" */}
            <div style={{
              fontWeight: 600,
              color: '#f1f5f9',
              whiteSpace: 'nowrap',
              flexShrink: 0
            }}>
              Test Values
            </div>

            {/* Input for adding new test cases - Sulla stessa riga del titolo */}
            <div style={{ display: 'flex', gap: 6, flex: 1, minWidth: 0 }}>
              <input
                type="text"
                value={newTestCase}
                onChange={(e) => setNewTestCase(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newTestCase.trim()) {
                    handleAddTestCase();
                  }
                }}
                placeholder="Aggiungi frase..."
                style={{
                  flex: 1,
                  padding: '6px 8px',
                  border: '1px solid #334155',
                  borderRadius: 4,
                  background: '#0f172a',
                  color: '#f1f5f9',
                  minWidth: 0,
                }}
              />
              <button
                onClick={handleAddTestCase}
                disabled={!newTestCase.trim()}
                style={{
                  padding: '4px 8px',
                  border: '1px solid #334155',
                  borderRadius: 4,
                  background: newTestCase.trim() ? '#3b82f6' : '#334155',
                  color: '#fff',
                  cursor: newTestCase.trim() ? 'pointer' : 'not-allowed',
                  flexShrink: 0,
                }}
              >
                +
              </button>
            </div>
          </div>
        </div>

        {/* Test Results - Scrollable (only this part scrolls, header stays fixed) */}
        <div
          ref={scrollContainerRef}
          className="test-values-scroll-container"
          style={{
            flex: 1,
            overflowY: 'auto', // Show scrollbar when content overflows
            overflowX: 'hidden',
            minHeight: 0,
            position: 'relative',
            // Force scrollbar to be visible on Windows
            scrollbarWidth: 'thin', // Firefox
            scrollbarColor: '#64748b #1e293b', // Firefox: thumb track
          }}
        >
          {testCases.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {testCases
                .map((testCase, idx) => ({ testCase, originalIdx: idx }))
                .sort((a, b) => a.testCase.localeCompare(b.testCase, undefined, { sensitivity: 'base' }))
                .map(({ testCase, originalIdx }, displayIdx) => {
                  const result = testFunction(testCase);
                  const isSelected = selectedRow === originalIdx;
                  const isHoveredRow = hoveredRow === originalIdx;
                  const noteValue = getNote(originalIdx, 'note');
                  const hasNoteValue = hasNote(originalIdx, 'note');
                  const isRowNotaAttiva = notaAttiva[originalIdx] === true;
                  const isEditingNote = isEditing(originalIdx, 'note') && isRowNotaAttiva;

                  const isEditingValue = editingValue === originalIdx;

                  return (
                    <div
                      key={originalIdx}
                      ref={(el) => {
                        if (el) rowRefs.current[originalIdx] = el;
                      }}
                      onClick={() => {
                        if (!isEditingValue) {
                          setSelectedRow(originalIdx);
                        }
                      }}
                      onMouseEnter={() => {
                        if (!isEditingValue) {
                          setHoveredRow(originalIdx);
                        }
                      }}
                      onMouseLeave={() => {
                        if (!isEditingValue) {
                          setHoveredRow(null);
                        }
                      }}
                      style={{
                        display: 'flex',
                        flexDirection: 'row',
                        gap: 8,
                        padding: 8,
                        border: '1px solid #334155',
                        borderRadius: 6,
                        background: isSelected ? 'rgba(59, 130, 246, 0.2)' : 'transparent', // Azzurrino se selezionata, trasparente altrimenti
                        cursor: 'pointer',
                        position: 'relative',
                        alignItems: 'center',
                      }}
                    >

                      {/* Left: Test Value - Editable */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          flex: showNoteColumn ? '0 1 auto' : '1 1 auto',
                          minWidth: 100,
                          maxWidth: showNoteColumn ? '60%' : '100%',
                          paddingRight: 8,
                        }}
                        onClick={(e) => {
                          if (!isEditingValue) {
                            e.stopPropagation();
                            setEditingValue(originalIdx);
                            setEditingValueText(testCase);
                          }
                        }}
                      >
                        {isEditingValue ? (
                          <input
                            ref={editingInputRef}
                            type="text"
                            value={editingValueText}
                            onChange={(e) => setEditingValueText(e.target.value)}
                            onBlur={() => {
                              if (editingValueText.trim() && editingValueText !== testCase) {
                                const newTestCases = [...testCases];
                                newTestCases[originalIdx] = editingValueText.trim();
                                onTestCasesChange(newTestCases);
                              }
                              setEditingValue(null);
                              setEditingValueText('');
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                if (editingValueText.trim() && editingValueText !== testCase) {
                                  const newTestCases = [...testCases];
                                  newTestCases[originalIdx] = editingValueText.trim();
                                  onTestCasesChange(newTestCases);
                                }
                                setEditingValue(null);
                                setEditingValueText('');
                              } else if (e.key === 'Escape') {
                                setEditingValue(null);
                                setEditingValueText('');
                              }
                            }}
                            style={{
                              flex: 1,
                              background: 'rgba(255, 255, 255, 0.1)',
                              border: '1px solid #3b82f6',
                              borderRadius: 4,
                              padding: '4px 8px',
                              color: '#f1f5f9',
                              fontSize: 14,
                              outline: 'none',
                            }}
                            autoFocus
                          />
                        ) : (
                          <span
                            style={{
                              flex: 1,
                              color: '#f1f5f9',
                              wordBreak: 'break-word',
                              whiteSpace: 'normal',
                              cursor: 'text',
                            }}
                            onDoubleClick={(e) => {
                              e.stopPropagation();
                              setEditingValue(originalIdx);
                              setEditingValueText(testCase);
                            }}
                          >
                            {testCase}
                          </span>
                        )}
                      </div>

                      {/* Toolbar Icons - Show on hover, inside the row */}
                      {isHoveredRow && !isEditingValue && (
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'row',
                            gap: 4,
                            alignItems: 'center',
                            flexShrink: 0,
                            marginLeft: 'auto',
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {/* Trash icon - Delete row */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onTestCasesChange(testCases.filter((_, i) => i !== originalIdx));
                            }}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              borderRadius: 4,
                              padding: '4px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: 24,
                              height: 24,
                              color: '#ef4444',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = 'transparent';
                            }}
                            title="Cancella riga"
                          >
                            <Trash2 size={14} />
                          </button>

                          {/* Note icon - Toggle note column */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleNotaAttiva(originalIdx);
                            }}
                            style={{
                              background: isRowNotaAttiva ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                              border: 'none',
                              borderRadius: 4,
                              padding: '4px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: 24,
                              height: 24,
                              color: isRowNotaAttiva ? '#3b82f6' : '#94a3b8',
                            }}
                            onMouseEnter={(e) => {
                              if (!isRowNotaAttiva) {
                                e.currentTarget.style.background = 'rgba(148, 163, 184, 0.1)';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (!isRowNotaAttiva) {
                                e.currentTarget.style.background = 'transparent';
                              }
                            }}
                            title={isRowNotaAttiva ? 'Nascondi nota' : 'Mostra nota'}
                          >
                            <MessageCircle size={14} />
                          </button>
                        </div>
                      )}

                      {/* Right: Note Column - Only if notaAttiva === true */}
                      {isRowNotaAttiva && (
                        <div
                          style={{
                            flex: '1 1 auto',
                            minWidth: 150,
                            maxWidth: '40%',
                            borderLeft: '1px solid #334155',
                            paddingLeft: 8,
                          }}
                        >
                          {isEditingNote ? (
                            <textarea
                              value={noteValue}
                              onChange={(e) => {
                                addNote(originalIdx, 'note', e.target.value);
                              }}
                              onBlur={() => {
                                stopEditing();
                              }}
                              placeholder="Aggiungi una nota..."
                              autoFocus
                              style={{
                                width: '100%',
                                padding: 4,
                                fontSize: 11,
                                border: '1px solid #ddd',
                                borderRadius: 4,
                                background: 'rgba(255,255,255,0.9)',
                                resize: 'vertical',
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-word',
                                lineHeight: 1.5,
                                minHeight: '2em',
                                maxHeight: '200px',
                                color: '#1e1e1e',
                              }}
                              onInput={(e) => {
                                // Auto-resize textarea
                                const target = e.target as HTMLTextAreaElement;
                                target.style.height = 'auto';
                                target.style.height = `${Math.min(target.scrollHeight, 200)}px`;
                              }}
                            />
                          ) : hasNoteValue ? (
                            <div
                              onClick={() => {
                                if (!isRowNotaAttiva) {
                                  setNotaAttiva(prev => ({ ...prev, [originalIdx]: true }));
                                }
                                startEditing(originalIdx, 'note');
                              }}
                              style={{
                                color: '#94a3b8',
                                fontSize: 12,
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-word',
                                lineHeight: 1.5,
                                minHeight: '1.5em',
                                cursor: 'text',
                              }}
                            >
                              {noteValue}
                            </div>
                          ) : (
                            <div
                              onClick={() => {
                                if (!isRowNotaAttiva) {
                                  setNotaAttiva(prev => ({ ...prev, [originalIdx]: true }));
                                }
                                startEditing(originalIdx, 'note');
                              }}
                              style={{
                                color: '#64748b',
                                fontSize: 11,
                                fontStyle: 'italic',
                                minHeight: '1.5em',
                                cursor: 'text',
                              }}
                            >
                              Aggiungi una nota...
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          ) : (
            <div style={{ color: '#64748b', fontStyle: 'italic', textAlign: 'center', padding: 16 }}>
              Nessun test case. Aggiungi valori da testare.
            </div>
          )}
        </div>
      </div>
    </>
  );
}

