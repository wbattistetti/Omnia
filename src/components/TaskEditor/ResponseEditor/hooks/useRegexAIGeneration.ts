import { useState, useCallback } from 'react';
import { ValidationResult } from '@responseEditor/hooks/useRegexValidation';
import { RowResult } from '@responseEditor/hooks/useExtractionTesting';
import { useNotesStore, getCellKeyFromPhrase } from '@responseEditor/features/step-management/stores/notesStore';
import { getSubTasksInfo } from '@responseEditor/utils/regexGroupUtils';
import { deriveSubTaskKey } from '@utils/taskUtils';
import type { TaskTreeNode } from '@types/taskTypes';
import { buildSemanticContract } from '@utils/contract/buildEntity';
import { buildAIPrompt, getSystemMessageForEngine } from '@utils/aiPromptTemplates';
import { SemanticContractService } from '@services/SemanticContractService';
import { EngineService } from '@services/EngineService';
import type { EngineConfig } from '@types/semanticContract';

interface FeedbackItem {
  testPhrase: string;
  extractedValue: string;
  userNote: string;
  groupKey: string;
}

interface UseRegexAIGenerationOptions {
  node?: any;
  kind?: string;
  testCases?: string[];
  onSuccess?: (newRegex: string) => void;
  onError?: (error: Error) => void;
  // ✅ NEW: Feedback from test notes
  examplesList?: string[];
  rowResults?: RowResult[];
  // ✅ REMOVED: getNote prop - now managed via Zustand store
}

/**
 * Hook to manage AI regex generation
 * Extracted from handleButtonClick to improve maintainability
 */
export function useRegexAIGeneration({
  node,
  kind,
  testCases = [],
  onSuccess,
  onError,
  examplesList = [],
  rowResults = [],
}: UseRegexAIGenerationOptions) {
  // ✅ Use Zustand store for notes
  const getNote = useNotesStore((s) => s.getNote);
  const [generatingRegex, setGeneratingRegex] = useState(false);
  const [regexBackup, setRegexBackup] = useState('');

  const generateRegex = useCallback(async (
    currentText: string, // ✅ Changed: now accepts currentText (regex + comments)
    validationResult: ValidationResult | null
  ) => {
    if (!node?.id) {
      return;
    }

    // ✅ Load or build semantic contract
    let contract = await SemanticContractService.load(node.id);
    if (!contract) {
      // Build contract from node if not persisted
      contract = buildSemanticContract(node as TaskTreeNode | null);
      if (!contract) {
        return;
      }
      // Save contract for future use
      await SemanticContractService.save(node.id, contract);
    }

    // ✅ Build tester feedback in correct format
    const testerFeedback = examplesList.map((phrase, index) => {
      const result = rowResults?.[index];
      const note = getNote(getCellKeyFromPhrase(phrase, 'regex'));
      const matched = result?.regex && result.regex !== '—';

      return {
        value: phrase,
        expected: (matched ? 'match' : 'no_match') as 'match' | 'no_match',
        note: note || undefined
      };
    });

    // ✅ Build prompt using fixed template
    const prompt = buildAIPrompt({
      contract,
      currentText: currentText || '',
      testerFeedback,
      engine: 'regex'
    });

    if (!prompt.trim() || prompt.trim().length < 5) {
      return;
    }

    // Save backup
    setRegexBackup(currentText);

    // Start generation
    setGeneratingRegex(true);

    try {
      // Get AI provider and model from localStorage
      let provider = 'groq';
      let model: string | undefined = undefined;
      try {
        const savedProvider = localStorage.getItem('omnia.aiProvider') || 'groq';
        const savedModel = localStorage.getItem('omnia.aiModel');
        provider = savedProvider;
        model = savedModel || undefined;
      } catch (e) {
        // Could not read AI config from localStorage
      }

      // ✅ Build request body with contract (treeStructure) and tester feedback
      const requestBody: any = {
        description: prompt, // ✅ Full prompt from fixed template
        treeStructure: contract, // ✅ Semantic contract (source of truth)
        testerFeedback: testerFeedback, // ✅ Tester feedback in correct format
        engine: 'regex', // ✅ Engine type
        provider,
        model
      };

      const response = await fetch('/api/nlp/generate-regex', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        // ✅ FIX: Gestisci errori 500 con HTML invece di JSON
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const error = await response.json();
            errorMessage = error.detail || error.message || errorMessage;
          } else {
            // Se non è JSON, prova a leggere come testo
            const text = await response.text();
            if (text && text.length < 200) {
              errorMessage = text;
            }
          }
        } catch (parseError) {
          // Se il parsing fallisce, usa il messaggio di default
          console.error('[useRegexAIGeneration] Error parsing error response:', parseError);
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();

      if (data.success && data.regex) {
        const newRegex = data.regex.trim();

        // ✅ Save engine configuration
        const engineConfig: EngineConfig = {
          type: 'regex',
          config: {
            regex: newRegex
          },
          version: 1,
          generatedAt: new Date(),
          generatedBy: 'ai'
        };

        await EngineService.save(node.id, engineConfig);

        // Call success callback
        if (onSuccess) {
          onSuccess(newRegex);
        }
      } else {
        throw new Error('No regex returned from API');
      }
    } catch (error) {
      if (onError) {
        onError(error instanceof Error ? error : new Error('Unknown error'));
      } else {
        alert(`Error generating regex: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    } finally {
      setGeneratingRegex(false);
    }
  }, [node, kind, testCases, onSuccess, onError, examplesList, rowResults, getNote]);

  return {
    generatingRegex,
    regexBackup,
    generateRegex,
  };
}
