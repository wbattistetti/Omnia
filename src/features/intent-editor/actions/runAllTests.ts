import { useTestStore } from '../state/testStore';
import { actionRunTest } from './runTest';
import { useIntentStore } from '../state/intentStore';

export async function actionRunAllTests(){
  const items = useTestStore.getState().items;
  const selectedId = useIntentStore.getState().selectedId;
  try { if (localStorage.getItem('debug.intent') === '1') console.log('[RunAllTests][start]', { items: items.length, selectedId }); } catch {}
  for(const it of items){
    try{
      try { if (localStorage.getItem('debug.intent') === '1') console.log('[RunAllTests][item][request]', { id: it.id, text: it.text }); } catch {}
      const res = await actionRunTest(it.text);
      const top = Array.isArray(res?.top) ? res.top[0] : undefined;
      const intentId = (top?.id || top?.intentId) as string | undefined;
      const score = Number(top?.score ?? 0);
      useTestStore.getState().setResult(it.id, { predictedIntentId: intentId, score });
      const decision = (res as any)?.decision as string | undefined;
      const matches = Boolean(decision === 'MATCH' && selectedId && intentId && selectedId === intentId);
      useTestStore.getState()[matches ? 'markCorrect' : 'markWrong'](it.id);
      try { if (localStorage.getItem('debug.intent') === '1') console.log('[RunAllTests][item][result]', { id: it.id, text: it.text, top, matches }); } catch {}
    }catch{
      // ignore errors per item
      try { if (localStorage.getItem('debug.intent') === '1') console.warn('[RunAllTests][item][error]', { id: it.id, text: it.text }); } catch {}
    }
  }
  try { if (localStorage.getItem('debug.intent') === '1') console.log('[RunAllTests][done]'); } catch {}
}


