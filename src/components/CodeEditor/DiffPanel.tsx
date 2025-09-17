import React from 'react';
import { parseUnifiedDiff, applyHunks } from './utils/diff';

export default function DiffPanel({ code, diff, onApply }: { code: string; diff: string; onApply: (patched: string, applied: number) => void }) {
  const hunks = React.useMemo(() => parseUnifiedDiff(diff), [diff]);
  const [selected, setSelected] = React.useState<boolean[]>(() => hunks.map(() => true));

  const apply = () => {
    const res = applyHunks(code, hunks, selected);
    onApply(res.text, res.applied);
  };

  return (
    <div className="w-full h-full border border-slate-700 rounded p-2">
      <div className="flex gap-3 mb-2 items-center">
        <div className="font-bold">Patch hunks</div>
        {hunks.map((h, i) => (
          <label key={i} className="text-sm mr-2"><input type="checkbox" checked={selected[i]} onChange={e => setSelected(s => { const n=[...s]; n[i]=e.target.checked; return n; })} /> #{i+1}</label>
        ))}
        <button className="border px-3 py-1 ml-auto" onClick={apply}>Apply Patch</button>
      </div>
      {/* Display diff text as read-only for now (Monaco DiffEditor requires two models; here we keep compact) */}
      <textarea className="w-full h-[70%] bg-black text-green-300 text-xs p-2" readOnly value={diff}></textarea>
    </div>
  );
}



