// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import React, { useState, useEffect, useCallback, useRef } from 'react';
import EditorPanel, { type CustomLanguage } from '@components/CodeEditor/EditorPanel';
import { useRegexAIGeneration } from '@responseEditor/hooks/useRegexAIGeneration';
import { useRegexValidation } from '@responseEditor/hooks/useRegexValidation';
import { RowResult } from '@responseEditor/hooks/useExtractionTesting';
import DialogueTaskService from '@services/DialogueTaskService';
import {
  renderRegexForEditor,
  normalizeRegexFromEditor,
  type SubDataMapping,
} from '@responseEditor/utils/regexGroupTransform';
import { generateGroupName } from '@responseEditor/utils/regexGroupUtils';
import EditorHeader from '@responseEditor/InlineEditors/shared/EditorHeader';

interface RegexInlineEditorProps {
  regex: string; // contract.regex.value (GUID-based, stored form)
  onClose: () => void;
  onRegexSave?: (regex: string) => void; // Called on close with the GUID-based regex
  node?: any;
  kind?: string;
  examplesList?: string[];
  rowResults?: RowResult[];
  onButtonRender?: (button: React.ReactNode) => void;
  onErrorRender?: (errorMessage: React.ReactNode | null) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Retrieve the SubDataMapping from the template associated with the given
 * templateId.  Returns an empty object when the template or mapping is absent.
 */
function getSubDataMappingFromTemplate(templateId: string | undefined): SubDataMapping {
  if (!templateId) return {};
  const template = DialogueTaskService.getTemplate(templateId);
  return (template?.dataContract?.subDataMapping as SubDataMapping) ?? {};
}

/**
 * Convert a GUID-based (stored) regex to a label-based (display) regex.
 * When the mapping is empty the regex is returned unchanged.
 */
function toDisplayRegex(techRegex: string, mapping: SubDataMapping): string {
  if (!techRegex || Object.keys(mapping).length === 0) return techRegex;
  return renderRegexForEditor(techRegex, mapping);
}

/**
 * Returns the existing SubDataMapping for a template, or — when it is empty
 * and the node has sub-nodes — initialises it from the sub-nodes by assigning
 * a fresh GUID groupName to each sub-node and persisting the result into
 * template.dataContract.subDataMapping.
 *
 * This ensures that the bidirectional Label ↔ GUID transformation in the
 * editor (normalizeRegexFromEditor / renderRegexForEditor) always has a valid
 * mapping to work with, even for brand-new composite templates.
 */
function ensureSubDataMapping(
  templateId: string | undefined,
  subNodes: Array<{ id?: string; templateId?: string; label?: string }> | undefined
): SubDataMapping {
  const existing = getSubDataMappingFromTemplate(templateId);
  if (Object.keys(existing).length > 0 || !templateId || !subNodes?.length) {
    return existing;
  }

  const newMapping: SubDataMapping = {};
  subNodes.forEach((sub) => {
    const nodeKey = (sub as any).id || (sub as any).templateId || '';
    if (!nodeKey) return;
    const label = sub.label || nodeKey;
    if (!label) {
      console.warn('[RegexEditor] Missing label for subNode:', nodeKey);
      return;
    }
    newMapping[nodeKey] = {
      label,
      groupName: generateGroupName(),
      type: 'string',
    };
  });

  if (Object.keys(newMapping).length === 0) return existing;

  const template = DialogueTaskService.getTemplate(templateId);
  if (template) {
    if (!template.dataContract) {
      template.dataContract = {
        templateId,
        templateName: template.label || templateId,
        subDataMapping: {},
        parsers: [],
      };
    }
    template.dataContract.subDataMapping = newMapping;
    DialogueTaskService.markTemplateAsModified(templateId);
    console.log('[RegexEditor] ✅ subDataMapping initialised from subNodes:', newMapping);
  }

  return newMapping;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Monaco-backed regex editor with bidirectional GUID ↔ Label transformation.
 *
 * Contract stored in Redis / template:  (?<g_1a2b3c4d5e6f>...)  (GUID groups)
 * Displayed to the user in the editor:  (?<Giorno>...)           (label groups)
 *
 * Algorithm:
 *   1. Open: load GUID regex → render as label regex → display
 *   2. User edits label regex in the editor
 *   3. Create/Refine: AI receives label regex → returns label regex → update display
 *   4. Close: normalize label regex back to GUID regex → persist to contract
 */
export default function RegexInlineEditor({
  regex,
  onClose,
  onRegexSave,
  node,
  kind,
  examplesList = [],
  rowResults = [],
  onButtonRender,
  onErrorRender,
}: RegexInlineEditorProps) {
  // -----------------------------------------------------------------------
  // SubDataMapping ref — updated whenever the node changes.
  // Auto-initialises GUID group names from sub-nodes when the mapping is
  // missing (first open for a brand-new composite template).
  // -----------------------------------------------------------------------
  const subDataMappingRef = useRef<SubDataMapping>(
    ensureSubDataMapping(node?.templateId, node?.subNodes)
  );

  useEffect(() => {
    subDataMappingRef.current = ensureSubDataMapping(node?.templateId, node?.subNodes);
  }, [node?.templateId]); // eslint-disable-line react-hooks/exhaustive-deps

  // -----------------------------------------------------------------------
  // ALGORITHM: display state uses LABEL-based regex
  // -----------------------------------------------------------------------

  /**
   * Convert the incoming GUID regex to its label-based display form.
   * Called at initialisation and whenever the regex prop truly changes.
   */
  const toLabel = useCallback(
    (guidRegex: string) => toDisplayRegex(guidRegex, subDataMappingRef.current),
    [] // subDataMappingRef is a ref — no dep needed
  );

  const initialDisplay = toLabel(regex || '');

  const [lastTextboxText, setLastTextboxText] = useState(() => initialDisplay);
  const [textboxText, setTextboxText] = useState(() => initialDisplay);

  // ✅ CRITICAL: Use ref to preserve value during cleanup
  const textboxTextRef = useRef<string>(initialDisplay);
  const onRegexSaveRef = useRef<((regex: string) => void) | undefined>(onRegexSave);
  // ✅ CRITICAL: Separate ref that NEVER gets reset (preserves AI-generated value)
  const preservedValueRef = useRef<string>(initialDisplay);
  // ✅ Track previous GUID regex prop to avoid unnecessary updates
  const prevGuidRegexRef = useRef<string>(regex || '');

  // Keep textboxTextRef and preservedValueRef in sync
  useEffect(() => {
    textboxTextRef.current = textboxText;
    if (textboxText && textboxText.trim()) {
      preservedValueRef.current = textboxText;
    }
  }, [textboxText]);

  useEffect(() => {
    onRegexSaveRef.current = onRegexSave;
  }, [onRegexSave]);

  // ✅ Sync when the GUID regex prop changes (e.g. different node selected or editor reopened)
  useEffect(() => {
    const guidRegex = regex || '';

    console.log('[RegexInlineEditor] 🔄 Regex prop changed', {
      newGuidRegex: guidRegex || '(empty)',
      previousGuidRegex: prevGuidRegexRef.current || '(empty)',
      isSame: guidRegex === prevGuidRegexRef.current,
      nodeId: node?.id,
      templateId: node?.templateId
    });

    if (guidRegex === prevGuidRegexRef.current) {
      return;
    }

    prevGuidRegexRef.current = guidRegex;

    // Re-fetch (or re-initialise) mapping in case the node changed simultaneously
    subDataMappingRef.current = ensureSubDataMapping(node?.templateId, node?.subNodes);

    const labelRegex = toLabel(guidRegex);
    console.log('[RegexInlineEditor] ✅ Converted to label regex', {
      guidRegex: guidRegex || '(empty)',
      labelRegex: labelRegex || '(empty)',
      mappingKeys: Object.keys(subDataMappingRef.current).length
    });

    setLastTextboxText(labelRegex);
    setTextboxText(labelRegex);
    textboxTextRef.current = labelRegex;
    if (labelRegex && labelRegex.trim()) {
      preservedValueRef.current = labelRegex;
    }
  }, [regex, node?.templateId, toLabel, node?.id]);

  // -----------------------------------------------------------------------
  // Validation error display
  // -----------------------------------------------------------------------

  const [validationError, setValidationError] = useState<string | null>(null);

  // -----------------------------------------------------------------------
  // Show/hide AI button
  // -----------------------------------------------------------------------

  const shouldShowButton = textboxText !== lastTextboxText || !!validationError;
  const buttonCaption = lastTextboxText.trim() === '' ? 'Create Regex' : 'Refine Regex';
  const isCreateMode = lastTextboxText.trim() === '';

  // -----------------------------------------------------------------------
  // AI generation
  // -----------------------------------------------------------------------

  const aiPromiseRef = useRef<{ resolve: (v: string) => void; reject: (e: Error) => void } | null>(null);
  const { generatingRegex, generateRegex } = useRegexAIGeneration({
    node,
    kind,
    testCases: [],
    examplesList,
    rowResults,
    onSuccess: (newRegex: string) => {
      console.log('[RegexEditor] AI onSuccess:', newRegex);
      if (aiPromiseRef.current) {
        aiPromiseRef.current.resolve(newRegex);
        aiPromiseRef.current = null;
      } else {
        console.warn('[RegexEditor] onSuccess called but promise ref is null');
      }
    },
    onError: (error: Error) => {
      if (aiPromiseRef.current) {
        aiPromiseRef.current.reject(error);
        aiPromiseRef.current = null;
      }
      alert(`Error generating regex: ${error.message}`);
    },
  });

  // -----------------------------------------------------------------------
  // Validation: groups count and normalization errors
  // -----------------------------------------------------------------------

  // Use existing useRegexValidation hook to validate groups count
  // Must be called after generatingRegex is defined
  const { validationResult, shouldShowValidation } = useRegexValidation({
    regex: textboxText, // Use label-based regex (what user sees)
    node,
    shouldValidateOnChange: true,
    shouldValidateOnAIFinish: true,
    generatingRegex,
  });

  // Also validate normalization (groups must be recognized labels)
  useEffect(() => {
    if (!textboxText || textboxText.trim() === '' || textboxText === lastTextboxText) {
      setValidationError(null);
      return;
    }

    // Debounce normalization validation
    const timeoutId = setTimeout(() => {
      try {
        normalizeRegexFromEditor(textboxText, subDataMappingRef.current);
        setValidationError(null);
      } catch (normError) {
        const errorMessage = normError instanceof Error ? normError.message : String(normError);
        setValidationError(errorMessage);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [textboxText, lastTextboxText]);

  // The AI sees and works with label-based regex (what is shown in the editor).
  // The AI is expected to preserve the label group names in its output.
  const handleAIClick = useCallback(async () => {
    if (!textboxText.trim()) return;

    console.log('[RegexEditor] AI button clicked, current display regex:', textboxText);

    try {
      const result = await new Promise<string>((resolve, reject) => {
        aiPromiseRef.current = { resolve, reject };
        generateRegex(textboxText, null).catch((err) => {
          console.error('[RegexEditor] generateRegex error:', err);
          reject(err);
        });
      });

      console.log('[RegexEditor] AI generation result (label regex):', result);

      // Update both states so the "dirty" button disappears
      setLastTextboxText(result);
      setTextboxText(result);
      textboxTextRef.current = result;
      preservedValueRef.current = result;
    } catch (e) {
      console.error('[RegexEditor] AI generation failed:', e);
    }
  }, [textboxText, generateRegex]);

  // -----------------------------------------------------------------------
  // Save immediately to template when user types
  // Saves directly to template.dataContract (not just on close)
  // -----------------------------------------------------------------------
  const saveToTemplate = useCallback((displayValue: string) => {
    if (!displayValue || !displayValue.trim() || !node?.templateId) {
      return;
    }

    // ✅ Normalize: convert label regex → GUID regex
    let techValue: string;
    try {
      techValue = normalizeRegexFromEditor(displayValue, subDataMappingRef.current);
    } catch (normError) {
      // The user has typed an unrecognized group name — do NOT corrupt the contract.
      console.error('[RegexEditor] Cannot save: normalization failed.', (normError as Error).message);
      return;
    }

    const template = DialogueTaskService.getTemplate(node.templateId);
    if (!template) {
      console.warn('[RegexEditor] Template not found:', node.templateId);
      return;
    }

    if (!template.dataContract) {
      template.dataContract = { parsers: [] };
    }

    const regexContract = template.dataContract.parsers?.find((c: any) => c.type === 'regex');
    if (regexContract) {
      regexContract.patterns = [techValue];
    } else {
      if (!template.dataContract.parsers) {
        template.dataContract.parsers = [];
      }
      template.dataContract.parsers.push({ type: 'regex', patterns: [techValue] });
    }

    DialogueTaskService.markTemplateAsModified(node.templateId);

    // Also notify the parent component to update contract
    const currentOnSave = onRegexSaveRef.current;
    if (currentOnSave) {
      try {
        currentOnSave(techValue);
      } catch (cbError) {
        console.error('[RegexEditor] Error in onRegexSave callback:', cbError);
      }
    }
  }, [node?.templateId]);

  // ✅ Save immediately when textboxText changes (debounced to avoid too many saves)
  useEffect(() => {
    if (!textboxText || textboxText.trim() === '' || textboxText === lastTextboxText) {
      return;
    }

    // Debounce: save after 500ms of no typing
    const timeoutId = setTimeout(() => {
      saveToTemplate(textboxText);
      // Update lastTextboxText after save to track that it's been saved
      setLastTextboxText(textboxText);
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [textboxText, lastTextboxText, saveToTemplate]);

  // -----------------------------------------------------------------------
  // Save on close (backup - in case debounce didn't fire)
  // -----------------------------------------------------------------------
  useEffect(() => {
    return () => {
      const displayValue = preservedValueRef.current || textboxTextRef.current;
      if (displayValue && displayValue.trim() && node?.templateId) {
        saveToTemplate(displayValue);
      }
    };
  }, [node?.templateId, saveToTemplate]); // eslint-disable-line react-hooks/exhaustive-deps

  // -----------------------------------------------------------------------
  // Backward compatibility: Support onButtonRender and onErrorRender callbacks
  // (but EditorHeader is the primary UI)
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (onErrorRender) {
      if (validationError) {
        onErrorRender(
          <span style={{ color: '#ef4444', fontSize: '12px' }}>{validationError}</span>
        );
      } else {
        onErrorRender(null);
      }
    }
  }, [validationError, onErrorRender]);

  // -----------------------------------------------------------------------
  // Build validation badge showing groups status
  // -----------------------------------------------------------------------

  const validationBadge = React.useMemo(() => {
    // Priority 1: Show normalization error (groups not recognized)
    if (validationError) {
      return (
        <span style={{ color: '#ef4444', fontSize: '12px', display: 'flex', alignItems: 'center', gap: 4 }}>
          <span>⚠️</span>
          <span>{validationError}</span>
        </span>
      );
    }

    // Priority 2: Show groups validation status
    if (validationResult && shouldShowValidation && validationResult.groupsExpected > 0) {
      const isComplete = validationResult.groupsFound === validationResult.groupsExpected && validationResult.valid;
      const hasMissingGroups = validationResult.groupsFound < validationResult.groupsExpected;

      if (isComplete) {
        // All groups present
        return (
          <span style={{
            color: '#10b981',
            fontSize: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontWeight: 500
          }}>
            <span>✓</span>
            <span>Tutto ok</span>
          </span>
        );
      } else if (hasMissingGroups) {
        // Missing groups
        return (
          <span style={{
            color: '#ef4444',
            fontSize: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontWeight: 500
          }}>
            <span>⚠</span>
            <span>Mancano gruppi ({validationResult.groupsFound}/{validationResult.groupsExpected})</span>
          </span>
        );
      } else {
        // Warning (extra groups or other issues)
        return (
          <span style={{
            color: '#f59e0b',
            fontSize: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontWeight: 500
          }}>
            <span>⚠</span>
            <span>{validationResult.groupsFound}/{validationResult.groupsExpected} groups</span>
          </span>
        );
      }
    }

    return undefined;
  }, [validationError, validationResult, shouldShowValidation]);

  // Combine validation errors
  const errorMessage = validationError || (validationResult && !validationResult.valid && validationResult.errors.length > 0
    ? validationResult.errors[0]
    : undefined);

  // -----------------------------------------------------------------------
  // Editor value — shows label-based regex or placeholder
  // -----------------------------------------------------------------------

  const PLACEHOLDER_TEXT = "Write the regular expression you need";
  const editorRef = useRef<any>(null);

  const editorValue = React.useMemo(() => {
    // ✅ CRITICAL FIX: Don't show placeholder if we have a value (even if empty string from template)
    const displayValue = textboxText || preservedValueRef.current;

    // If we have a display value, use it
    if (displayValue && displayValue.trim()) {
      return displayValue;
    }

    // If regex prop exists (even if empty), it means contract was loaded
    // Don't show placeholder - show empty string so user can type
    if (regex !== undefined && regex !== null) {
      return '';
    }

    // Only show placeholder if we truly have no contract loaded
    return PLACEHOLDER_TEXT;
  }, [textboxText, regex]);

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div
      style={{
        padding: 8,
        background: '#f9fafb',
        animation: 'fadeIn 0.2s ease-in',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        width: '100%',
        maxWidth: '100%',
        overflow: 'hidden',
        height: '100%',
      }}
    >
      <EditorHeader
        title="Regex (Regex)"
        extractorType="regex"
        isCreateMode={isCreateMode}
        isGenerating={generatingRegex}
        shouldShowButton={shouldShowButton}
        onButtonClick={handleAIClick}
        onClose={onClose}
        validationBadge={validationBadge}
        errorMessage={errorMessage}
        buttonCaption={buttonCaption}
      />

      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <EditorPanel
          ref={editorRef}
          code={editorValue}
          language="regex"
          customLanguage={{ id: 'regex', tokenizer: { root: [] } } as CustomLanguage}
          onChange={(value) => {
            if (value && value !== PLACEHOLDER_TEXT) {
              setTextboxText(value);
              // Don't clear validationError here - let debounced validation handle it
            }
          }}
          useTemplate={false}
        />
      </div>
    </div>
  );
}
