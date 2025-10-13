import React from 'react';
import { useIntentStore } from '../../state/intentStore';
import { actionGenerateVariants } from '../../actions/generateVariants';
import { actionTrainModel } from '../../actions/trainModel';

export function LeftGridToolbar(){
  const addIntent = useIntentStore(s=>s.addIntent);
  const selectedId = useIntentStore(s=>s.selectedId);
  return (
    <div className="flex items-center gap-2">
      <button className="px-2 py-1 text-sm rounded-lg border" onClick={()=>addIntent('New problem',['it'])}>+ New</button>
      <button className="px-2 py-1 text-sm rounded-lg border" disabled={!selectedId} onClick={()=>selectedId && actionGenerateVariants(selectedId,'it',50)}>Generate</button>
      <button className="px-2 py-1 text-sm rounded-lg border" onClick={()=>actionTrainModel()}>Train</button>
    </div>
  );
}


