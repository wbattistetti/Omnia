import { useIntentStore } from '../state/intentStore';
import { trainIntent, TrainingPhrase } from '../services/trainingService';

/**
 * Fa training di tutti gli intenti abilitati
 */
export async function actionTrainModel(){
  const intents = useIntentStore.getState().intents.filter(it => it.enabled !== false);

  if (intents.length === 0) {
    alert('No enabled intents to train');
    return;
  }

  let successCount = 0;
  let errorCount = 0;

  for (const intent of intents) {
    try {
      // Prepara frasi per training
      const phrases: TrainingPhrase[] = [
        ...intent.variants.curated.map(v => ({ id: v.id, text: v.text, type: 'matching' as const })),
        ...intent.variants.hardNeg.map(v => ({ id: v.id, text: v.text, type: 'not-matching' as const }))
      ];

      if (phrases.length === 0) {
        console.log(`[TrainModel] Skipping intent ${intent.name} - no phrases`);
        continue;
      }

      await trainIntent({
        intentId: intent.id,
        phrases
      });

      successCount++;
    } catch (err) {
      console.error(`[TrainModel] Failed to train intent ${intent.name}:`, err);
      errorCount++;
    }
  }

  if (successCount > 0) {
    alert(`Training completed: ${successCount} intent(s) trained${errorCount > 0 ? `, ${errorCount} failed` : ''}`);
  } else {
    alert(`Training failed: ${errorCount} intent(s) failed`);
  }
}


