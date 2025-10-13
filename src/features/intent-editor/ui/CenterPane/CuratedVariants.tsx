import React from 'react';
import { Variant } from '../../types/types';

export function CuratedVariants({ items }: { items: Variant[] }){
  return (
    <div>
      <div className="font-medium mb-1">Curated</div>
      <div className="flex flex-wrap gap-1">
        {items.map(v=> <span key={v.id} className="px-2 py-0.5 rounded-full text-xs bg-emerald-50 border border-emerald-200">{v.text}</span>)}
      </div>
    </div>
  );
}


