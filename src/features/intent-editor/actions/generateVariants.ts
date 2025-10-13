import { useIntentStore } from '../state/intentStore';
import { generateVariants } from '../services/generationService';
import { dedupVariants } from '../services/dedupService';

export async function actionGenerateVariants(intentId: string, lang: 'it'|'en'|'pt', n=50) {
  const s = useIntentStore.getState();
  const it = s.intents.find(i=>i.id===intentId); if(!it) return;
  const existing = [...it.variants.curated, ...it.variants.staging].map(v=>v.text);
  const batch = await generateVariants(it.name, lang, n, existing);
  const clean = dedupVariants(batch, [...it.variants.curated, ...it.variants.staging]);
  s.addStaging(intentId, clean);
}


