import React, { useEffect, useState } from 'react';
import { LeftGrid } from './ui/LeftGrid';
import { CenterPane } from './ui/CenterPane';
import { TestGrid } from './ui/RightTest';
import { actionRunAllTests } from './actions/runAllTests';
import { actionRunVisibleTests } from './actions/runVisibleTests';
import { useIntentStore } from './state/intentStore';
import { getModelStatus } from './services/trainingService';

export default function IntentEditorShell(){
  const selectedId = useIntentStore(s=>s.selectedId);
  const selected = useIntentStore(s=> s.intents.find(i=>i.id===s.selectedId));
  const posCount = selected?.variants.curated.length ?? 0;
  const [testing, setTesting] = React.useState(false);
  const [modelReady, setModelReady] = useState(false);

  // ✅ Verifica stato modello quando cambia selectedId
  useEffect(() => {
    if (!selectedId) {
      setModelReady(false);
      return;
    }
    getModelStatus(selectedId).then(status => {
      setModelReady(status.modelReady);
    }).catch(() => {
      setModelReady(false);
    });
  }, [selectedId]);

  React.useEffect(() => {
    try { if (localStorage.getItem('debug.intent') === '1') console.log('[IntentEditorShell][mount]', { selectedId }); } catch {}
    return () => { try { if (localStorage.getItem('debug.intent') === '1') console.log('[IntentEditorShell][unmount]'); } catch {} };
  }, [selectedId]);

  return (
    <div className="grid grid-cols-[320px_1fr_360px] gap-4 p-4 h-full">
      <LeftGrid />

      <div className="bg-white border rounded-2xl shadow-sm flex flex-col min-h-0">
        <div className="p-3 border-b border-amber-100 bg-amber-50 rounded-t-2xl flex items-center justify-between">
          <h2 className="font-semibold text-amber-800">Training phrases</h2>
          <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800">{posCount}</span>
        </div>
        <div className="p-3 flex-1 min-h-0">
          <CenterPane intentId={selectedId} />
        </div>
      </div>

      <div className="bg-white border rounded-2xl shadow-sm flex flex-col min-h-0">
        <div className="p-3 border-b border-amber-100 bg-amber-50 rounded-t-2xl flex items-center justify-between">
          <h2 className="font-semibold text-amber-800">Test</h2>
          <button
            className="px-3 py-1 rounded-lg border bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
            onClick={async () => {
              try {
                setTesting(true);
                try { if (localStorage.getItem('debug.intent') === '1') console.log('[UI][RunTest][click]'); } catch {}
                // ✅ Testa le frasi visibili nel TestGrid (training set o new phrases)
                const visibleItems = (window as any).__testGridVisibleItems || [];
                if (visibleItems.length > 0) {
                  await actionRunVisibleTests(visibleItems);
                } else {
                  // Fallback: testa tutte le frasi in testStore
                  await actionRunAllTests();
                }
              } finally { setTesting(false); }
            }}
            title={modelReady ? "Run test on visible phrases" : "Train the model first"}
            disabled={testing || !modelReady}
          >
            {testing ? 'Testing…' : 'Run test'}
          </button>
        </div>
        <div className="p-3 min-h-0 flex-1">
          <TestGrid intentId={selectedId} modelReady={modelReady} />
        </div>
      </div>
    </div>
  );
}


