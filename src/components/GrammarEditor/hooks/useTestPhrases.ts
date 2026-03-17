// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { useCallback } from 'react';
import type { Grammar } from '../types/grammarTypes';
import type { TestPhraseResult, MatchDetail } from '../components/TestPhrases/TestPhrases';

export function useTestPhrases() {
  const testPhrase = useCallback(async (
    grammar: Grammar,
    text: string
  ): Promise<TestPhraseResult> => {
    const response = await fetch('/api/grammar/test-phrase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ grammar, text }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    return data.result;
  }, []);

  const testAllPhrases = useCallback(async (
    grammar: Grammar,
    phrases: Array<{ id: string; text: string }>
  ): Promise<Array<TestPhraseResult & { phraseId: string }>> => {
    const response = await fetch('/api/grammar/test-phrases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grammar,
        phrases: phrases.map(p => ({ id: p.id, text: p.text }))
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    return data.results;
  }, []);

  return { testPhrase, testAllPhrases };
}
