/**
 * Calls backend to generate curated training phrases from an intent business description.
 */

export type GeneratePhrasesParams = {
  intentName: string;
  description: string;
  lang?: string;
  count?: number;
};

export async function generateTrainingPhrasesForIntent(
  params: GeneratePhrasesParams,
): Promise<string[]> {
  const res = await fetch('/api/intents/generate-training-phrases', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      intentName: params.intentName,
      description: params.description,
      lang: params.lang ?? 'it',
      count: params.count ?? 8,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : `HTTP ${res.status}`);
  }
  if (!Array.isArray(data.phrases)) {
    throw new Error('invalid_response');
  }
  return data.phrases as string[];
}
