import React from 'react';
import { Intent } from '../../types/types';
import { useIntentStore } from '../../state/intentStore';

export function SignalsEditor({ id, signals }: { id: string; signals: Intent['signals'] }){
  const upd = useIntentStore(s=>s.updateSignals);
  return (
    <div>
      <div className="font-medium mb-1">Signals</div>
      <button className="px-2 py-1 text-xs rounded-lg border" onClick={()=>upd(id, s=>({ ...s, keywords: [...s.keywords, { t: 'bolletta', w: 1 }] }))}>+ Keyword</button>
      <div className="mt-2 text-xs text-gray-600">{signals.keywords.map(k=>k.t).join(', ') || '—'}</div>
    </div>
  );
}


