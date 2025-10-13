import React from 'react';
import { useIntentStore } from '../../state/intentStore';

export function ThresholdControl({ id, value }: { id: string; value: number }){
  const setThr = useIntentStore(s=>s.setThreshold);
  return (
    <div className="flex items-center gap-2">
      <input type="range" min={0} max={1} step={0.01} value={value} onChange={e=>setThr(id, Number(e.target.value))} />
      <span className="text-xs">{Math.round(value*100)}%</span>
    </div>
  );
}


