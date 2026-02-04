// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * useTemplateSearch Hook
 *
 * Handles template search and matching.
 * Manages loading state and results.
 */

import { useState, useCallback, useEffect } from 'react';
import { searchTemplate, ensureTemplateCacheLoaded } from '../services/templateSearchService';
import type { TemplateSearchResult } from '../services/templateSearchService';

export function useTemplateSearch(taskLabel: string, taskType?: string) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TemplateSearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Ensure cache is loaded
      const cacheLoaded = await ensureTemplateCacheLoaded();
      if (!cacheLoaded) {
        throw new Error('Failed to load template cache');
      }

      // Search for template
      const searchResult = await searchTemplate(taskLabel, taskType);
      setResult(searchResult);

      if (!searchResult.found) {
        setError(searchResult.reason || 'No template found');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      setResult({ found: false, reason: errorMessage });
    } finally {
      setLoading(false);
    }
  }, [taskLabel, taskType]);

  // Auto-search on mount if taskLabel is provided
  useEffect(() => {
    if (taskLabel) {
      search();
    }
  }, [taskLabel, search]);

  return {
    loading,
    result,
    error,
    search,
    found: result?.found || false,
    template: result?.template
  };
}
