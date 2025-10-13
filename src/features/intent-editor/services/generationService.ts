import { Variant, Lang } from '../types/types';

export async function generateVariants(intentName: string, lang: Lang, n=30, existing: string[]): Promise<Variant[]> {
  const templates = [
    `Ho bisogno di ${intentName}.`,
    `Vorrei ${intentName}.`,
    `Mi serve ${intentName}.`,
    `Puoi aiutarmi con ${intentName}?`,
    `Richiedo ${intentName}.`,
  ];
  const out: Variant[] = [];
  let i = 0;
  while (out.length < n && i < n * 5) {
    const t = templates[i % templates.length];
    i++;
    if (!existing.includes(t) && !out.find(v => v.text === t)) out.push({ id: crypto.randomUUID?.() || Math.random().toString(36).slice(2), text: t, lang });
  }
  return out;
}


