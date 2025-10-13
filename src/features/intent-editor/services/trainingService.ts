import { Intent } from '../types/types';

export async function trainTwoStage(_intents: Intent[]): Promise<{ modelId: string }>{
  await new Promise(r=>setTimeout(r, 300));
  return { modelId: 'model_'+Date.now() };
}


