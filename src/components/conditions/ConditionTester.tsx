/* @refresh reload */
import React from 'react';
import { Trash, HelpCircle, Check, X as XIcon } from 'lucide-react';

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
  registerControls?: (api: { run: () => void; addRow: () => void; getFailures: () => Array<any>; hasFailures: () => boolean; resetVisuals: () => void }) => void;
  onRunResult?: (passedAll: boolean) => void;
  onFailuresChange?: (hasFailures: boolean) => void;
  onRuntimeError?: (payload?: { message?: string; line?: number; column?: number }) => void;
}) {
  const [rows, setRows] = React.useState<CaseRow[]>(() => initialCases || []);
  const [resultMap, setResultMap] = React.useState<Record<string, boolean | string>>({});
  const [errorMap, setErrorMap] = React.useState<Record<string, string>>({});
  const [openTipRowId, setOpenTipRowId] = React.useState<string | null>(null);
  const [hoverRowId, setHoverRowId] = React.useState<string | null>(null);
  const [showClassifyRowId, setShowClassifyRowId] = React.useState<string | null>(null);
  const [notPassedReasonByRow, setNotPassedReasonByRow] = React.useState<Record<string, string>>({});
  const reasonRefs = React.useRef<Record<string, HTMLTextAreaElement | null>>({});

  const autoResize = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  };

  React.useEffect(() => {
    Object.values(reasonRefs.current).forEach(autoResize);
  }, [notPassedReasonByRow]);

  React.useEffect(() => {
    const has = Object.values(notPassedReasonByRow || {}).some(v => String(v || '').trim().length > 0);
    try { onFailuresChange?.(has); } catch {}
  }, [notPassedReasonByRow]);

  React.useEffect(() => {
    const onDocClick = () => setOpenTipRowId(null);
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  // Labels editing removed: we always display the condition title

  React.useEffect(() => { onChange?.(rows); }, [rows]);

  const addRow = (label: 'true' | 'false') => {
    const vars: Record<string, any> = {};
    variablesList.forEach(k => { vars[k] = ''; });
    setRows(prev => [...prev, { id: String(Math.random()), label, vars }]);
  };

  const removeRow = (rowId: string) => setRows(prev => prev.filter(r => r.id !== rowId));

  const setVar = (rowId: string, key: string, val: string) => {
    setRows(prev => prev.map(r => r.id === rowId ? { ...r, vars: { ...r.vars, [key]: val } } : r));
  };

  const run = () => {
    const next: Record<string, boolean | string> = {};
    const nextErr: Record<string, string> = {};
    let firstErrMsg: string | undefined = undefined;
    let firstErrLine: number | undefined = undefined;
    let firstErrCol: number | undefined = undefined;
    const beforeScript = '"use strict";\nreturn (function(ctx){\n  var vars = ctx;\n  ';
    const preludeLines = beforeScript.split('\n').length - 1; // lines before user script inside wrapper
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
    rows.forEach(r => {
      try {
        const wrapper = "\"use strict\";\nreturn (function(ctx){\n  var vars = ctx;\n  " + script + "\n  if (typeof main==='function') return !!main(ctx);\n  if (typeof evaluate==='function') return !!evaluate(ctx);\n  throw new Error('main(ctx) not found');\n});";
        // eslint-disable-next-line no-new-func
        const makeRunner = new Function(wrapper)();
        const ctx = { ...(r.vars || {}) } as any;
        const result = makeRunner(ctx);
        next[r.id] = result;
        nextErr[r.id] = '';
      } catch (e: any) {
        next[r.id] = 'error';
        nextErr[r.id] = String(e?.message || e);
        if (!firstErrMsg) {
          firstErrMsg = nextErr[r.id];
          const loc = parseStack(String(e?.stack || ''));
          if (loc) { firstErrLine = loc.line; firstErrCol = loc.column; }
        }
      }
    });
    setResultMap(next);
    setErrorMap(nextErr);
    try {
      // compute aggregate pass/fail
      let allPass = true;
      rows.forEach(r => {
        const actual = next[r.id];
        const expectedTrue = r.label === 'true';
        const pass = (actual === true && expectedTrue) || (actual === false && !expectedTrue);
        const isError = actual === 'error';
        if (isError || !pass) allPass = false;
      });
      onRunResult?.(allPass);
      onRuntimeError?.(firstErrMsg ? { message: firstErrMsg, line: firstErrLine, column: firstErrCol } : undefined);
    } catch {}
  };

  React.useEffect(() => {
    if (typeof registerRun === 'function') registerRun(run);
    // no cleanup needed; parent can overwrite on re-render
  }, [registerRun, script, rows, variablesList]);

  // Build failures list for repair (only classified as not passed)
  const getFailures = React.useCallback(() => {
    const list: Array<any> = [];
    const keys = Object.keys(notPassedReasonByRow || {});
    if (keys.length === 0) return list;
    rows.forEach(r => {
      const note = String(notPassedReasonByRow[r.id] || '').trim();
      if (note.length > 0) {
        const got = (resultMap[r.id] === true || resultMap[r.id] === false) ? resultMap[r.id] : null;
        list.push({ input: { ...(r.vars || {}) }, expected: r.label === 'true', got, note });
      }
    });
    return list;
  }, [rows, resultMap, notPassedReasonByRow]);

  const resetVisuals = React.useCallback(() => {
    setResultMap({});
    setErrorMap({});
    setShowClassifyRowId(null);
    setNotPassedReasonByRow({});
  }, []);

  // Expose controls to parent (Add test value + Run + Failures API)
  React.useEffect(() => {
    if (typeof registerControls === 'function') {
      registerControls({ run, addRow: () => addRow('true'), getFailures, hasFailures: () => Object.keys(notPassedReasonByRow || {}).length > 0, resetVisuals });
    }
  }, [registerControls, script, rows, variablesList, getFailures, notPassedReasonByRow]);

  // Removed label controls

      return (
    <div style={{ position: 'relative', display: 'grid', gap: 8, padding: '0 8px 8px 8px' }}>
      {/* Header: fixed tester title */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #334155', color: '#cbd5e1', fontWeight: 700 }}>
        <span>Tester</span>
      </div>

      {rows.length === 0 ? (
        <div style={{ color: '#64748b', fontSize: 12 }}>No test sets yet.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr)', columnGap: 8, rowGap: 4, alignItems: 'center' }}>
          {rows.map(r => (
            <div key={r.id} style={{ display: 'contents' }} onMouseEnter={() => setHoverRowId(r.id)} onMouseLeave={() => setHoverRowId(null)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {(() => {
                  const actual = resultMap[r.id];
                  const expectedTrue = r.label === 'true';
                  const pass = (actual === true && expectedTrue) || (actual === false && !expectedTrue);
                  const isError = actual === 'error';
                  const hasRun = actual === true || actual === false || isError;
                  let bg = 'transparent';
                  let border = 'transparent';
                  let text = hasRun ? '#0b1220' : '#94a3b8';
                  let statusHint = '';
                  if (isError) { bg = 'rgba(245,158,11,0.20)'; border = '#b45309'; statusHint = errorMap[r.id] || 'error'; }
                  else if (hasRun && pass) { bg = 'rgba(34,197,94,0.18)'; border = '#166534'; statusHint = 'passed'; }
                  else if (hasRun && !pass) { bg = 'rgba(239,68,68,0.18)'; border = '#7f1d1d'; statusHint = 'not passed'; }
                  const pillText = (typeof title === 'string' && title.trim()) ? title : 'Italiano';
                  return (
                    <>
                      <span title={statusHint} style={{ padding: '2px 8px', borderRadius: 6, background: bg, border: `1px solid ${border}`, color: text, fontWeight: 700 }}>
                        {pillText}
                      </span>
                      {/* trash moved to classify toolbar */}
                    </>
                  );
                })()}
              </div>
              {(() => {
                const reasonVal = notPassedReasonByRow[r.id] || '';
                const hasReason = reasonVal.trim().length > 0 || notPassedReasonByRow[r.id] !== undefined;
                const InputsGrid = (
                  <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(1, variablesList.length)}, minmax(160px, 1fr))`, gap: 6, paddingRight: 28, position: 'relative' }}>
                    {variablesList.map(k => {
                      const rowHint = r.label === 'true' ? hintTrue : hintFalse;
                      const leaf = String(k).split('.').pop() || String(k);
                      return (
                        <div key={`${r.id}-${k}`} style={{ position: 'relative' }}>
                          <input
                            placeholder={leaf}
                            title={k}
                            value={String(r.vars[k] ?? '')}
                            onChange={e => setVar(r.id, k, e.target.value)}
                            style={{ width: '100%', padding: '6px 28px 6px 8px', border: '1px solid #334155', borderRadius: 6, background: 'transparent', color: '#e5e7eb' }}
                          />
                          {rowHint ? (
                            <span
                              title={rowHint}
                              onClick={(e) => { e.stopPropagation(); setOpenTipRowId(prev => prev === r.id ? null : r.id); }}
                              style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', display: 'inline-flex', width: 16, height: 16, borderRadius: '50%', border: '1px solid #475569', color: '#94a3b8', alignItems: 'center', justifyContent: 'center', fontSize: 11, cursor: 'pointer', background: 'transparent' }}
                            >
                              ?
                            </span>
                          ) : null}
                          {rowHint && openTipRowId === r.id ? (
                            <div style={{ position: 'absolute', right: 28, top: '50%', transform: 'translateY(-50%)', background: '#0f172a', border: '1px solid #334155', color: '#e5e7eb', padding: '6px 8px', borderRadius: 6, fontSize: 12, maxWidth: 280, boxShadow: '0 8px 24px rgba(2,6,23,0.5)', zIndex: 20 }}>
                              {rowHint}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                    {/* Help icon to open classify toolbar for this row */}
                    <button
                      title="Classify the test result"
                      onClick={() => setShowClassifyRowId(prev => prev === r.id ? null : r.id)}
                      style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'transparent', color: '#94a3b8', cursor: 'pointer' }}
                    >
                      <HelpCircle className="w-4 h-4" />
                    </button>

                    {showClassifyRowId === r.id && (
                      <div
                        style={{ position: 'absolute', right: 26, top: '50%', transform: 'translateY(-50%)', display: 'flex', flexDirection: 'column', gap: 6, background: '#0f172a', border: '1px solid #334155', borderRadius: 8, padding: 6, boxShadow: '0 8px 24px rgba(2,6,23,0.5)', zIndex: 30 }}
                      >
                        <button title="passed" style={{ border: '1px solid #166534', color: '#22c55e', background: 'transparent', padding: 6, borderRadius: 6 }} onClick={() => setShowClassifyRowId(null)}>
                          <Check className="w-4 h-4" />
                        </button>
                        <button title="not passed" style={{ border: '1px solid #7f1d1d', color: '#ef4444', background: 'transparent', padding: 6, borderRadius: 6 }} onClick={() => { setNotPassedReasonByRow(prev => ({ ...prev, [r.id]: prev[r.id] || '' })); setShowClassifyRowId(null); }}>
                          <XIcon className="w-4 h-4" />
                        </button>
                        <button title="remove" style={{ border: '1px solid #475569', color: '#cbd5e1', background: 'transparent', padding: 6, borderRadius: 6 }} onClick={() => { setShowClassifyRowId(null); removeRow(r.id); }}>
                          <Trash className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                );

                if (hasReason) {
                  return (
                    <div style={{ gridColumn: '2 / 3' }}>
                      <div style={{ background: 'rgba(239,68,68,0.14)', border: '1px solid #7f1d1d', borderRadius: 8, padding: 8 }}>
                        {InputsGrid}
                        <textarea
                          ref={(el) => { reasonRefs.current[r.id] = el; autoResize(el); }}
                          placeholder="Reason why this result is considered not valid"
                          value={reasonVal}
                          onChange={(e) => {
                            const v = e.target.value;
                            setNotPassedReasonByRow(prev => {
                              const next = { ...(prev || {}) } as Record<string, string>;
                              if (String(v).trim().length === 0) { delete next[r.id]; }
                              else { next[r.id] = v; }
                              return next;
                            });
                          }}
                          onInput={(e) => autoResize(e.currentTarget)}
                          rows={2}
                          style={{ width: '100%', marginTop: 8, padding: '8px 10px', border: '1px solid #7f1d1d', borderRadius: 6, background: 'transparent', color: '#e5e7eb', resize: 'none', overflow: 'hidden', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                        />
                      </div>
                    </div>
                  );
                }
                return InputsGrid;
              })()}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


