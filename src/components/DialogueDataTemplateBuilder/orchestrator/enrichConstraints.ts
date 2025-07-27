import { constraintPrompt } from './prompts';

/**
 * Step 2: Arricchisce i constraints del DDT tramite AI
 * @param ddt struttura DDT da arricchire
 * @returns struttura DDT aggiornata con constraints arricchiti
 */
export default async function enrichConstraints(ddt: any): Promise<any> {
  async function enrichNode(node: any) {
    if (Array.isArray(node.constraints)) {
      for (let i = 0; i < node.constraints.length; i++) {
        const c = node.constraints[i];
        // Chiedi all'AI solo se manca payoff/summary/label/description
        if (!c.payoff || !c.summary || !c.label || !c.description) {
          const res = await fetch('/api/ddt/constraint', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              field: node.label || '',
              type: c.type || '',
              description: c.description || ''
            })
          });
          if (res.ok) {
            const data = await res.json();
            node.constraints[i] = { ...c, ...data };
          }
        }
      }
    }
    if (Array.isArray(node.subData)) {
      for (const sub of node.subData) {
        await enrichNode(sub);
      }
    }
  }
  await enrichNode(ddt);
  return ddt;
} 