import { Constraint } from './types';

export async function generateConstraint(description: string, variable: string, type: string): Promise<Constraint> {
  const res = await fetch('/api/generateConstraint', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ description, variable, type })
  });
  if (!res.ok) throw new Error('Errore generazione constraint');
  return await res.json();
} 