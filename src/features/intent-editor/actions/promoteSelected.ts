import { useIntentStore } from '../state/intentStore';
export function actionPromoteSelected(intentId: string, variantIds: string[]){
  useIntentStore.getState().promoteToCurated(intentId, variantIds);
}


