import { TestResult, Intent } from '../types/types';

export async function classify(_text: string, intents: Intent[]): Promise<TestResult> {
  const name = intents[0]?.name || '—';
  return {
    decision: intents.length ? 'MATCH' : 'NO_MATCH', intentId: intents[0]?.id, score: 0.82,
    top: intents.slice(0,3).map((it,idx)=>({ intentId: it.id, name: it.name, fused: 0.8-idx*0.2 })),
    explain: { keywords: ['bolletta','alto'], nearestExample: 'totale troppo alto' },
    latency: { a: 10, b: 9, total: 24 },
  };
}


