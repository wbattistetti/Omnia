// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import React, { useState, useEffect, useCallback, useRef } from 'react';
import EditorPanel, { type CustomLanguage } from '@components/CodeEditor/EditorPanel';
import { useRegexAIGeneration } from '@responseEditor/hooks/useRegexAIGeneration';
import { RowResult } from '@responseEditor/hooks/useExtractionTesting';
import DialogueTaskService from '@services/DialogueTaskService';
import {
  renderRegexForEditor,
  normalizeRegexFromEditor,
  type SubDataMapping,
} from '@responseEditor/utils/regexGroupTransform';
import { generateGroupName } from '@responseEditor/utils/regexGroupUtils';

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
    newMapping[nodeKey] = {
      canonicalKey: label.toLowerCase().replace(/\s+/g, '_'),
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
        contracts: [],
      };
    }
    template.dataContract.subDataMapping = newMapping;

    // ✅ CRITICAL: Also rewrite the stored regex so it uses GUIDs instead of
    // semantic names.  When the AI generates the composite regex it uses
    // canonicalKey as the group name (e.g. (?<giorno>...)).  We must replace
    // each (?<canonicalKey>...) with (?<groupNameGuid>...) so that the stored
    // contract is already in GUID form before the editor even opens.
    const regexContract = template.dataContract.contracts?.find(
      (c: any) => c.type === 'regex'
    );
    if (regexContract?.patterns?.length > 0) {
      let rewritten: string = regexContract.patterns[0];
      Object.values(newMapping).forEach((entry) => {
        const semantic = entry.canonicalKey; // e.g. "giorno"
        const guid = entry.groupName;        // e.g. "g_1a2b3c4d5e6f"
        rewritten = rewritten.replace(
          new RegExp(`\\(\\?<${semantic}>`, 'gi'),
          `(?<${guid}>`
        );
      });
      regexContract.patterns[0] = rewritten;
      console.log('[RegexEditor] ✅ Regex rewritten to GUID groups:', rewritten);
    }

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

  // ✅ Sync when the GUID regex prop changes (e.g. different node selected)
  useEffect(() => {
    const guidRegex = regex || '';
    if (guidRegex === prevGuidRegexRef.current) {
      return;
    }

    prevGuidRegexRef.current = guidRegex;

    // Re-fetch (or re-initialise) mapping in case the node changed simultaneously
    subDataMappingRef.current = ensureSubDataMapping(node?.templateId, node?.subNodes);

    const labelRegex = toLabel(guidRegex);
    setLastTextboxText(labelRegex);
    setTextboxText(labelRegex);
    textboxTextRef.current = labelRegex;
    if (labelRegex && labelRegex.trim()) {
      preservedValueRef.current = labelRegex;
    }
  }, [regex, node?.templateId, toLabel]);

  // -----------------------------------------------------------------------
  // Validation error display
  // -----------------------------------------------------------------------

  const [validationError, setValidationError] = useState<string | null>(null);

  // Propagate validation errors upward via onErrorRender
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
  // Show/hide AI button
  // -----------------------------------------------------------------------

  const showButton = textboxText !== lastTextboxText;
  const buttonCaption = lastTextboxText.trim() === '' ? 'Create Regex' : 'Refine Regex';

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
  // Save on close
  // Normalizes the label-based display regex back to GUID-based tech regex
  // before persisting to the template / calling onRegexSave.
  // -----------------------------------------------------------------------
  useEffect(() => {
    return () => {
      // Use the "never-reset" preserved ref as source of truth
      const displayValue = preservedValueRef.current || textboxTextRef.current;

      console.log('[RegexEditor] Editor closing — display value:', displayValue);
      console.log('[RegexEditor] node.templateId:', node?.templateId);

      if (!displayValue || !displayValue.trim() || !node?.templateId) {
        if (!displayValue?.trim()) {
          console.warn('[RegexEditor] No value to save.');
        }
        if (!node?.templateId) {
          console.warn('[RegexEditor] No node.templateId available.');
        }
        return;
      }

      // ✅ Normalize: convert label regex → GUID regex
      let techValue: string;
      try {
        techValue = normalizeRegexFromEditor(displayValue, subDataMappingRef.current);
        console.log('[RegexEditor] Normalized to GUID regex:', techValue);
      } catch (normError) {
        // The user has typed an unrecognized group name — do NOT corrupt the contract.
        console.error(
          '[RegexEditor] Cannot save: normalization failed.',
          (normError as Error).message
        );
        return;
      }

      const template = DialogueTaskService.getTemplate(node.templateId);
      if (!template) {
        console.warn('[RegexEditor] Template not found:', node.templateId);
        return;
      }

      console.log('[RegexEditor] Saving GUID regex to template:', node.templateId);

      if (!template.dataContract) {
        template.dataContract = { contracts: [] };
      }

      const regexContract = template.dataContract.contracts?.find((c: any) => c.type === 'regex');
      if (regexContract) {
        regexContract.patterns = [techValue];
        console.log('[RegexEditor] Updated existing regex contract.');
      } else {
        if (!template.dataContract.contracts) {
          template.dataContract.contracts = [];
        }
        template.dataContract.contracts.push({ type: 'regex', patterns: [techValue] });
        console.log('[RegexEditor] Created new regex contract.');
      }

      DialogueTaskService.markTemplateAsModified(node.templateId);
      console.log('[RegexEditor] Template marked as modified.');

      // Also notify the parent component
      const currentOnSave = onRegexSaveRef.current;
      if (currentOnSave) {
        try {
          currentOnSave(techValue);
          console.log('[RegexEditor] onRegexSave callback called.');
        } catch (cbError) {
          console.error('[RegexEditor] Error in onRegexSave callback:', cbError);
        }
      }
    };
  }, [node?.templateId]); // eslint-disable-line react-hooks/exhaustive-deps

  // -----------------------------------------------------------------------
  // Render AI button
  // -----------------------------------------------------------------------

  useEffect(() => {
    if (!onButtonRender) return;
    if (showButton) {
      onButtonRender(
        <button
          type="button"
          onClick={handleAIClick}
          disabled={generatingRegex}
          style={{
            padding: '6px 12px',
            backgroundColor: generatingRegex ? '#9ca3af' : '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: generatingRegex ? 'not-allowed' : 'pointer',
            fontSize: '13px',
            fontWeight: 500,
          }}
        >
          {generatingRegex ? 'Generating...' : buttonCaption}
        </button>
      );
    } else {
      onButtonRender(null);
    }
  }, [onButtonRender, showButton, handleAIClick, buttonCaption, generatingRegex]);

  // -----------------------------------------------------------------------
  // Editor value — shows label-based regex or placeholder
  // -----------------------------------------------------------------------

  const PLACEHOLDER_TEXT = "Write the regular expression you need";
  const editorRef = useRef<any>(null);

  const editorValue = React.useMemo(() => {
    return textboxText || preservedValueRef.current || PLACEHOLDER_TEXT;
  }, [textboxText]);

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <EditorPanel
        ref={editorRef}
        code={editorValue}
        language="regex"
        customLanguage={{ id: 'regex', tokenizer: { root: [] } } as CustomLanguage}
        onChange={(value) => {
          if (value && value !== PLACEHOLDER_TEXT) {
            setTextboxText(value);
            // Clear any previous normalization error as user is still editing
            setValidationError(null);
          }
        }}
        useTemplate={false}
      />
    </div>
  );
}
