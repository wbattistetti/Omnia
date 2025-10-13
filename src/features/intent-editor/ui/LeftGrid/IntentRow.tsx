import React from 'react';
import { Intent } from '../../types/types';
import { useIntentStore } from '../../state/intentStore';

export function IntentRow({ it }: { it: Intent }){
  const select = useIntentStore(s=>s.select);
  return (
    <tr className="hover:bg-gray-50 cursor-pointer" onClick={()=>select(it.id)}>
      <td className="p-2">
        <div className="font-medium">{it.name}</div>
        <div className="text-xs text-gray-500">{it.id}</div>
      </td>
      <td className="p-2 text-right text-xs">{Math.round(it.threshold*100)}%</td>
    </tr>
  );
}


