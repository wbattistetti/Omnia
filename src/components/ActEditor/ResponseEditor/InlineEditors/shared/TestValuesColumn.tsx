import React from 'react';
import { useResizablePanel } from '../../../../../hooks/useResizablePanel';

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

  // 🔍 LOG: Verifica test cases ricevuti come prop
  React.useEffect(() => {
    console.log('[TestValuesColumn] 📥 Test cases prop received:', {
      extractorType,
      nodeLabel: node?.label,
      enabled,
      testCasesCount: testCases?.length || 0,
      testCasesIsArray: Array.isArray(testCases),
      testCasesValue: testCases,
      testCasesType: typeof testCases,
    });
  }, [testCases, extractorType, node?.label, enabled]);

  const [newTestCase, setNewTestCase] = React.useState('');

  // Resizable panel for test cases column
  const { size: testColumnWidth, handleResize, style: testColumnStyle } = useResizablePanel({
    initialSize: 280,
    min: 150,
    max: 400,
    direction: 'horizontal',
    persistKey: `test-values-column-width-${extractorType}`,
  });

  const [isResizing, setIsResizing] = React.useState(false);

  // Don't render if not enabled
  if (!enabled) {
    return null;
  }

  return (
    <>
      {/* Resize Handle */}
      {testCases.length > 0 && (
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
              const maxAllowed = typeof window !== 'undefined' ? window.innerWidth * 0.25 : 400;
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
      )}

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
          maxHeight: 500,
          overflowY: 'auto',
          background: '#1e1e1e',
          flexShrink: 1,
          minWidth: 150,
          maxWidth: typeof window !== 'undefined' ? `${Math.min(400, window.innerWidth * 0.25)}px` : '25%',
          width: testColumnWidth > 0 ? `${Math.min(testColumnWidth, typeof window !== 'undefined' ? window.innerWidth * 0.25 : 400)}px` : 'auto',
        }}
      >
        {/* Header */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#f1f5f9', marginBottom: 8 }}>
            Test Values
          </div>

          {/* Input for adding new test cases */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
            <input
              type="text"
              value={newTestCase}
              onChange={(e) => setNewTestCase(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newTestCase.trim()) {
                  onTestCasesChange([...testCases, newTestCase.trim()]);
                  setNewTestCase('');
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
                fontSize: 11,
              }}
            />
            <button
              onClick={() => {
                if (newTestCase.trim()) {
                  onTestCasesChange([...testCases, newTestCase.trim()]);
                  setNewTestCase('');
                }
              }}
              disabled={!newTestCase.trim()}
              style={{
                padding: '4px 8px',
                border: '1px solid #334155',
                borderRadius: 4,
                background: newTestCase.trim() ? '#3b82f6' : '#334155',
                color: '#fff',
                cursor: newTestCase.trim() ? 'pointer' : 'not-allowed',
                fontSize: 11,
              }}
            >
              +
            </button>
          </div>
        </div>

        {/* Test Results */}
        {testCases.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {testCases.map((testCase, idx) => {
              const result = testFunction(testCase);

              return (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    flexDirection: 'row',
                    gap: 8,
                    padding: 8,
                    border: '1px solid #334155',
                    borderRadius: 6,
                    background: result.matched ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                  }}
                >
                  {/* Left: Test Value */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flex: '0 0 45%',
                      minWidth: 150,
                      borderRight: '1px solid #334155',
                      paddingRight: 8,
                    }}
                  >
                    <span style={{ flex: 1, fontSize: 11, color: '#f1f5f9' }}>
                      {testCase}
                    </span>
                    <button
                      onClick={() => onTestCasesChange(testCases.filter((_, i) => i !== idx))}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#94a3b8',
                        cursor: 'pointer',
                        fontSize: 12,
                        padding: '2px 4px',
                        marginLeft: 4,
                      }}
                      title="Rimuovi"
                    >
                      ×
                    </button>
                  </div>

                  {/* Right: Match Result */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-start',
                      flex: '0 0 45%',
                    }}
                  >
                    {result.matched ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%' }}>
                        <span style={{ fontSize: 11, color: '#22c55e', fontWeight: 500 }}>
                          ✓ {result.fullMatch || 'Match'}
                        </span>
                        {result.extracted && Object.keys(result.extracted).length > 0 && (
                          <div style={{ fontSize: 10, color: '#94a3b8', fontStyle: 'italic' }}>
                            {Object.entries(result.extracted)
                              .map(([k, v]) => `${k}: ${v}`)
                              .join(', ')}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span style={{ fontSize: 11, color: '#ef4444' }}>
                        ✗ {result.error || 'No match'}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ fontSize: 11, color: '#64748b', fontStyle: 'italic', textAlign: 'center', padding: 16 }}>
            Nessun test case. Aggiungi valori da testare.
          </div>
        )}
      </div>
    </>
  );
}

