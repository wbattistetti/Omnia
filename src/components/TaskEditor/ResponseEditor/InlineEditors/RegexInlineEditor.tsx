// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import React, { useState, useEffect, useCallback, useRef } from 'react';
import EditorPanel, { type CustomLanguage } from '@components/CodeEditor/EditorPanel';
import { useRegexAIGeneration } from '@responseEditor/hooks/useRegexAIGeneration';
import { RowResult } from '@responseEditor/hooks/useExtractionTesting';
import DialogueTaskService from '@services/DialogueTaskService';

interface RegexInlineEditorProps {
  regex: string; // contract.regex.value
  onClose: () => void;
  onRegexSave?: (regex: string) => void; // Salva quando chiudi
  node?: any;
  kind?: string;
  examplesList?: string[];
  rowResults?: RowResult[];
  onButtonRender?: (button: React.ReactNode) => void;
  onErrorRender?: (errorMessage: React.ReactNode | null) => void;
}

/**
 * Simplified regex editor implementing the user's algorithm:
 * 1. Apro l'editor: lastTextboxText = contract.regex.value, textboxText = contract.regex.value
 * 2. Quando textboxText cambia: se diverso da lastTextboxText -> appare pulsante
 * 3. Se clicco Create/Refine: AI genera, PRIMA lastTextboxText = risultato, POI textboxText = risultato
 * 4. Pulsanti spariscono perché lastTextboxText == textboxText
 * 5. Se chiudo: contract.regex = textboxText
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
  // ========== ALGORITMO UTENTE: START ==========
  // ✅ Inizializza solo una volta con il valore iniziale
  const [lastTextboxText, setLastTextboxText] = useState(() => regex || '');
  const [textboxText, setTextboxText] = useState(() => regex || '');

  // ✅ CRITICAL: Use ref to preserve value during cleanup (prevents loss when component re-renders)
  const textboxTextRef = useRef<string>(regex || '');
  const onRegexSaveRef = useRef<((regex: string) => void) | undefined>(onRegexSave);
  // ✅ CRITICAL: Separate ref that NEVER gets reset (preserves AI-generated value even when regex prop becomes empty)
  const preservedValueRef = useRef<string>(regex || '');
  // ✅ Track previous regex prop to avoid unnecessary updates
  const prevRegexRef = useRef<string>(regex || '');

  // Keep refs in sync (senza log eccessivi)
  useEffect(() => {
    textboxTextRef.current = textboxText;
    // ✅ Always update preservedValueRef when textboxText changes (but never reset it to empty)
    if (textboxText && textboxText.trim()) {
      preservedValueRef.current = textboxText;
    }
  }, [textboxText]);

  useEffect(() => {
    onRegexSaveRef.current = onRegexSave;
  }, [onRegexSave]);

  // ✅ Sync quando cambia nodo (contract.regex.value cambia) - solo se realmente cambiato
  useEffect(() => {
    const currentRegex = regex || '';
    // ✅ Evita aggiornamenti inutili se il valore non è cambiato
    if (currentRegex === prevRegexRef.current) {
      return;
    }

    prevRegexRef.current = currentRegex;
    setLastTextboxText(currentRegex);
    setTextboxText(currentRegex);
    textboxTextRef.current = currentRegex;
    // ✅ Only update preservedValueRef if newValue is not empty (don't reset it)
    if (currentRegex && currentRegex.trim()) {
      preservedValueRef.current = currentRegex;
    }
  }, [regex]);

  // Pulsante appare se diversi
  const showButton = textboxText !== lastTextboxText;
  const buttonCaption = lastTextboxText.trim() === '' ? 'Create Regex' : 'Refine Regex';
  // ========== ALGORITMO UTENTE: END ==========

  // AI wrapper
  const aiPromiseRef = useRef<{ resolve: (v: string) => void; reject: (e: Error) => void } | null>(null);
  const { generatingRegex, generateRegex } = useRegexAIGeneration({
    node,
    kind,
    testCases: [],
    examplesList,
    rowResults,
    onSuccess: (newRegex: string) => {
      console.log('[RegexEditor] 🟢 onSuccess called with regex:', newRegex);
      console.log('[RegexEditor] aiPromiseRef.current:', aiPromiseRef.current);
      if (aiPromiseRef.current) {
        console.log('[RegexEditor] Resolving Promise with regex:', newRegex);
        aiPromiseRef.current.resolve(newRegex);
        aiPromiseRef.current = null;
      } else {
        console.warn('[RegexEditor] ⚠️ onSuccess called but aiPromiseRef.current is null!');
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

  // Click su Create/Refine
  const handleAIClick = useCallback(async () => {
    if (!textboxText.trim()) return;

    console.log('[RegexEditor] 🔵 AI button clicked, starting generation...');
    console.log('[RegexEditor] Current textboxText:', textboxText);

    try {
      const result = await new Promise<string>((resolve, reject) => {
        console.log('[RegexEditor] Creating Promise wrapper...');
        aiPromiseRef.current = { resolve, reject };
        console.log('[RegexEditor] Calling generateRegex...');
        generateRegex(textboxText, null).catch((err) => {
          console.error('[RegexEditor] generateRegex threw error:', err);
          reject(err);
        });
      });

      console.log('[RegexEditor] ✅ AI generation completed, result:', result);
      console.log('[RegexEditor] Updating state: lastTextboxText and textboxText');

      // ✅ ORDINE CORRETTO: PRIMA lastTextboxText, POI textboxText
      setLastTextboxText(result);
      setTextboxText(result);
      textboxTextRef.current = result; // ✅ Update ref too
      preservedValueRef.current = result; // ✅ CRITICAL: Preserve AI-generated value in separate ref

      // ❌ RIMOSSO: salvataggio immediato - salva SOLO alla chiusura dell'editor

      console.log('[RegexEditor] ✅ State updated, button should disappear');
      // Pulsanti spariscono perché lastTextboxText == textboxText
    } catch (e) {
      console.error('[RegexEditor] ❌ AI generation failed:', e);
    }
  }, [textboxText, generateRegex]);

  // ✅ Salva textboxText direttamente nel contract del nodo quando chiudi l'editor
  // Usa node.templateId per accedere al template e salvare nel contract
  useEffect(() => {
    return () => {
      // ✅ CRITICAL: Use preservedValueRef first (never reset), fallback to textboxTextRef
      const currentValue = preservedValueRef.current || textboxTextRef.current;

      console.log('[RegexEditor] 🚪 Editor closing (cleanup)');
      console.log('[RegexEditor] preservedValueRef.current:', preservedValueRef.current);
      console.log('[RegexEditor] textboxTextRef.current:', textboxTextRef.current);
      console.log('[RegexEditor] currentValue (to save):', currentValue);
      console.log('[RegexEditor] node.templateId:', node?.templateId);

      // ✅ Salva direttamente nel contract del nodo usando templateId
      if (currentValue && currentValue.trim() && node?.templateId) {
        const template = DialogueTaskService.getTemplate(node.templateId);
        if (template) {
          console.log('[RegexEditor] 💾 Saving regex directly to template:', node.templateId);

          // Crea o aggiorna dataContract
          if (!template.dataContract) {
            template.dataContract = { contracts: [] };
          }

          // Trova o crea il contract regex
          const regexContract = template.dataContract.contracts?.find((c: any) => c.type === 'regex');
          if (regexContract) {
            regexContract.patterns = [currentValue];
            console.log('[RegexEditor] ✅ Updated existing regex contract');
          } else {
            if (!template.dataContract.contracts) {
              template.dataContract.contracts = [];
            }
            template.dataContract.contracts.push({
              type: 'regex',
              patterns: [currentValue]
            });
            console.log('[RegexEditor] ✅ Created new regex contract');
          }

          // Marca template come modificato (per salvataggio futuro quando salvi il progetto)
          DialogueTaskService.markTemplateAsModified(node.templateId);
          console.log('[RegexEditor] ✅ Template marked as modified');

          // ✅ Fallback: chiama anche onRegexSave se disponibile (per sincronizzare RecognitionEditor)
          const currentOnSave = onRegexSaveRef.current;
          if (currentOnSave) {
            try {
              currentOnSave(currentValue);
              console.log('[RegexEditor] ✅ Also called onRegexSave callback');
            } catch (error) {
              console.error('[RegexEditor] ⚠️ Error calling onRegexSave callback:', error);
            }
          }
        } else {
          console.warn('[RegexEditor] ⚠️ Template not found:', node.templateId);
        }
      } else {
        if (!currentValue || !currentValue.trim()) {
          console.warn('[RegexEditor] ⚠️ No value to save');
        }
        if (!node?.templateId) {
          console.warn('[RegexEditor] ⚠️ No node.templateId available');
        }
      }
    };
  }, [node?.templateId]); // ✅ Dipende solo da node.templateId

  // Render button
  useEffect(() => {
    if (onButtonRender) {
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
        onButtonRender(null); // Nascondi pulsante
      }
    }
  }, [onButtonRender, showButton, handleAIClick, buttonCaption, generatingRegex]);

  const PLACEHOLDER_TEXT = "scrivi l'espressione regolare che ti serve";
  const editorRef = useRef<any>(null);

  // ✅ Memoize editor value per evitare re-render inutili
  // ✅ Mostra placeholder solo se textboxText è vuoto E non c'è un valore preservato
  const editorValue = React.useMemo(() => {
    // Se c'è un valore (anche vuoto ma non undefined), usalo
    // Altrimenti mostra placeholder solo se non c'è nulla
    return textboxText || (preservedValueRef.current || PLACEHOLDER_TEXT);
  }, [textboxText]);

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
          }
        }}
        useTemplate={false}
      />
    </div>
  );
}
