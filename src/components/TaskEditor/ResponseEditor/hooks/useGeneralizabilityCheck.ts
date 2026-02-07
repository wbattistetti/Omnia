// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { useState, useEffect } from 'react';
import type { TaskTree } from '@types/taskTypes';

interface GeneralizabilityResult {
  isGeneralizable: boolean;
  generalizationReason: string;
}

export function useGeneralizabilityCheck(
  taskTree: TaskTree | null | undefined,
  taskLabel?: string,
  projectId?: string | null
): {
  isGeneralizable: boolean;
  generalizationReason: string;
  isLoading: boolean;
  error: string | null;
} {
  const [result, setResult] = useState<GeneralizabilityResult>({
    isGeneralizable: false,
    generalizationReason: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Only check if taskTree is complete (has nodes and structure)
    if (!taskTree || !taskTree.nodes || taskTree.nodes.length === 0) {
      setResult({
        isGeneralizable: false,
        generalizationReason: '',
      });
      return;
    }

    // Debounce check to avoid too many API calls
    const timeoutId = setTimeout(async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/tasks/check-generalizability', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            taskTree,
            taskLabel: taskLabel || taskTree.labelKey || '',
            projectId: projectId || undefined,
          }),
        });

        if (!response.ok) {
          throw new Error(`Failed to check generalizability: ${response.statusText}`);
        }

        const data = await response.json();
        setResult({
          isGeneralizable: data.isGeneralizable || false,
          generalizationReason: data.generalizationReason || '',
        });
      } catch (err) {
        console.error('[useGeneralizabilityCheck] Error:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        setResult({
          isGeneralizable: false,
          generalizationReason: '',
        });
      } finally {
        setIsLoading(false);
      }
    }, 1000); // 1 second debounce

    return () => clearTimeout(timeoutId);
  }, [taskTree, taskLabel, projectId]);

  return {
    isGeneralizable: result.isGeneralizable,
    generalizationReason: result.generalizationReason,
    isLoading,
    error,
  };
}
