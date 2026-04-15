// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { useCallback } from 'react';
import { useGrammarStore } from '../../core/state/grammarStoreContext';
import { exportGrammar } from '../../core/domain/export';
import type { Grammar } from '../../types/grammarTypes';

/**
 * Hook for handling grammar export
 * - Export to JSON of the graph (without transformations)
 * - Download JSON file
 * - Copy to clipboard
 */
export function useGrammarExport() {
  const { grammar } = useGrammarStore();

  const exportToJSON = useCallback((): Grammar | null => {
    if (!grammar) return null;
    return exportGrammar(grammar);
  }, [grammar]);

  const downloadJSON = useCallback(() => {
    const exported = exportToJSON();
    if (!exported) return;

    const json = JSON.stringify(exported, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${exported.name}_${exported.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [exportToJSON]);

  const copyToClipboard = useCallback(() => {
    const exported = exportToJSON();
    if (!exported) return;

    const json = JSON.stringify(exported, null, 2);
    navigator.clipboard.writeText(json);
  }, [exportToJSON]);

  return {
    exportToJSON,
    downloadJSON,
    copyToClipboard,
  };
}
