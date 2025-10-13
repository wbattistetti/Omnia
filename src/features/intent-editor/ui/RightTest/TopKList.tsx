import React from 'react';

export function TopKList({ items }: { items: { intentId: string; name: string; fused: number }[] }){
  return (
    <div className="text-sm">
      <div className="font-medium mb-1">Top‑K</div>
      <ul className="space-y-1">{items.map(it => (
        <li key={it.intentId} className="flex items-center gap-2">
          <div className="w-28 truncate">{it.name}</div>
          <div className="flex-1 h-2 bg-gray-200 rounded">
            <div className="h-2 bg-indigo-400 rounded" style={{ width: `${Math.round(it.fused * 100)}%` }} />
          </div>
          <span className="w-10 text-right">{Math.round(it.fused * 100)}%</span>
        </li>
      ))}</ul>
    </div>
  );
}


