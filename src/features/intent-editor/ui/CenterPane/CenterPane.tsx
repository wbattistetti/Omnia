import React from 'react';
import { useIntentStore } from '../../state/intentStore';
import PhrasesPanel from './PhrasesPanel';
import { useIntentStore as useStore } from '../../state/intentStore';
import { ThresholdControl } from './ThresholdControl';
import { actionRunAllTests } from '../../actions/runAllTests';

export function CenterPane({ intentId }: { intentId?: string }){
  const it = useIntentStore(s=> s.intents.find(x=>x.id===intentId));
  if(!it) return <div className="border rounded-2xl p-4 bg-white">Select a problem</div>;
  return (
    <div className="h-full flex flex-col min-h-0">
      {/* titolo/soglia nascosti per semplificare: sono già nel pannello a sinistra */}
      <div className="hidden"><h2 className="font-semibold">{it.name}</h2><ThresholdControl id={it.id} value={it.threshold}/></div>
      <PhrasesPanel
        intentName={it.name}
        intentId={it.id}
        lang={(localStorage.getItem('project.lang') as any) || 'pt'}
        positive={it.variants.curated.map(v=>({ id: v.id, text: v.text }))}
        negative={it.variants.hardNeg.map(v=>({ id: v.id, text: v.text }))}
        keywords={(it as any).signals?.keywords?.map((k:any)=>({ id: (k.t||k)+'_'+(k.w||1), term: k.t || k })) || []}
        onAddPositive={(t)=>{ useStore.getState().addCurated(it.id, t, 'it'); }}
        onAddNegative={(t)=>{ useStore.getState().addHardNeg(it.id, { id: (crypto as any).randomUUID?.() || Math.random().toString(36).slice(2), text: t, lang: 'it' }); }}
        onAddKeyword={(t)=>{ useStore.getState().addKeyword(it.id, t, 1); }}
        onClearPositive={()=>{ useStore.getState().clearCurated(it.id); }}
        onClearNegative={()=>{ useStore.getState().clearHardNeg(it.id); }}
        onClearKeywords={()=>{ useStore.getState().clearKeywords(it.id); }}
        onTest={async ()=>{ try { await actionRunAllTests(); } catch {} }}
      />
    </div>
  );
}


