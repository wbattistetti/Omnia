import { scriptPrompt } from './prompts';

/**
 * Step 3: Genera gli script per ogni constraint del DDT tramite AI
 * @param ddt struttura DDT da arricchire
 * @returns struttura DDT aggiornata con scripts nei constraints
 */
export default async function generateScripts(ddt: any): Promise<any> {
  async function enrichNode(node: any) {
    if (Array.isArray(node.constraints)) {
      for (let i = 0; i < node.constraints.length; i++) {
        const c = node.constraints[i];
        if (!c.scripts) {
          const res = await fetch('/api/ddt/constraint/script', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: c.type || '',
              label: c.label || '',
              description: c.description || '',
              variable: node.variable?.name || node.variable?.id || ''
            })
          });
          if (res.ok) {
            const data = await res.json();
            node.constraints[i].scripts = data.scripts;
            node.constraints[i].tests = data.tests;
            node.constraints[i].payoff = data.payoff;
            node.constraints[i].label = data.label;
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