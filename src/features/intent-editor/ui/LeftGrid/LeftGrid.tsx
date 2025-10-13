import React from 'react';
import { useIntentStore } from '../../state/intentStore';
import ListGrid from '../common/ListGrid';
import { GitBranch } from 'lucide-react';

export function LeftGrid(){
  const intents = useIntentStore(s=>s.intents);
  const selectedId = useIntentStore(s=>s.selectedId);
  const select = useIntentStore(s=>s.select);
  const addOrFocusIntent = useIntentStore(s=>s.addOrFocusIntent);
  const rename = useIntentStore(s=>s.renameIntent);
  const remove = useIntentStore(s=>s.removeIntent);
  const items = intents.map(i=>({
    id: i.id,
    label: i.name,
    meta: {
      pos: i.variants.curated.length,
      neg: i.variants.hardNeg.length,
      key: (i.signals.keywords || []).length,
    }
  }));
  return (
    <div className="border border-amber-300 rounded-2xl overflow-hidden shadow-sm">
      <div className="px-3 py-2 bg-amber-200 text-slate-900 text-sm font-semibold border-b">Intents</div>
      <div className="p-3">
        <ListGrid
          items={items}
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
          labelAddon={(item)=> (
            <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] bg-emerald-100 text-emerald-700">{item.meta?.pos ?? 0}</span>
          )}
          rightSlot={() => null}
          onEditItem={(id, newLabel)=> rename(id, newLabel)}
          onDeleteItem={(id)=> remove(id)}
        />
      </div>
    </div>
  );
}


