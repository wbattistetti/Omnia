import React from 'react';
import { Variant } from '../../types/types';
import { useIntentStore } from '../../state/intentStore';

export function HardNegatives({ items, intentId }: { items: Variant[]; intentId: string }){
  const add = useIntentStore(s=>s.addHardNeg);
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div className="font-medium">Hard negatives</div>
        <button className="px-2 py-1 text-xs rounded-lg border" onClick={()=>add(intentId, { id: crypto.randomUUID(), text: 'esempio negativo', lang: 'it' })}>+ Add</button>
      </div>
      <ul className="list-disc pl-5 text-sm">{items.map(v=> <li key={v.id}>{v.text}</li>)}</ul>
    </div>
  );
}


