import React from 'react';
import { useIntentStore } from '../../state/intentStore';
import ListGrid from '../common/ListGrid';
import { GitBranch } from 'lucide-react';

export function LeftGrid(){
  const intents = useIntentStore(s=>s.intents);
  const selectedId = useIntentStore(s=>s.selectedId);
  const select = useIntentStore(s=>s.select);
  const addOrFocusIntent = useIntentStore(s=>s.addOrFocusIntent);
  return (
    <div className="border border-amber-300 rounded-2xl overflow-hidden shadow-sm">
      <div className="px-3 py-2 bg-amber-200 text-slate-900 text-sm font-semibold border-b">Intents</div>
      <div className="p-3">
        <ListGrid
          items={intents.map(i=>({ id:i.id, label:i.name }))}
          selectedId={selectedId}
          onSelect={select}
          placeholder="Add or find a problem…"
          addButtonLabel="+"
          onEnterAdd={(name) => {
            const id = addOrFocusIntent(name, ['it']);
            select(id);
          }}
          LeftIcon={GitBranch}
          sort="alpha"
        />
      </div>
    </div>
  );
}


