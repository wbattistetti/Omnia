import { useTestStore } from '../state/testStore';
import { actionRunTest } from './runTest';
import { useIntentStore } from '../state/intentStore';

type TestItem = {
  id: string;
  text: string;
};

/**
 * Testa una lista specifica di frasi (per training set o new phrases)
 */
export async function actionRunVisibleTests(itemsToTest: TestItem[]){
  const selectedId = useIntentStore.getState().selectedId;
  const testStore = useTestStore.getState();

  try { if (localStorage.getItem('debug.intent') === '1') console.log('[RunVisibleTests][start]', { items: itemsToTest.length, selectedId }); } catch {}

  for(const it of itemsToTest){
    try{
      try { if (localStorage.getItem('debug.intent') === '1') console.log('[RunVisibleTests][item][request]', { id: it.id, text: it.text }); } catch {}
      const res = await actionRunTest(it.text);
      const top = Array.isArray(res?.top) ? res.top[0] : undefined;
      const intentId = (top?.id || top?.intentId) as string | undefined;
      const score = Number(top?.score ?? 0);

      // ✅ Aggiorna risultato se l'item esiste nel testStore (solo per new phrases)
      const existingItem = testStore.items.find(i => i.id === it.id);
      if (existingItem) {
        testStore.setResult(it.id, { predictedIntentId: intentId, score });
        const decision = (res as any)?.decision as string | undefined;
        const matches = Boolean(decision === 'MATCH' && selectedId && intentId && selectedId === intentId);
        testStore[matches ? 'markCorrect' : 'markWrong'](it.id);
      } else {
        // ✅ Item non in testStore = training phrase, salva risultato in window per TestGrid
        const decision = (res as any)?.decision as string | undefined;
        const matches = Boolean(decision === 'MATCH' && selectedId && intentId && selectedId === intentId);
        if (!(window as any).__trainingTestResults) {
          (window as any).__trainingTestResults = new Map();
        }
        (window as any).__trainingTestResults.set(it.id, {
          status: matches ? 'correct' : 'wrong',
          predictedIntentId: intentId,
          score
        });
        // Trigger custom event per notificare TestGrid
        window.dispatchEvent(new CustomEvent('trainingTestResult', {
          detail: { id: it.id, status: matches ? 'correct' : 'wrong', predictedIntentId: intentId, score }
        }));
      }

      try { if (localStorage.getItem('debug.intent') === '1') console.log('[RunVisibleTests][item][result]', { id: it.id, text: it.text, top, matches: Boolean(decision === 'MATCH' && selectedId && intentId && selectedId === intentId) }); } catch {}
    }catch{
      // ignore errors per item
      try { if (localStorage.getItem('debug.intent') === '1') console.warn('[RunVisibleTests][item][error]', { id: it.id, text: it.text }); } catch {}
    }
  }
  try { if (localStorage.getItem('debug.intent') === '1') console.log('[RunVisibleTests][done]'); } catch {}
}

