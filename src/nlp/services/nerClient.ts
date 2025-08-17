export type NerResponse<T> = { candidates: Array<{ value: T; confidence: number }> };

export async function nerExtract<T>(field: string, text: string): Promise<NerResponse<T>> {
  const controller = new AbortController();
  // Increase timeout to allow first-time spaCy model load (can take several seconds)
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch('/api/ner/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ field, text }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error('NER_HTTP_' + res.status);
    return await res.json();
  } finally {
    clearTimeout(timeout);
  }
}


