import React, { useState } from 'react';
import { actionRunTest } from '../../actions/runTest';
import { TopKList } from './TopKList';
import { ExplanationPanel } from './ExplanationPanel';
import { LatencyMeter } from './LatencyMeter';

export function TestConsole(){
  const [text,setText] = useState('la bolletta è troppo alta');
  const [res,setRes] = useState<any>(null);
  // ✅ SOLUZIONE ESPERTO: Rimuovere h-full, usare solo flex-1 min-h-0
  return (
    <div className="bg-white border rounded-2xl shadow-sm p-3 flex flex-col flex-1 min-h-0">
      <h2 className="font-semibold mb-2">Quick test</h2>
      <textarea className="w-full rounded-xl border p-2 text-sm min-h-[96px]" value={text} onChange={e=>setText(e.target.value)} />
      <button className="mt-2 px-3 py-1.5 rounded-xl border" onClick={async()=>setRes(await actionRunTest(text))}>Run</button>
      {res && <div className="mt-3"><TopKList items={res.top}/><ExplanationPanel result={res}/><LatencyMeter lat={res.latency}/></div>}
    </div>
  );
}


