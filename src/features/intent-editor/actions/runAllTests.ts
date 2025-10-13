import { useTestStore } from '../state/testStore';
import { actionRunTest } from './runTest';

export async function actionRunAllTests(threshold = 0.5){
  const items = useTestStore.getState().items;
  for(const it of items){
    try{
      const res = await actionRunTest(it.text);
      const top = Array.isArray(res?.top) ? res.top[0] : undefined;
      const score = Number(top?.score ?? 0);
      const intentId = (top?.id || top?.intentId) as string | undefined;
      useTestStore.getState().setResult(it.id, { predictedIntentId: intentId, score });
      const ok = score >= threshold;
      useTestStore.getState()[ok ? 'markCorrect' : 'markWrong'](it.id);
    }catch{
      // ignore errors per item
    }
  }
}


