import { structurePrompt } from './prompts';

/**
 * Step 1: Genera la struttura base del DDT tramite AI
 * @param meaning tipo di dato richiesto (es: 'date of birth')
 * @param desc descrizione opzionale
 * @returns { ddt, messages }
 */
export default async function fetchStructure(meaning: string, desc?: string): Promise<{ ddt: any; messages: Record<string, string> }> {
  const res = await fetch('/api/ddt/structure', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ meaning, desc })
  });
  if (!res.ok) throw new Error('AI structure generation failed');
  const data = await res.json();
  if (!data.ddt || !data.messages) throw new Error('AI response missing ddt or messages');
  return { ddt: data.ddt, messages: data.messages };
} 