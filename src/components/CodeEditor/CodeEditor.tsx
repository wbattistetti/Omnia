import React from 'react';
import { ExecMode, CodeEditorProps, TestSuite, TestCase, RunTestsResp } from './models/types';
import { hashString } from './utils/hash';
// import { runInWorker } from './services/tests';
import EditorPanel from './EditorPanel';
import DiffPanel from './DiffPanel';

export interface CodeEditorRef {
  generate: (instructions?: string) => Promise<void>;
  applyPatch: (patched: string, applied: number) => void;
  format: () => void;
}

const CodeEditor = React.forwardRef<CodeEditorRef, CodeEditorProps>(({
  initialCode = '',
  initialMode = 'predicate',
  initialSuite,
  ai,
  tests,
  onPatchApplied,
  onCodeChange,
  layout = 'full',
  fontPx,
  initialVars,
  showGenerateButton,
  generateButtonLabel = 'Generate',
  onGenerateClick,
  onTestCasesSuggested
}: CodeEditorProps, ref) => {
  // CodeEditor mounted

  const [mode, setMode] = React.useState<ExecMode>(initialMode);
  const [code, setCode] = React.useState<string>(initialCode);
  const [diff, setDiff] = React.useState<string>('');
  const [suite, setSuite] = React.useState<TestSuite>(initialSuite || { id: 'suite', name: 'Suite', defaults: {}, cases: [], codeHash: hashString(initialCode) });
  const [testing, setTesting] = React.useState(false);
  const [fontSize, setFontSize] = React.useState<number>(fontPx ?? 13);
  const [generating, setGenerating] = React.useState(false);
  const [testResults, setTestResults] = React.useState<RunTestsResp | null>(null);

  // derive varKeys from initialVars
  const varKeys = React.useMemo(() => (initialVars || []).map(v => v.key).filter(Boolean), [initialVars]);

  const handleEditorChange = React.useCallback((v: string) => {
    setCode(v);
    try { onCodeChange?.(v); } catch {}
  }, [onCodeChange]);

  // keep internal code in sync when parent changes initialCode (e.g., AI generate)
  // but avoid clobbering Monaco's injected template when initialCode is empty
  React.useEffect(() => {
    try {
      const next = initialCode;
      const isEmptyProp = typeof next === 'string' && next.length === 0;
      // If prop is empty and we already have some code (e.g., Monaco template), do not overwrite
      if (isEmptyProp && (typeof code === 'string') && code.length > 0) return;
      if (next !== code) {
        setCode(next);
        setSuite(s => ({ ...s, codeHash: hashString(next) }));
      }
    } catch {
      if (initialCode !== code) {
        setCode(initialCode);
        setSuite(s => ({ ...s, codeHash: hashString(initialCode) }));
      }
    }
  }, [initialCode]);

  // Follow external font size if provided by parent (ConditionEditor)
  React.useEffect(() => {
    if (typeof fontPx === 'number' && !Number.isNaN(fontPx)) setFontSize(fontPx);
  }, [fontPx]);

  const generate = async (instructions?: string) => {
    if (onGenerateClick) {
      // Use custom handler if provided
      await onGenerateClick();
      return;
    }

    setGenerating(true);
    try {
      const unified = await ai.codeEditToPatch({
        instructions: instructions || 'Generate code',
        execution: { mode, code },
        variables: { metadata: initialVars || [], values: {} }
      });
      setDiff(unified);

      // After generating code, suggest test cases if in predicate mode and suggestTestCases is available
      if (mode === 'predicate' && ai.suggestTestCases && varKeys.length > 0) {
        try {
          const suggested = await ai.suggestTestCases({
            code: code,
            mode,
            variables: varKeys,
            nl: instructions
          });

          // Convert SuggestedCases to TestCase[]
          const testCases: TestCase[] = [];
          if (suggested.trueCase) {
            testCases.push({
              id: String(Math.random()),
              name: 'True case',
              values: suggested.trueCase,
              expectedBoolean: true,
              hint: suggested.hintTrue
            });
          }
          if (suggested.falseCase) {
            testCases.push({
              id: String(Math.random()),
              name: 'False case',
              values: suggested.falseCase,
              expectedBoolean: false,
              hint: suggested.hintFalse
            });
          }

          if (testCases.length > 0) {
            // Update suite with new test cases
            setSuite(s => ({ ...s, cases: [...s.cases, ...testCases] }));
            // Notify parent
            onTestCasesSuggested?.(testCases);
          }
        } catch (e) {
          console.warn('[CodeEditor] Failed to suggest test cases:', e);
        }
      }
    } finally {
      setGenerating(false);
    }
  };

  const applyPatch = (patched: string, applied: number) => {
    setCode(patched);
    setDiff('');
    onPatchApplied?.({ code: patched, diff, chunksApplied: applied });
    try { onCodeChange?.(patched); } catch {}
    setSuite(s => ({ ...s, codeHash: hashString(patched) }));
  };

  const runSuite = async () => {
    setTesting(true);
    try {
      const result = await tests.run({ code, mode, suite, auth: {} });
      setTestResults(result);
    } finally { setTesting(false); }
  };

  const hunksCount = React.useMemo(() => {
    try { return (diff.match(/^@@ /gm) || []).length; } catch { return 0; }
  }, [diff]);

  // Ref for EditorPanel to expose format method
  const editorPanelRef = React.useRef<{ format: () => void } | null>(null);

  // Expose methods via ref
  React.useImperativeHandle(ref, () => ({
    generate,
    applyPatch,
    format: () => {
      editorPanelRef.current?.format();
    }
  }), [generate, applyPatch]);

  return (
    <div className={layout === 'full' ? 'w-full h-full grid grid-cols-1 lg:grid-cols-3 gap-2' : 'w-full h-full'}>
      {layout === 'full' ? (
        <>
          <div className="lg:col-span-2 min-h-[300px]">
            {diff && hunksCount > 0 ? (
              <DiffPanel code={code} diff={diff} onApply={applyPatch} />
            ) : (
              <EditorPanel ref={editorPanelRef} code={code} onChange={handleEditorChange} fontSize={fontSize} varKeys={varKeys} />
            )}
          </div>
          <div className="lg:col-span-1 p-2 border-l border-slate-700">
            <div className="flex gap-2 mb-2">
              <select value={mode} onChange={e => setMode(e.target.value as ExecMode)} aria-label="Exec mode" className="border px-2 py-1">
                <option value="predicate">predicate</option>
                <option value="value">value</option>
                <option value="object">object</option>
                <option value="enum">enum</option>
              </select>
              {(showGenerateButton !== false) && (
                <button
                  className="border px-3 py-1"
                  onClick={() => generate()}
                  disabled={generating}
                >
                  {generating ? 'Generating...' : generateButtonLabel}
                </button>
              )}
              {diff && <button className="border px-3 py-1" onClick={() => setDiff('')}>Discard</button>}
            </div>
            <div className="mb-2 flex items-center gap-2 text-xs text-slate-400">
              <button className="border px-3 py-1" onClick={runSuite} disabled={testing}>
                {testing ? 'Running...' : 'Run Suite'}
              </button>
              <span>Font {fontSize}px (Ctrl+Wheel)</span>
            </div>

            {/* Test Cases Panel */}
            <div className="mt-4 border-t border-slate-700 pt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold">Test Cases</span>
                <button
                  className="text-xs border px-2 py-1"
                  onClick={() => {
                    const newCase: TestCase = {
                      id: String(Math.random()),
                      name: `Case ${suite.cases.length + 1}`,
                      values: varKeys.reduce((acc, k) => ({ ...acc, [k]: '' }), {}),
                      expectedBoolean: mode === 'predicate' ? true : undefined
                    };
                    setSuite(s => ({ ...s, cases: [...s.cases, newCase] }));
                  }}
                >
                  + Add
                </button>
              </div>

              {suite.cases.length === 0 ? (
                <div className="text-xs text-slate-400 italic">No test cases yet. Add one to test your code.</div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {suite.cases.map((testCase) => {
                    const result = testResults?.results.find(r => r.caseId === testCase.id);
                    return (
                      <div key={testCase.id} className="border border-slate-600 rounded p-2 text-xs">
                        <div className="flex items-center justify-between mb-1">
                          <input
                            type="text"
                            value={testCase.name}
                            onChange={(e) => {
                              setSuite(s => ({
                                ...s,
                                cases: s.cases.map(c => c.id === testCase.id ? { ...c, name: e.target.value } : c)
                              }));
                            }}
                            className="bg-transparent border-none text-xs font-semibold flex-1"
                            placeholder="Case name"
                          />
                          {mode === 'predicate' && (
                            <select
                              value={testCase.expectedBoolean === undefined ? '' : String(testCase.expectedBoolean)}
                              onChange={(e) => {
                                const val = e.target.value === '' ? undefined : e.target.value === 'true';
                                setSuite(s => ({
                                  ...s,
                                  cases: s.cases.map(c => c.id === testCase.id ? { ...c, expectedBoolean: val } : c)
                                }));
                              }}
                              className="text-xs border border-slate-600 rounded px-1"
                            >
                              <option value="">Expected?</option>
                              <option value="true">True</option>
                              <option value="false">False</option>
                            </select>
                          )}
                          <button
                            onClick={() => {
                              setSuite(s => ({ ...s, cases: s.cases.filter(c => c.id !== testCase.id) }));
                            }}
                            className="text-red-400 hover:text-red-300 ml-2"
                          >
                            ×
                          </button>
                        </div>

                        {/* Variable inputs */}
                        <div className="space-y-1">
                          {varKeys.map(key => (
                            <div key={key} className="flex items-center gap-1">
                              <span className="text-slate-400 w-24 truncate" title={key}>{key.split('.').pop()}:</span>
                              <input
                                type="text"
                                value={String(testCase.values[key] ?? '')}
                                onChange={(e) => {
                                  setSuite(s => ({
                                    ...s,
                                    cases: s.cases.map(c =>
                                      c.id === testCase.id
                                        ? { ...c, values: { ...c.values, [key]: e.target.value } }
                                        : c
                                    )
                                  }));
                                }}
                                className="flex-1 bg-slate-800 border border-slate-600 rounded px-1 text-xs"
                                placeholder="value"
                              />
                            </div>
                          ))}
                        </div>

                        {/* Test result */}
                        {result && (
                          <div className={`mt-1 text-xs ${result.ok ? 'text-green-400' : 'text-red-400'}`}>
                            {result.ok ? '✓ Pass' : `✗ Fail${result.error ? `: ${result.error}` : ''}`}
                          </div>
                        )}

                        {/* Hint for predicate mode */}
                        {mode === 'predicate' && testCase.hint && (
                          <div className="mt-1 text-xs text-slate-400 italic">{testCase.hint}</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Test results summary */}
              {testResults && (
                <div className="mt-4 pt-4 border-t border-slate-700 text-xs">
                  <div className="flex items-center gap-4">
                    <span className={testResults.pass > 0 ? 'text-green-400' : ''}>
                      Pass: {testResults.pass}
                    </span>
                    <span className={testResults.fail > 0 ? 'text-red-400' : ''}>
                      Fail: {testResults.fail}
                    </span>
                    <span className="text-slate-400">
                      {testResults.ms}ms
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        // compact layout: only the editor/diff, no side panel
        <div className="w-full h-full">
          {diff && hunksCount > 0 ? (
            <DiffPanel code={code} diff={diff} onApply={applyPatch} />
          ) : (
            <EditorPanel ref={editorPanelRef} code={code} onChange={handleEditorChange} fontSize={fontSize} varKeys={varKeys} />
          )}
        </div>
      )}
    </div>
  );
});

export default CodeEditor;
