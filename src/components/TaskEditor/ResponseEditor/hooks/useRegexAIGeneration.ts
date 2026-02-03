import { useState, useCallback } from 'react';
import { ValidationResult } from './useRegexValidation';
import { RowResult } from './useExtractionTesting';
import { useNotesStore, getCellKeyFromPhrase } from '../stores/notesStore';
import { getSubTasksInfo } from '../utils/regexGroupUtils';
import { deriveSubTaskKey } from '../../../../utils/taskUtils';
import type { TaskTreeNode } from '../../../../types/taskTypes';
import { buildSemanticContract } from '../../../../utils/semanticContractBuilder';
import { buildAIPrompt, getSystemMessageForEngine } from '../../../../utils/aiPromptTemplates';
import { SemanticContractService } from '../../../../services/SemanticContractService';
import { EngineService } from '../../../../services/EngineService';
import type { EngineConfig } from '../../../../types/semanticContract';

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
      console.error('[AI Regex] Cannot generate: node.id is missing');
      return;
    }

    // ✅ Load or build semantic contract
    let contract = await SemanticContractService.load(node.id);
    if (!contract) {
      // Build contract from node if not persisted
      contract = buildSemanticContract(node as TaskTreeNode | null);
      if (!contract) {
        console.error('[AI Regex] Cannot generate: semantic contract is null');
        return;
      }
      // Save contract for future use
      await SemanticContractService.save(node.id, contract);
      console.log('[AI Regex] Built and saved new semantic contract');
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
      console.log('[AI Regex] ❌ Prompt too short, cannot generate');
      return;
    }

    console.log('[AI Regex] 🔵 Starting generation with fixed template prompt');
    console.log('[AI Regex] 🔵 Contract version:', contract.version);
    console.log('[AI Regex] 🔵 Tester feedback count:', testerFeedback.length);

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
        console.warn('[AI Regex] Could not read AI config from localStorage:', e);
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

      // ✅ LOG DETTAGLIATO DEL MESSAGGIO COMPLETO ALL'AI
      console.group('%c[AI Regex] MESSAGGIO COMPLETO ALL\'AI (Refine Regex)', 'color: #00ff00; font-size: 14px; font-weight: bold; background: #000; padding: 4px;');
      console.log('%cPROMPT DESCRIPTION:', 'color: #00aaff; font-weight: bold;');
      console.log(prompt);
      console.log('%cREQUEST BODY COMPLETO:', 'color: #00aaff; font-weight: bold;');
      console.log(JSON.stringify(requestBody, null, 2));
      console.log('%cCONFIGURAZIONE:', 'color: #00aaff; font-weight: bold;');
      console.table({
        'Provider': provider,
        'Model': model || '(default)',
        'Current Regex': currentRegex || '(empty)',
        'SubTasks': subDataInfo.length,
        'Kind': kind || '(none)',
        'Feedback Items': feedbackItems.length,
        'Unmatched Test Cases': unmatchedTestCases.length,
        'Has Validation Errors': hasValidationErrors
      });
      console.groupEnd();

      console.log('[AI Regex] 🟢 Calling API /api/nlp/generate-regex');

      const response = await fetch('/api/nlp/generate-regex', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      console.log('[AI Regex] 🟢 API Response status:', response.status);
      console.log('[AI Regex] 🟢 API Response ok:', response.ok);

      if (!response.ok) {
        const error = await response.json();
        console.log('[AI Regex] ❌ API Error response:', error);
        throw new Error(error.detail || 'Failed to generate regex');
      }

      const data = await response.json();
      console.log('[AI Regex] ✅ API Response data:', data);
      console.log('[AI Regex] ✅ data.success:', data.success);
      console.log('[AI Regex] ✅ data.regex:', data.regex);

      if (data.success && data.regex) {
        const newRegex = data.regex.trim();
        console.log('[AI Regex] ✅ Regex generated successfully:', newRegex);

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
        console.log('[AI Regex] ✅ Engine saved to template');

        // Call success callback
        if (onSuccess) {
          onSuccess(newRegex);
        }

        if (data.explanation) {
          console.log('[AI Regex] ✅ Explanation:', data.explanation);
        }
      } else {
        console.log('[AI Regex] ❌ Invalid response: data.success =', data.success, ', data.regex =', data.regex);
        throw new Error('No regex returned from API');
      }
    } catch (error) {
      console.error('[AI Regex] ❌ Error caught:', error);
      console.error('[AI Regex] ❌ Error message:', error instanceof Error ? error.message : 'Unknown error');

      if (onError) {
        onError(error instanceof Error ? error : new Error('Unknown error'));
      } else {
        alert(`Error generating regex: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    } finally {
      console.log('[AI Regex] 🟢 Finally block: setting generatingRegex to false');
      setGeneratingRegex(false);
      console.log('[AI Regex] 🟢 generatingRegex should now be: false');
    }
  }, [node, kind, testCases, onSuccess, onError, examplesList, rowResults, getNote]);

  return {
    generatingRegex,
    regexBackup,
    generateRegex,
  };
}
