// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * useStructureGeneration Hook
 *
 * Handles AI-based structure data generation.
 * Manages loading state and results.
 */

import { useState, useCallback } from 'react';
import { generateStructure, regenerateStructure, validateStructure } from '../services/structureGenerationService';
import type { SchemaNode } from '../types/wizard.types';
import type { StructureGenerationResult } from '../services/structureGenerationService';

export function useStructureGeneration() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async (
    taskLabel: string,
    taskDescription?: string,
    provider: 'openai' | 'groq' = 'openai'
  ): Promise<StructureGenerationResult> => {
    setLoading(true);
    setError(null);

    try {
      const result = await generateStructure(taskLabel, taskDescription, provider);

      if (!result.success) {
        setError(result.error || 'Generation failed');
      }

      // Validate structure if generated
      if (result.success && result.structure) {
        const validation = validateStructure(result.structure);
        if (!validation.valid) {
          setError(`Validation failed: ${validation.errors.join(', ')}`);
          return {
            success: false,
            error: `Validation failed: ${validation.errors.join(', ')}`
          };
        }
      }

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      return {
        success: false,
        error: errorMessage
      };
    } finally {
      setLoading(false);
    }
  }, []);

  const regenerate = useCallback(async (
    taskLabel: string,
    feedback: string,
    previousStructure: SchemaNode[],
    provider: 'openai' | 'groq' = 'openai'
  ): Promise<StructureGenerationResult> => {
    setLoading(true);
    setError(null);

    try {
      const result = await regenerateStructure(taskLabel, feedback, previousStructure, provider);

      if (!result.success) {
        setError(result.error || 'Regeneration failed');
      }

      // Validate structure if generated
      if (result.success && result.structure) {
        const validation = validateStructure(result.structure);
        if (!validation.valid) {
          setError(`Validation failed: ${validation.errors.join(', ')}`);
          return {
            success: false,
            error: `Validation failed: ${validation.errors.join(', ')}`
          };
        }
      }

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      return {
        success: false,
        error: errorMessage
      };
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    generate,
    regenerate
  };
}
