import { useState, useCallback } from 'react';
import { ValidationResult } from './useRegexValidation';

interface UseRegexAIGenerationOptions {
  node?: any;
  kind?: string;
  testCases?: string[];
  onSuccess?: (newRegex: string) => void;
  onError?: (error: Error) => void;
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
}: UseRegexAIGenerationOptions) {
  const [generatingRegex, setGeneratingRegex] = useState(false);
  const [regexBackup, setRegexBackup] = useState('');

  const generateRegex = useCallback(async (
    currentRegex: string,
    validationResult: ValidationResult | null
  ) => {
    let prompt = currentRegex || '';

    // ✅ Find test cases that don't match the current regex
    const unmatchedTestCases: string[] = [];
    if (currentRegex && currentRegex.trim() && testCases.length > 0) {
      try {
        const regexObj = new RegExp(currentRegex, 'g');
        testCases.forEach((testCase) => {
          const match = testCase.match(regexObj);
          if (!match) {
            unmatchedTestCases.push(testCase);
          }
        });
      } catch (e) {
        // Invalid regex - will be handled by validation errors
      }
    }

    // ✅ If regex is invalid, include validation errors in the prompt
    if (validationResult && !validationResult.valid && validationResult.errors.length > 0) {
      const errorsText = validationResult.errors.join('. ');
      const warningsText = validationResult.warnings.length > 0 ? ' Warnings: ' + validationResult.warnings.join('. ') : '';
      prompt = `Current regex: ${currentRegex}\n\nErrors found: ${errorsText}${warningsText}\n\nPlease fix the regex to include the correct capture groups. Expected ${validationResult.groupsExpected} capture groups for: ${(() => {
        const allSubs = [...((node?.subSlots || [])), ...(node?.subData || [])];
        return allSubs.map((s: any) => s.label || s.name || 'sub-data').join(', ');
      })()}`;

      // ✅ Add unmatched test cases to the prompt
      if (unmatchedTestCases.length > 0) {
        prompt += `\n\nIMPORTANT: The following test values should be matched by the regex but are currently NOT matching:\n${unmatchedTestCases.map(tc => `- "${tc}"`).join('\n')}\n\nPlease fix the regex so it matches all these values.`;
      }

      console.log('[AI Regex] 🔵 Refine Regex clicked with validation errors, enhancing prompt');
      if (unmatchedTestCases.length > 0) {
        console.log('[AI Regex] 🔵 Including unmatched test cases in prompt:', unmatchedTestCases);
      }
    } else if (unmatchedTestCases.length > 0) {
      // ✅ If regex is valid but has unmatched test cases, enhance the prompt
      const allSubs = [...((node?.subSlots || [])), ...(node?.subData || [])];
      const subLabels = allSubs.length > 0
        ? allSubs.map((s: any) => s.label || s.name || 'sub-data').join(', ')
        : 'the sub-data components';

      prompt = `Current regex: ${currentRegex}\n\nThe following test values should be matched by the regex but are currently NOT matching:\n${unmatchedTestCases.map(tc => `- "${tc}"`).join('\n')}\n\nPlease refine the regex so it matches all these values while maintaining the existing capture groups for: ${subLabels}`;
      console.log('[AI Regex] 🔵 Refine Regex clicked with unmatched test cases:', unmatchedTestCases);
    }

    if (!prompt.trim() || prompt.trim().length < 5) {
      console.log('[AI Regex] ❌ Prompt too short, cannot generate');
      return;
    }

    console.log('[AI Regex] 🔵 Starting generation with prompt:', prompt);
    console.log('[AI Regex] 🔵 Unmatched test cases count:', unmatchedTestCases.length);

    // Save backup
    setRegexBackup(currentRegex);

    // Start generation
    setGeneratingRegex(true);

    try {
      // Extract sub-data from node if available
      const subData = (node?.subData || node?.subSlots || []) as any[];
      const subDataInfo = subData.map((sub: any, index: number) => ({
        id: sub.id || `sub-${index}`,
        label: sub.label || sub.name || '',
        index: index + 1 // Position in capture groups (1, 2, 3...)
      }));

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

      const requestBody = {
        description: prompt,
        subData: subDataInfo.length > 0 ? subDataInfo : undefined,
        kind: kind || undefined,
        provider,
        model
      };

      console.log('[AI Regex] 🟢 Calling API /api/nlp/generate-regex');
      console.log('[AI Regex] 🟢 Request body:', JSON.stringify(requestBody, null, 2));

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
  }, [node, kind, testCases, onSuccess, onError]);

  return {
    generatingRegex,
    regexBackup,
    generateRegex,
  };
}
