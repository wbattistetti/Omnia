import { useIntentStore } from '../state/intentStore';
import { useModelStore } from '../state/modelStore';
import { trainTwoStage } from '../services/trainingService';

export async function actionTrainModel(){
  const intents = useIntentStore.getState().intents;
  useModelStore.getState().setTraining(true);
  try {
    const { modelId } = await trainTwoStage(intents);
    useModelStore.getState().setModelId(modelId);
  } finally {
    useModelStore.getState().setTraining(false);
  }
}


