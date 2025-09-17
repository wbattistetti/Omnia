import React from 'react';
import { ExecMode, CodeEditorProps, TestSuite } from './models/types';
import { hashString } from './utils/hash';
// import { runInWorker } from './services/tests';
import EditorPanel from './EditorPanel';
import DiffPanel from './DiffPanel';

export default function CodeEditor({ initialCode = '', initialMode = 'predicate', initialSuite, ai, tests, onPatchApplied, layout = 'full', fontPx }: CodeEditorProps) {
  const [mode, setMode] = React.useState<ExecMode>(initialMode);
  const [code, setCode] = React.useState<string>(initialCode);
  const [diff, setDiff] = React.useState<string>('');
  const [suite, setSuite] = React.useState<TestSuite>(initialSuite || { id: 'suite', name: 'Suite', defaults: {}, cases: [], codeHash: hashString(initialCode) });
  const [testing, setTesting] = React.useState(false);
  const [fontSize, setFontSize] = React.useState<number>(fontPx ?? 13);

  // keep internal code in sync when parent changes initialCode (e.g., AI generate)
  React.useEffect(() => {
    setCode(initialCode);
    setSuite(s => ({ ...s, codeHash: hashString(initialCode) }));
  }, [initialCode]);

  // Follow external font size if provided by parent (ConditionEditor)
  React.useEffect(() => {
    if (typeof fontPx === 'number' && !Number.isNaN(fontPx)) setFontSize(fontPx);
  }, [fontPx]);

  const generate = async (instructions: string) => {
    const unified = await ai.codeEditToPatch({ instructions, execution: { mode, code }, variables: { metadata: [], values: {} } });
    setDiff(unified);
  };

  const applyPatch = (patched: string, applied: number) => {
    setCode(patched);
    setDiff('');
    onPatchApplied?.({ code: patched, diff, chunksApplied: applied });
    setSuite(s => ({ ...s, codeHash: hashString(patched) }));
  };

  const runSuite = async () => {
    setTesting(true);
    try { await tests.run({ code, mode, suite, auth: {} }); } finally { setTesting(false); }
  };

  const hunksCount = React.useMemo(() => {
    try { return (diff.match(/^@@ /gm) || []).length; } catch { return 0; }
  }, [diff]);

  return (
    <div className={layout === 'full' ? 'w-full h-full grid grid-cols-1 lg:grid-cols-3 gap-2' : 'w-full h-full'}>
      {layout === 'full' ? (
        <>
          <div className="lg:col-span-2 min-h-[300px]">
            {diff && hunksCount > 0 ? (
              <DiffPanel code={code} diff={diff} onApply={applyPatch} />
            ) : (
              <EditorPanel code={code} onChange={setCode} fontSize={fontSize} />
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
              <button className="border px-3 py-1" onClick={() => generate('Regenerate based on chat context')}>Generate</button>
              {diff && <button className="border px-3 py-1" onClick={() => setDiff('')}>Discard</button>}
            </div>
            <div className="mb-2 flex items-center gap-2 text-xs text-slate-400">
              <button className="border px-3 py-1" onClick={runSuite} disabled={testing}>Run Suite</button>
              <span>Font {fontSize}px (Ctrl+Wheel)</span>
            </div>
          </div>
        </>
      ) : (
        // compact layout: only the editor/diff, no side panel
        <div className="w-full h-full">
          {diff && hunksCount > 0 ? (
            <DiffPanel code={code} diff={diff} onApply={applyPatch} />
          ) : (
            <EditorPanel code={code} onChange={setCode} fontSize={fontSize} />
          )}
        </div>
      )}
    </div>
  );
}



