import { messagesPrompt } from './prompts';

/**
 * Step 4: Genera i messaggi batch per un gruppo logico di spoken key
 * @param spokenKeys lista di spoken key posizionali
 * @returns oggetto messages (spokenKey -> testo)
 */
export default async function batchMessages(spokenKeys: string[]): Promise<Record<string, string>> {
  if (!spokenKeys || spokenKeys.length === 0) return {};
  const res = await fetch('/api/ddt/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ spoken_keys: spokenKeys })
  });
  if (!res.ok) throw new Error('AI messages batch generation failed');
  const data = await res.json();
  if (!data || typeof data !== 'object') throw new Error('AI response missing messages');
  return data;
} 