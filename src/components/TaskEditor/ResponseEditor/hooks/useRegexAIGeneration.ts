import { useState, useCallback } from 'react';
import { ValidationResult } from './useRegexValidation';
import { RowResult } from './useExtractionTesting';
import { useNotesStore, getCellKeyFromPhrase } from '../stores/notesStore';

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
    currentRegex: string,
    validationResult: ValidationResult | null
  ) => {
    let prompt = currentRegex || '';

    // ✅ Collect feedback items from notes
    const feedbackItems: FeedbackItem[] = [];
    if (examplesList && rowResults && examplesList.length > 0) {
      examplesList.forEach((phrase, index) => {
        // ✅ Use phrase-based key (stable, not index-based)
        const note = getNote(getCellKeyFromPhrase(phrase, 'regex'));
        if (note && note.trim()) {
          const result = rowResults[index];
          // Extract value from result - rowResults[index].regex contains the summary (e.g., "value=1" or "day=12, month=3")
          // For feedback, we use the summary as-is since it represents what was actually extracted
          let extractedValue = '—';
          if (result?.regex) {
            extractedValue = result.regex; // This is the summary, e.g., "value=1" or "day=12, month=3"
          }

          feedbackItems.push({
            testPhrase: phrase,
            extractedValue: extractedValue || '—',
            userNote: note.trim(),
            groupKey: '0', // Default groupKey, can be extended in future
          });
        }
      });
    }

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

    // ✅ Build prompt with feedback items if available
    const hasFeedback = feedbackItems.length > 0;
    const hasValidationErrors = validationResult && !validationResult.valid && validationResult.errors.length > 0;
    const hasUnmatchedTestCases = unmatchedTestCases.length > 0;

    // ✅ If regex is invalid, include validation errors in the prompt
    if (hasValidationErrors) {
      const errorsText = validationResult!.errors.join('. ');
      const warningsText = validationResult!.warnings.length > 0 ? ' Warnings: ' + validationResult!.warnings.join('. ') : '';
      prompt = `Current regex: ${currentRegex}\n\nErrors found: ${errorsText}${warningsText}\n\nPlease fix the regex to include the correct capture groups. Expected ${validationResult!.groupsExpected} capture groups for: ${(() => {
        const allSubs = [...((node?.subSlots || [])), ...(node?.subData || [])];
        return allSubs.map((s: any) => s.label || s.name || 'sub-data').join(', ');
      })()}`;

      // ✅ Add feedback items to the prompt (priority over unmatched test cases)
      if (hasFeedback) {
        const feedbackText = feedbackItems.map((fb, idx) => {
          return `${idx + 1}. Test phrase: "${fb.testPhrase}"\n   Current extraction: "${fb.extractedValue}"\n   User feedback: "${fb.userNote}"`;
        }).join('\n\n');
        prompt += `\n\nUser feedback from test results:\n${feedbackText}\n\nPlease refine the regex to address all the user feedback above.`;
        console.log('[AI Regex] 🔵 Including user feedback in prompt:', feedbackItems.length, 'items');
      } else if (hasUnmatchedTestCases) {
        // ✅ Add unmatched test cases to the prompt (only if no feedback)
        prompt += `\n\nIMPORTANT: The following test values should be matched by the regex but are currently NOT matching:\n${unmatchedTestCases.map(tc => `- "${tc}"`).join('\n')}\n\nPlease fix the regex so it matches all these values.`;
      }

      console.log('[AI Regex] 🔵 Refine Regex clicked with validation errors, enhancing prompt');
    } else if (hasFeedback) {
      // ✅ If regex is valid but has feedback items, use them for refinement
      const allSubs = [...((node?.subSlots || [])), ...(node?.subData || [])];
      const subLabels = allSubs.length > 0
        ? allSubs.map((s: any) => s.label || s.name || 'sub-data').join(', ')
        : 'the sub-data components';

      const feedbackText = feedbackItems.map((fb, idx) => {
        return `${idx + 1}. Test phrase: "${fb.testPhrase}"\n   Current extraction: "${fb.extractedValue}"\n   User feedback: "${fb.userNote}"`;
      }).join('\n\n');

      prompt = `Current regex: ${currentRegex}\n\nUser feedback from test results:\n${feedbackText}\n\nPlease refine the regex to address all the user feedback above while maintaining the existing capture groups for: ${subLabels}`;
      console.log('[AI Regex] 🔵 Refine Regex clicked with user feedback:', feedbackItems.length, 'items');
    } else if (hasUnmatchedTestCases) {
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

      const requestBody: any = {
        description: prompt,
        subData: subDataInfo.length > 0 ? subDataInfo : undefined,
        kind: kind || undefined,
        provider,
        model
      };

      // ✅ Include feedback items in request body if available
      if (feedbackItems.length > 0) {
        requestBody.feedback = feedbackItems.map(fb => ({
          testPhrase: fb.testPhrase,
          extractedValue: fb.extractedValue,
          userNote: fb.userNote,
          groupKey: fb.groupKey,
        }));
        console.log('[AI Regex] 🟢 Including feedback items in request:', feedbackItems.length);
      }

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
  }, [node, kind, testCases, onSuccess, onError, examplesList, rowResults, getNote]);

  return {
    generatingRegex,
    regexBackup,
    generateRegex,
  };
}
