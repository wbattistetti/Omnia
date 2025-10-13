import { useIntentStore } from '../state/intentStore';
import { classify } from '../services/inferenceService';

export async function actionRunTest(text: string){
  const intents = useIntentStore.getState().intents;
  return classify(text, intents);
}


