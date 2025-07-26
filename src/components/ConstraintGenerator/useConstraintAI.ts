import { useState } from 'react';
import { AIScriptResult } from './types';
import { generateConstraint } from './ConstraintAPI';

export function useConstraintAI() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AIScriptResult | null>(null);

  async function generate(description: string, variable: string, type: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await generateConstraint(description, variable, type);
      setResult(res);
      return res;
    } catch (e: any) {
      setError(e.message || 'Errore generazione constraint');
      setResult(null);
      return null;
    } finally {
      setLoading(false);
    }
  }

  return { loading, error, result, generate };
} 