import React, { useState } from 'react';
import { Variant } from '../../types/types';
import { actionPromoteSelected } from '../../actions/promoteSelected';

export function StagingVariants({ items, intentId }: { items: Variant[]; intentId: string }){
  const [sel, setSel] = useState<Record<string, boolean>>({});
  const ids = Object.keys(sel).filter(k=>sel[k]);
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div className="font-medium">Staging</div>
        <button className="px-2 py-1 text-xs rounded-lg border" disabled={!ids.length} onClick={()=>actionPromoteSelected(intentId, ids)}>Promote</button>
      </div>
      <div className="flex flex-col gap-1">
        {items.map(v=> (
          <label key={v.id} className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={!!sel[v.id]} onChange={e=>setSel(s=>({ ...s, [v.id]: e.target.checked }))} />
            <span className="text-gray-700">{v.text}</span>
          </label>
        ))}
      </div>
    </div>
  );
}


