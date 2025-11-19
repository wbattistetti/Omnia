/* @refresh reload */
import React from 'react';
import { Trash, FileText, RotateCcw, X as XIcon } from 'lucide-react';

function stripCode(code: string): string {
  return (code || '')
    .replace(/\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(['"])?:?(?:\\.|(?!\1).)*\1/g, '');
}

export function extractKeys(code: string): string[] {
  const c = stripCode(code);
  const re = /(?:vars|ctx)\s*(?:\[\s*['"]([^'\"]+)['"]\s*\]|\.([A-Za-z_]\w*))/g;
  const out = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(c))) out.add((m[1] || m[2]) as string);
  return Array.from(out);
}

export type TestRow = {
  id: string;
  values: Record<string, string[]>; // key -> array of values for that variable
  note?: string; // user note explaining expected behavior
  noteUsed?: boolean; // true if note was already used in repair (grayed out)
};

export type CaseRow = {
  id: string;
  label: 'true' | 'false';
  vars: Record<string, any>;
};

export default function ConditionTester({
  script,
  variablesList,
  initialCases,
  onChange,
  hintTrue,
  hintFalse,
  title,
  registerRun,
  registerControls,
  onRunResult,
  onFailuresChange,
  onRuntimeError,
}: {
  script: string;
  variablesList: string[];
  initialCases?: CaseRow[];
  onChange?: (rows: CaseRow[]) => void;
  hintTrue?: string;
  hintFalse?: string;
  title?: string;
  registerRun?: (fn: () => void) => void;
  registerControls?: (api: { run: () => void; addRow: () => void; getFailures: () => Array<any>; hasFailures: () => boolean; resetVisuals: () => void; markNotesAsUsed: () => void }) => void;
  onRunResult?: (passedAll: boolean) => void;
  onFailuresChange?: (hasFailures: boolean) => void;
  onRuntimeError?: (payload?: { message?: string; line?: number; column?: number }) => void;
}) {
  // Convert initialCases to new TestRow format
  const [rows, setRows] = React.useState<TestRow[]>(() => {
    if (initialCases && initialCases.length > 0) {
      return initialCases.map(c => ({
        id: c.id,
        values: Object.fromEntries(
          variablesList.map(k => [k, c.vars[k] ? [String(c.vars[k])] : []])
        ),
        note: undefined,
        noteUsed: false,
      }));
    }
    return [];
  });

  const [resultMap, setResultMap] = React.useState<Record<string, { result: boolean | string; error?: string }>>({});
  const [errorMap, setErrorMap] = React.useState<Record<string, string>>({});
  const [validatedRows, setValidatedRows] = React.useState<Set<string>>(new Set());
  const [editingNoteRowId, setEditingNoteRowId] = React.useState<string | null>(null);
  const [editingCell, setEditingCell] = React.useState<{ rowId: string; key: string; valueIndex: number } | null>(null);
  const [editingCellValue, setEditingCellValue] = React.useState<string>('');
  const [headerInputs, setHeaderInputs] = React.useState<Record<string, string>>({});
  const [expandedRows, setExpandedRows] = React.useState<Set<string>>(new Set());
  const noteRefs = React.useRef<Record<string, HTMLTextAreaElement | null>>({});
  const cellInputRef = React.useRef<HTMLInputElement | null>(null);

  const autoResize = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  };

  React.useEffect(() => {
    Object.values(noteRefs.current).forEach(autoResize);
  }, [editingNoteRowId]);

  // Convert rows back to CaseRow[] for onChange callback (for backward compatibility)
  React.useEffect(() => {
    if (onChange) {
      const caseRows: CaseRow[] = rows.flatMap(r => {
        // Generate all combinations of values
        const keys = variablesList.filter(k => r.values[k] && r.values[k].length > 0);
        if (keys.length === 0) return [];

        const combinations: CaseRow[] = [];
        const generateCombos = (current: Record<string, any>, remainingKeys: string[], index: number) => {
          if (index >= remainingKeys.length) {
            // Determine expected result based on note or default
            const expected = r.note && r.note.toLowerCase().includes('dovrebbe matchare') ? 'true' :
                           r.note && r.note.toLowerCase().includes('non dovrebbe matchare') ? 'false' : 'true';
            combinations.push({
              id: `${r.id}-${combinations.length}`,
              label: expected as 'true' | 'false',
              vars: current,
            });
            return;
          }
          const key = remainingKeys[index];
          r.values[key]?.forEach(val => {
            generateCombos({ ...current, [key]: val }, remainingKeys, index + 1);
          });
        };
        generateCombos({}, keys, 0);
        return combinations;
      });
      onChange(caseRows);
    }
  }, [rows, variablesList, onChange]);

  const addRow = () => {
    const newRow: TestRow = {
      id: String(Math.random()),
      values: Object.fromEntries(variablesList.map(k => [k, []])),
      note: undefined,
      noteUsed: false,
    };
    setRows(prev => [...prev, newRow]);
  };

  const removeRow = (rowId: string) => {
    setRows(prev => prev.filter(r => r.id !== rowId));
    setResultMap(prev => {
      const next = { ...prev };
      delete next[rowId];
      return next;
    });
  };

  // Add value to a variable column via header input
  const addValueToColumn = (key: string) => {
    const val = headerInputs[key]?.trim();
    if (!val) return;

    // Add to first row that has empty values for this key, or create new row
    setRows(prev => {
      const next = [...prev];
      let added = false;
      for (let i = 0; i < next.length; i++) {
        if (!next[i].values[key] || next[i].values[key].length === 0) {
          next[i] = {
            ...next[i],
            values: { ...next[i].values, [key]: [val] },
          };
          added = true;
          break;
        }
      }
      if (!added) {
        const newRow: TestRow = {
          id: String(Math.random()),
          values: Object.fromEntries(variablesList.map(k => [k, k === key ? [val] : []])),
          note: undefined,
          noteUsed: false,
        };
        next.push(newRow);
      }
      return next;
    });

    setHeaderInputs(prev => ({ ...prev, [key]: '' }));
  };

  // Add value to specific cell
  const addValueToCell = (rowId: string, key: string, value: string) => {
    if (!value.trim()) return;
    setRows(prev => prev.map(r => {
      if (r.id !== rowId) return r;
      const existing = r.values[key] || [];
      return {
        ...r,
        values: { ...r.values, [key]: [...existing, value.trim()] },
      };
    }));
  };

  // Remove value from cell
  const removeValueFromCell = (rowId: string, key: string, valueIndex: number) => {
    setRows(prev => prev.map(r => {
      if (r.id !== rowId) return r;
      const existing = r.values[key] || [];
      return {
        ...r,
        values: { ...r.values, [key]: existing.filter((_, i) => i !== valueIndex) },
      };
    }));
  };

  // Start editing cell value (double click)
  const startEditingCell = (rowId: string, key: string, valueIndex: number, currentValue: string) => {
    setEditingCell({ rowId, key, valueIndex });
    setEditingCellValue(currentValue);
    setTimeout(() => cellInputRef.current?.focus(), 0);
  };

  // Save edited cell value
  const saveEditingCell = () => {
    if (!editingCell) return;
    const { rowId, key, valueIndex } = editingCell;
    setRows(prev => prev.map(r => {
      if (r.id !== rowId) return r;
      const existing = r.values[key] || [];
      const updated = [...existing];
      updated[valueIndex] = editingCellValue.trim();
      return {
        ...r,
        values: { ...r.values, [key]: updated },
      };
    }));
    setEditingCell(null);
    setEditingCellValue('');
  };

  // Cancel editing cell
  const cancelEditingCell = () => {
    setEditingCell(null);
    setEditingCellValue('');
  };

  // Set note for row (new note cancels old one and becomes active)
  const setNote = (rowId: string, note: string) => {
    setRows(prev => prev.map(r => {
      if (r.id !== rowId) return r;
      return {
        ...r,
        note: note.trim() || undefined,
        noteUsed: false, // New note is always active
      };
    }));
    setEditingNoteRowId(null);
  };

  // Toggle note used state (gray/un-gray)
  const toggleNoteUsed = (rowId: string) => {
    setRows(prev => prev.map(r => {
      if (r.id !== rowId) return r;
      return { ...r, noteUsed: !r.noteUsed };
    }));
  };

  const run = () => {
    console.log('[ConditionTester] Run button clicked, starting tests...', { rowsCount: rows.length, scriptLength: script.length });
    const next: Record<string, { result: boolean | string; error?: string }> = {};
    const nextErr: Record<string, string> = {};
    let firstErrMsg: string | undefined = undefined;
    let firstErrLine: number | undefined = undefined;
    let firstErrCol: number | undefined = undefined;
    const beforeScript = '"use strict";\nreturn (function(ctx){\n  var vars = ctx;\n  ';
    const preludeLines = beforeScript.split('\n').length - 1;

    const parseStack = (stack?: string) => {
      if (!stack) return null;
      const lines = String(stack).split('\n');
      for (const ln of lines) {
        const m = ln.match(/:(\d+):(\d+)\)?(?:\s|$)/);
        if (m) {
          const rawLine = parseInt(m[1], 10);
          const rawCol = parseInt(m[2], 10);
          if (Number.isFinite(rawLine) && Number.isFinite(rawCol)) {
            return { line: Math.max(1, rawLine - preludeLines), column: Math.max(1, rawCol) };
          }
        }
      }
      return null;
    };

    // Test each row - generate all combinations and test them
    rows.forEach(r => {
      const keys = variablesList.filter(k => r.values[k] && r.values[k].length > 0);
      if (keys.length === 0) return;

      // Generate all combinations
      const generateCombos = (current: Record<string, any>, remainingKeys: string[], index: number): void => {
        if (index >= remainingKeys.length) {
          // Test this combination
          try {
            const wrapper = "\"use strict\";\nreturn (function(ctx){\n  var vars = ctx;\n  " + script + "\n  if (typeof main==='function') return !!main(ctx);\n  if (typeof evaluate==='function') return !!evaluate(ctx);\n  throw new Error('main(ctx) not found');\n});";
            // eslint-disable-next-line no-new-func
            const makeRunner = new Function(wrapper)();
            // Convert string values to appropriate types before passing to context
            const convertedCtx: Record<string, any> = {};
            Object.keys(current).forEach(key => {
              const val = current[key];
              if (val === null || val === undefined || val === '') {
                convertedCtx[key] = val;
              } else {
                const str = String(val).trim();
                if (str === '') {
                  convertedCtx[key] = val;
                } else if (str.toLowerCase() === 'true') {
                  convertedCtx[key] = true;
                } else if (str.toLowerCase() === 'false') {
                  convertedCtx[key] = false;
                } else {
                  const num = Number(str);
                  if (!isNaN(num) && isFinite(num) && str === String(num)) {
                    convertedCtx[key] = num;
                  } else {
                    convertedCtx[key] = str;
                  }
                }
              }
            });
            console.log('[ConditionTester] Testing with context:', { original: current, converted: convertedCtx });
            const result = makeRunner(convertedCtx);
            const comboId = `${r.id}-${JSON.stringify(current)}`;
            next[comboId] = { result };
            nextErr[comboId] = '';
            console.log('[ConditionTester] Test result:', { comboId, result, expected: typeof result });
          } catch (e: any) {
            const comboId = `${r.id}-${JSON.stringify(current)}`;
            const errorMsg = String(e?.message || e);
            next[comboId] = { result: 'error', error: errorMsg };
            nextErr[comboId] = errorMsg;
            console.error('[ConditionTester] Test error:', { comboId, error: errorMsg, context: current });
            if (!firstErrMsg) {
              firstErrMsg = nextErr[comboId];
              const loc = parseStack(String(e?.stack || ''));
              if (loc) { firstErrLine = loc.line; firstErrCol = loc.column; }
            }
          }
          return;
        }
        const key = remainingKeys[index];
        r.values[key]?.forEach(val => {
          generateCombos({ ...current, [key]: val }, remainingKeys, index + 1);
        });
      };

      generateCombos({}, keys, 0);
    });

    setResultMap(next);
    setErrorMap(nextErr);
    console.log('[ConditionTester] Tests completed', { resultsCount: Object.keys(next).length, errorsCount: Object.keys(nextErr).length });

    try {
      // Compute aggregate pass/fail based on notes
      let allPass = true;
      rows.forEach(r => {
        if (!r.note || r.noteUsed) return; // Skip rows without active notes
        const keys = variablesList.filter(k => r.values[k] && r.values[k].length > 0);
        if (keys.length === 0) return;

        // Check if any combination matches the note expectation
        const shouldMatch = r.note.toLowerCase().includes('dovrebbe matchare');
        const shouldNotMatch = r.note.toLowerCase().includes('non dovrebbe matchare');

        if (shouldMatch || shouldNotMatch) {
          // Check all combinations for this row
          const generateAndCheck = (current: Record<string, any>, remainingKeys: string[], index: number): boolean => {
            if (index >= remainingKeys.length) {
              const comboId = `${r.id}-${JSON.stringify(current)}`;
              const testResult = next[comboId];
              if (!testResult) return true; // No result yet
              const actual = testResult.result === true;
              const expected = shouldMatch;
              return actual === expected;
            }
            const key = remainingKeys[index];
            return r.values[key]?.every(val =>
              generateAndCheck({ ...current, [key]: val }, remainingKeys, index + 1)
            ) ?? true;
          };
          const rowPass = generateAndCheck({}, keys, 0);
          if (!rowPass) allPass = false;
        }
      });
      onRunResult?.(allPass);
      onRuntimeError?.(firstErrMsg ? { message: firstErrMsg, line: firstErrLine, column: firstErrCol } : undefined);
    } catch {}
  };

  React.useEffect(() => {
    if (typeof registerRun === 'function') registerRun(run);
  }, [registerRun, script, rows, variablesList]);

  // Get result for a row (first combination result)
  const getRowResult = (row: TestRow): { result: boolean | string | null; hasError: boolean } => {
    const keys = variablesList.filter(k => row.values[k] && row.values[k].length > 0);
    if (keys.length === 0) return { result: null, hasError: false };

    let firstResult: boolean | string | null = null;
    let hasError = false;

    const generateAndGet = (current: Record<string, any>, remainingKeys: string[], index: number): void => {
      if (index >= remainingKeys.length) {
        const comboId = `${row.id}-${JSON.stringify(current)}`;
        const testResult = resultMap[comboId];
        if (testResult && firstResult === null) {
          firstResult = testResult.result;
          hasError = testResult.result === 'error' || testResult.result === 'throw';
        }
        return;
      }
      const key = remainingKeys[index];
      row.values[key]?.forEach(val => {
        generateAndGet({ ...current, [key]: val }, remainingKeys, index + 1);
      });
    };
    generateAndGet({}, keys, 0);

    return { result: firstResult, hasError };
  };

  // Build failures list for repair (only rows with active notes)
  const getFailures = React.useCallback(() => {
    const list: Array<any> = [];
    rows.forEach(r => {
      if (!r.note || r.noteUsed) return; // Only active notes
      const keys = variablesList.filter(k => r.values[k] && r.values[k].length > 0);
      if (keys.length === 0) return;

      // Generate combinations and check results
      const generateAndAdd = (current: Record<string, any>, remainingKeys: string[], index: number): void => {
        if (index >= remainingKeys.length) {
          const comboId = `${r.id}-${JSON.stringify(current)}`;
          const testResult = resultMap[comboId];
          const shouldMatch = r.note?.toLowerCase().includes('dovrebbe matchare');
          const shouldNotMatch = r.note?.toLowerCase().includes('non dovrebbe matchare');

          if (shouldMatch || shouldNotMatch) {
            const expected = shouldMatch;
            const got = testResult?.result === true ? true : (testResult?.result === false ? false : null);
            if (got !== expected) {
              list.push({
                input: { ...current },
                expected,
                got,
                note: r.note,
              });
            }
          }
          return;
        }
        const key = remainingKeys[index];
        r.values[key]?.forEach(val => {
          generateAndAdd({ ...current, [key]: val }, remainingKeys, index + 1);
        });
      };
      generateAndAdd({}, keys, 0);
    });
    return list;
  }, [rows, resultMap, variablesList]);

  const resetVisuals = React.useCallback(() => {
    setResultMap({});
    setErrorMap({});
    setEditingNoteRowId(null);
  }, []);

  const markNotesAsUsed = React.useCallback(() => {
    setRows(prev => prev.map(r => {
      if (r.note && !r.noteUsed) {
        return { ...r, noteUsed: true };
      }
      return r;
    }));
  }, []);

  const hasFailures = React.useCallback(() => {
    return rows.some(r => r.note && !r.noteUsed && r.note.trim().length > 0);
  }, [rows]);

  React.useEffect(() => {
    onFailuresChange?.(hasFailures());
  }, [hasFailures, onFailuresChange]);

  // Expose controls to parent
  React.useEffect(() => {
    if (typeof registerControls === 'function') {
      registerControls({ run, addRow, getFailures, hasFailures, resetVisuals, markNotesAsUsed });
    }
  }, [registerControls, script, rows, variablesList, getFailures, hasFailures, resetVisuals, markNotesAsUsed]);

  if (variablesList.length === 0) {
    return (
      <div style={{ padding: '8px', color: '#64748b', fontSize: 12 }}>
        No variables available for testing.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header with Run button */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderBottom: '1px solid #334155' }}>
        <span style={{ color: '#cbd5e1', fontWeight: 700 }}>Tester</span>
        <button
          title="Run tests"
          onClick={run}
          style={{
            border: '1px solid #334155',
            borderRadius: 6,
            padding: '6px 12px',
            background: '#ef4444',
            color: '#fff',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Run
        </button>
      </div>

      {/* Grid container */}
      <div style={{ flex: 1, overflow: 'auto', padding: '8px' }}>
        <div style={{ display: 'grid', gap: 4 }}>
          {/* Header row with textboxes for each variable - always visible */}
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${variablesList.length}, minmax(120px, 1fr)) 140px auto`, gap: 6, padding: '4px 0', borderBottom: '1px solid #334155', marginBottom: rows.length > 0 ? 8 : 0 }}>
            {variablesList.map(k => {
              const leaf = String(k).split('.').pop() || String(k);
              return (
                <div key={k} style={{ position: 'relative', display: 'flex', alignItems: 'stretch' }}>
                  <input
                    placeholder={leaf}
                    title={k}
                    value={headerInputs[k] || ''}
                    onChange={e => setHeaderInputs(prev => ({ ...prev, [k]: e.target.value }))}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addValueToColumn(k);
                      }
                    }}
                    style={{
                      width: '100%',
                      padding: '2px 6px',
                      border: '1px solid #334155',
                      borderRadius: 4,
                      background: 'transparent',
                      color: '#e5e7eb',
                      fontSize: 11,
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              );
              })}
            {/* Result column header */}
            <div style={{ color: '#94a3b8', fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              Result
            </div>
            <div style={{ width: 24 }}></div>
          </div>

          {/* Data rows - only show if there are rows */}
          {rows.length === 0 ? (
            <div style={{ color: '#64748b', fontSize: 12, padding: '16px', textAlign: 'center' }}>
              Add values using the header inputs above to create test rows.
            </div>
          ) : (
            rows.map((r, rowIndex) => {
              const isExpanded = expandedRows.has(r.id);
              const hasNote = r.note && r.note.trim().length > 0;
              const isNoteUsed = r.noteUsed;
              const isEditingNote = editingNoteRowId === r.id;

              return (
                <div key={r.id} style={{ display: 'contents' }}>
                  {/* Main row */}
                  <div style={{ display: 'grid', gridTemplateColumns: `repeat(${variablesList.length}, minmax(120px, 1fr)) 140px auto`, gap: 6, padding: '4px 0', alignItems: 'start' }}>
                    {/* Variable columns */}
                    {variablesList.map(k => {
                      const values = r.values[k] || [];
                      const isEditingThisCell = editingCell?.rowId === r.id && editingCell?.key === k;
                      return (
                        <div key={k} style={{ display: 'flex', flexDirection: 'column', gap: 4, minHeight: 32 }}>
                          {values.length === 0 ? (
                            <div style={{ color: '#475569', fontSize: 11, fontStyle: 'italic', padding: '4px 6px' }}>
                              (empty)
                            </div>
                          ) : (
                            values.map((val, valIndex) => {
                              const isEditingThisValue = isEditingThisCell && editingCell?.valueIndex === valIndex;
                              return (
                                <div key={valIndex} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                  {isEditingThisValue ? (
                                    <input
                                      ref={cellInputRef}
                                      value={editingCellValue}
                                      onChange={e => setEditingCellValue(e.target.value)}
                                      onKeyDown={e => {
                                        if (e.key === 'Enter') {
                                          e.preventDefault();
                                          saveEditingCell();
                                        } else if (e.key === 'Escape') {
                                          e.preventDefault();
                                          cancelEditingCell();
                                        }
                                      }}
                                      onBlur={saveEditingCell}
                                      style={{
                                        flex: 1,
                                        padding: '2px 6px',
                                        border: '1px solid #3b82f6',
                                        borderRadius: 4,
                                        background: 'transparent',
                                        color: '#e5e7eb',
                                        fontSize: 11,
                                      }}
                                      autoFocus
                                    />
                                  ) : (
                                    <span
                                      onDoubleClick={() => startEditingCell(r.id, k, valIndex, val)}
                                      style={{
                                        color: '#e5e7eb',
                                        fontSize: 11,
                                        padding: '2px 6px',
                                        background: 'rgba(148,163,184,0.1)',
                                        borderRadius: 4,
                                        flex: 1,
                                        cursor: 'text',
                                      }}
                                      title="Double-click to edit"
                                    >
                                      {val}
                                    </span>
                                  )}
                                  <button
                                    title="Remove value"
                                    onClick={() => removeValueFromCell(r.id, k, valIndex)}
                                    style={{ border: 'none', background: 'transparent', color: '#64748b', cursor: 'pointer', padding: 2 }}
                                  >
                                    <XIcon className="w-3 h-3" />
                                  </button>
                                </div>
                              );
                            })
                          )}
                        </div>
                      );
                    })}

                    {/* Result column */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 32 }}>
                      {(() => {
                        const { result, hasError } = getRowResult(r);
                        const isValidated = validatedRows.has(r.id);
                        const conditionLabel = title || 'Condition';

                        let border = '#475569'; // grigio di default
                        let text = '#e5e7eb'; // bianco
                        let displayText = '';

                        if (result === null) {
                          displayText = 'not evaluated!';
                          border = '#475569';
                          text = '#e5e7eb';
                        } else if (hasError) {
                          displayText = 'throw';
                          border = isValidated ? '#7f1d1d' : '#475569';
                          text = '#0b1220'; // nero
                        } else if (result === true) {
                          // Mostra sempre il risultato, anche se non validato
                          displayText = conditionLabel;
                          text = '#0b1220'; // nero sempre

                          if (isValidated) {
                            // Determina se è corretto basandosi sulla nota
                            const shouldMatch = r.note?.toLowerCase().includes('dovrebbe matchare');
                            const shouldNotMatch = r.note?.toLowerCase().includes('non dovrebbe matchare');
                            const isCorrect = shouldMatch ? true : (shouldNotMatch ? false : null);

                            if (isCorrect === true) {
                              border = '#166534'; // verde
                            } else if (isCorrect === false) {
                              border = '#7f1d1d'; // rosso
                            } else {
                              border = '#475569'; // grigio se non c'è nota
                            }
                          } else {
                            border = '#475569'; // grigio finché non validato
                          }
                        } else if (result === false) {
                          // Mostra sempre il risultato, anche se non validato
                          displayText = `Not ${conditionLabel}`;
                          text = '#0b1220'; // nero sempre

                          if (isValidated) {
                            // Determina se è corretto basandosi sulla nota
                            const shouldMatch = r.note?.toLowerCase().includes('dovrebbe matchare');
                            const shouldNotMatch = r.note?.toLowerCase().includes('non dovrebbe matchare');
                            const isCorrect = shouldNotMatch ? true : (shouldMatch ? false : null);

                            if (isCorrect === true) {
                              border = '#166534'; // verde
                            } else if (isCorrect === false) {
                              border = '#7f1d1d'; // rosso
                            } else {
                              border = '#475569'; // grigio se non c'è nota
                            }
                          } else {
                            border = '#475569'; // grigio finché non validato
                          }
                        }

                        return (
                          <span
                            onClick={() => {
                              if (result !== null) {
                                setValidatedRows(prev => {
                                  const next = new Set(prev);
                                  if (next.has(r.id)) {
                                    next.delete(r.id);
                                  } else {
                                    next.add(r.id);
                                  }
                                  return next;
                                });
                              }
                            }}
                            style={{
                              padding: '4px 8px',
                              borderRadius: 6,
                              border: `1px solid ${border}`,
                              background: 'transparent',
                              color: text,
                              fontSize: 11,
                              fontWeight: 600,
                              cursor: result !== null ? 'pointer' : 'default',
                              textAlign: 'center',
                              minWidth: 120,
                            }}
                            title={result !== null ? (isValidated ? 'Click to unvalidate' : 'Click to validate') : 'No result yet'}
                          >
                            {displayText}
                          </span>
                        );
                      })()}
                    </div>

                    {/* Actions column */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      {/* Note button */}
                      <button
                        title={hasNote ? (isNoteUsed ? 'Note used (click to reactivate)' : 'Edit note') : 'Add note'}
                        onClick={() => {
                          if (isEditingNote) {
                            setEditingNoteRowId(null);
                          } else {
                            setEditingNoteRowId(r.id);
                          }
                        }}
                        style={{
                          border: '1px solid #334155',
                          borderRadius: 4,
                          padding: '4px 6px',
                          background: hasNote ? (isNoteUsed ? 'rgba(148,163,184,0.2)' : 'rgba(59,130,246,0.2)') : 'transparent',
                          color: hasNote ? (isNoteUsed ? '#94a3b8' : '#3b82f6') : '#64748b',
                          cursor: 'pointer',
                        }}
                      >
                        <FileText className="w-3 h-3" />
                      </button>
                      {/* Remove row */}
                      <button
                        title="Remove row"
                        onClick={() => removeRow(r.id)}
                        style={{ border: 'none', background: 'transparent', color: '#64748b', cursor: 'pointer', padding: 2 }}
                      >
                        <Trash className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Note editing row */}
                  {isEditingNote && (
                    <div style={{ gridColumn: `1 / ${variablesList.length + 2}`, padding: '8px', background: 'rgba(59,130,246,0.1)', borderRadius: 6, marginBottom: 4 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <textarea
                          ref={(el) => { noteRefs.current[r.id] = el; autoResize(el); }}
                          placeholder="Explain why this test should or should not match (e.g., 'Febbraio dovrebbe matchare' or 'Gennaio non dovrebbe matchare')"
                          defaultValue={r.note || ''}
                          onKeyDown={e => {
                            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                              e.preventDefault();
                              const input = e.currentTarget;
                              setNote(r.id, input.value);
                            } else if (e.key === 'Escape') {
                              setEditingNoteRowId(null);
                            }
                          }}
                          onInput={(e) => autoResize(e.currentTarget)}
                          rows={2}
                          style={{
                            width: '100%',
                            padding: '6px 8px',
                            border: '1px solid #3b82f6',
                            borderRadius: 4,
                            background: 'transparent',
                            color: '#e5e7eb',
                            resize: 'none',
                            overflow: 'hidden',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                            fontSize: 11,
                          }}
                        />
                        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                          <button
                            onClick={() => {
                              const input = noteRefs.current[r.id];
                              if (input) setNote(r.id, input.value);
                            }}
                            style={{
                              border: '1px solid #3b82f6',
                              borderRadius: 4,
                              padding: '4px 8px',
                              background: '#3b82f6',
                              color: '#fff',
                              fontSize: 11,
                              cursor: 'pointer',
                            }}
                          >
                            Save (Ctrl+Enter)
                          </button>
                          {hasNote && (
                            <button
                              onClick={() => toggleNoteUsed(r.id)}
                              title={isNoteUsed ? 'Reactivate note' : 'Mark note as used'}
                              style={{
                                border: '1px solid #334155',
                                borderRadius: 4,
                                padding: '4px 8px',
                                background: 'transparent',
                                color: isNoteUsed ? '#94a3b8' : '#e5e7eb',
                                fontSize: 11,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                              }}
                            >
                              <RotateCcw className="w-3 h-3" />
                              {isNoteUsed ? 'Reactivate' : 'Mark used'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Note display (when not editing) */}
                  {hasNote && !isEditingNote && (
                    <div style={{
                      gridColumn: `1 / ${variablesList.length + 2}`,
                      padding: '6px 8px',
                      background: isNoteUsed ? 'rgba(148,163,184,0.1)' : 'rgba(59,130,246,0.1)',
                      borderRadius: 4,
                      marginBottom: 4,
                      color: isNoteUsed ? '#94a3b8' : '#e5e7eb',
                      fontSize: 11,
                      fontStyle: isNoteUsed ? 'italic' : 'normal',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <FileText className="w-3 h-3" />
                        <span style={{ flex: 1 }}>{r.note}</span>
                        {isNoteUsed && (
                          <span style={{ fontSize: 10, color: '#64748b' }}>(used in repair)</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
