import React from 'react';
import { LeftGrid } from './ui/LeftGrid';
import { CenterPane } from './ui/CenterPane';
import { TestGrid } from './ui/RightTest';
import { actionRunAllTests } from './actions/runAllTests';
import { useIntentStore } from './state/intentStore';

export default function IntentEditorShell(){
  const selectedId = useIntentStore(s=>s.selectedId);
  React.useEffect(() => {
    try { if (localStorage.getItem('debug.intent') === '1') console.log('[IntentEditorShell][mount]', { selectedId }); } catch {}
    return () => { try { if (localStorage.getItem('debug.intent') === '1') console.log('[IntentEditorShell][unmount]'); } catch {} };
  }, [selectedId]);
  return (
    <div className="grid grid-cols-[320px_1fr_360px] gap-4 p-4 h-full">
      <LeftGrid />

      <div className="bg-white border rounded-2xl shadow-sm flex flex-col min-h-0">
        <div className="p-3 border-b border-amber-100 bg-amber-50 rounded-t-2xl">
          <h2 className="font-semibold text-amber-800">Training phrases</h2>
        </div>
        <div className="p-3 min-h-0">
          <CenterPane intentId={selectedId} />
        </div>
      </div>

      <div className="bg-white border rounded-2xl shadow-sm flex flex-col min-h-0">
        <div className="p-3 border-b border-amber-100 bg-amber-50 rounded-t-2xl flex items-center justify-between">
          <h2 className="font-semibold text-amber-800">Test</h2>
          <button
            className="px-3 py-1 text-sm rounded-lg border bg-blue-600 text-white hover:bg-blue-700"
            onClick={() => { void actionRunAllTests(); }}
            title="Run test on all phrases"
          >
            Run test
          </button>
        </div>
        <div className="p-3 min-h-0 flex-1">
          <TestGrid />
        </div>
      </div>
    </div>
  );
}


