import React from 'react';
import { Pencil, Trash } from 'lucide-react';

function stripCode(code: string): string {
  return (code || '')
    .replace(/\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(['"`])(?:\\.|(?!\1).)*\1/g, '');
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
  labelTrue,
  labelFalse,
}: {
  script: string;
  variablesList: string[];
  initialCases?: CaseRow[];
  onChange?: (rows: CaseRow[]) => void;
  hintTrue?: string;
  hintFalse?: string;
  labelTrue?: string;
  labelFalse?: string;
}) {
  const [rows, setRows] = React.useState<CaseRow[]>(() => initialCases || []);
  const [resultMap, setResultMap] = React.useState<Record<string, boolean | string>>({});
  const [errorMap, setErrorMap] = React.useState<Record<string, string>>({});
  const [openTipRowId, setOpenTipRowId] = React.useState<string | null>(null);
  const [labelTrueLocal, setLabelTrueLocal] = React.useState<string>(labelTrue || '');
  const [labelFalseLocal, setLabelFalseLocal] = React.useState<string>(labelFalse || '');
  const [editTrue, setEditTrue] = React.useState<boolean>(true);
  const [editFalse, setEditFalse] = React.useState<boolean>(true);
  const trueRef = React.useRef<HTMLInputElement>(null);
  const falseRef = React.useRef<HTMLInputElement>(null);
  const [hoverTrue, setHoverTrue] = React.useState<boolean>(false);
  const [hoverFalse, setHoverFalse] = React.useState<boolean>(false);
  const [hoverRowId, setHoverRowId] = React.useState<string | null>(null);
  const prevTrue = React.useRef<string>('');
  const prevFalse = React.useRef<string>('');

  React.useEffect(() => {
    const onDocClick = () => setOpenTipRowId(null);
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  // Sync local labels when props change (e.g., after AI response)
  React.useEffect(() => {
    try { console.log('[ConditionTester][labels][props->state]', { labelTrue, labelFalse }); } catch {}
    if (typeof labelTrue === 'string' && labelTrue.trim()) { setLabelTrueLocal(labelTrue); setEditTrue(false); }
    if (typeof labelFalse === 'string' && labelFalse.trim()) { setLabelFalseLocal(labelFalse); setEditFalse(false); }
  }, [labelTrue, labelFalse]);

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
      }
    });
    setResultMap(next);
    setErrorMap(nextErr);
  };

  const startEditTrue = () => { prevTrue.current = labelTrueLocal; setEditTrue(true); setTimeout(() => trueRef.current?.focus(), 0); };
  const startEditFalse = () => { prevFalse.current = labelFalseLocal; setEditFalse(true); setTimeout(() => falseRef.current?.focus(), 0); };

  const renderTrueControl = () => {
    if (editTrue || !labelTrueLocal.trim()) {
      return (
        <input
          ref={trueRef}
          value={labelTrueLocal}
          onChange={e => setLabelTrueLocal(e.target.value)}
          onBlur={() => { if (labelTrueLocal.trim()) setEditTrue(false); }}
          onKeyDown={e => { if (e.key === 'Enter' && labelTrueLocal.trim()) setEditTrue(false); if (e.key === 'Escape') { setLabelTrueLocal(prevTrue.current); setEditTrue(false); } }}
          placeholder="Label for TRUE"
          style={{ width: 180, padding: '6px 8px', border: '1px solid #334155', borderRadius: 6, background: 'transparent', color: '#e5e7eb' }}
        />
      );
    }
    return (
      <div onMouseEnter={() => setHoverTrue(true)} onMouseLeave={() => setHoverTrue(false)} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
        <button
          onClick={() => addRow('true')}
          title="Click to add a set"
          style={{ border: '1px solid #166534', color: '#22c55e', borderRadius: 6, padding: '6px 10px' }}
        >
          {labelTrueLocal}
        </button>
        <button title="Edit label" onClick={startEditTrue} style={{ position: 'absolute', right: -6, top: -6, opacity: hoverTrue ? 1 : 0, transition: 'opacity 120ms', border: 'none', padding: 0, background: 'transparent', color: '#e5e7eb' }}>
          <Pencil className="w-4 h-4" />
        </button>
      </div>
    );
  };

  const renderFalseControl = () => {
    if (editFalse || !labelFalseLocal.trim()) {
      return (
        <input
          ref={falseRef}
          value={labelFalseLocal}
          onChange={e => setLabelFalseLocal(e.target.value)}
          onBlur={() => { if (labelFalseLocal.trim()) setEditFalse(false); }}
          onKeyDown={e => { if (e.key === 'Enter' && labelFalseLocal.trim()) setEditFalse(false); if (e.key === 'Escape') { setLabelFalseLocal(prevFalse.current); setEditFalse(false); } }}
          placeholder="Label for FALSE"
          style={{ width: 180, padding: '6px 8px', border: '1px solid #334155', borderRadius: 6, background: 'transparent', color: '#e5e7eb' }}
        />
      );
    }
    return (
      <div onMouseEnter={() => setHoverFalse(true)} onMouseLeave={() => setHoverFalse(false)} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
        <button
          onClick={() => addRow('false')}
          title="Click to add a set"
          style={{ border: '1px solid #7f1d1d', color: '#ef4444', borderRadius: 6, padding: '6px 10px' }}
        >
          {labelFalseLocal}
        </button>
        <button title="Edit label" onClick={startEditFalse} style={{ position: 'absolute', right: -6, top: -6, opacity: hoverFalse ? 1 : 0, transition: 'opacity 120ms', border: 'none', padding: 0, background: 'transparent', color: '#e5e7eb' }}>
          <Pencil className="w-4 h-4" />
        </button>
      </div>
    );
  };

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        {renderTrueControl()}
        {renderFalseControl()}
        <button onClick={run} style={{ border: '1px solid #334155', borderRadius: 6, padding: '6px 10px' }}>Run</button>
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
                  let title = '';
                  if (isError) { bg = 'rgba(245,158,11,0.20)'; border = '#b45309'; title = errorMap[r.id] || 'error'; }
                  else if (hasRun && pass) { bg = 'rgba(34,197,94,0.18)'; border = '#166534'; title = 'passed'; }
                  else if (hasRun && !pass) { bg = 'rgba(239,68,68,0.18)'; border = '#7f1d1d'; title = 'not passed'; }
                  const pillText = expectedTrue ? (labelTrueLocal?.trim() || 'TRUE') : (labelFalseLocal?.trim() || 'FALSE');
                  return (
                    <>
                      <span title={title} style={{ padding: '2px 8px', borderRadius: 6, background: bg, border: `1px solid ${border}`, color: text, fontWeight: 700 }}>
                        {pillText}
                      </span>
                      <button title="Remove this set" onClick={() => removeRow(r.id)} style={{ marginLeft: 6, opacity: hoverRowId === r.id ? 1 : 0, transition: 'opacity 120ms', border: 'none', padding: 0, background: 'transparent', color: '#ef4444' }}>
                        <Trash className="w-3 h-3" />
                      </button>
                    </>
                  );
                })()}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(1, variablesList.length)}, minmax(160px, 1fr))`, gap: 6 }}>
                {variablesList.map(k => {
                  const rowHint = r.label === 'true' ? hintTrue : hintFalse;
                  return (
                    <div key={`${r.id}-${k}`} style={{ position: 'relative' }}>
                      <input
                        placeholder={k}
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
              </div>
              {/* result column removed; visual status is on the label pill */}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


