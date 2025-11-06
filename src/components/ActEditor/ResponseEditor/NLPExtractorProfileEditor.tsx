import React from 'react';
import { Wand2, MessageCircle } from 'lucide-react';
import { instanceRepository } from '../../../services/InstanceRepository';
import type { ProblemIntent } from '../../../types/project';
import RegexEditor from './RegexEditor';
import NLPCompactEditor from './NLPCompactEditor';
import PostProcessEditor from './PostProcessEditor';
import { Calendar, Mail, Phone, Hash, Globe, MapPin, User, FileText, CreditCard, CarFront as Car, Badge, Landmark, Type as TypeIcon, ChevronDown } from 'lucide-react';

// 🎯 Custom Hooks
import { useNotes } from './hooks/useNotes';
import { useEditorState } from './hooks/useEditorState';
import { useProfileState } from './hooks/useProfileState';
import { useExtractionTesting } from './hooks/useExtractionTesting';

// 🎨 Config Components
import KindSelector from './Config/KindSelector';
import ConfidenceInput from './Config/ConfidenceInput';
import WaitingMessagesConfig from './Config/WaitingMessagesConfig';

// 📝 Note Components
import NoteButton from './CellNote/NoteButton';
import NoteEditor from './CellNote/NoteEditor';
import NoteDisplay from './CellNote/NoteDisplay';
import NoteSeparator from './CellNote/NoteSeparator';

// ✏️ Inline Editors
import RegexInlineEditor from './InlineEditors/RegexInlineEditor';
import ExtractorInlineEditor from './InlineEditors/ExtractorInlineEditor';
import NERInlineEditor from './InlineEditors/NERInlineEditor';
import LLMInlineEditor from './InlineEditors/LLMInlineEditor';
import IntentEditorInlineEditor from './InlineEditors/IntentEditorInlineEditor';

// 📊 Tester Components
import TesterGrid from './TesterGrid';
import TesterControls from './TesterControls';

// 🔧 Utilities
import { saveNLPProfileToGlobal } from './utils/nlpProfileUtils';

export interface NLPProfile {
  slotId: string;
  locale: string;
  kind: string;
  synonyms: string[];
  regex?: string;
  testCases?: string[]; // Test cases generali per tutti gli estrattori (regex, extractor, NER, LLM)
  formatHints?: string[];
  examples?: string[]; // Esempi NLP per training/NER (diversi da testCases)
  minConfidence?: number;
  postProcess?: any;
  subSlots?: any;
  waitingEsc1?: string;
  waitingEsc2?: string;
}

// Helper functions moved to hooks/components

// 🎨 Aggiungi CSS per animazione spinner
if (typeof document !== 'undefined' && !document.getElementById('nlp-spinner-animation')) {
  const style = document.createElement('style');
  style.id = 'nlp-spinner-animation';
  style.textContent = `
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateX(-10px); }
      to { opacity: 1; transform: translateX(0); }
    }
  `;
  document.head.appendChild(style);
}

export default function NLPExtractorProfileEditor({
  node,
  actType,
  locale = 'it-IT',
  onChange,
  intentSelected,
  act,
}: {
  node: any;
  actType?: string; // ✅ Type dell'act per determinare classification vs extraction mode
  locale?: string;
  onChange?: (profile: NLPProfile) => void;
  intentSelected?: string; // Intent ID selected from IntentListEditor (when kind === 'intent')
  act?: { id: string; type: string; label?: string; instanceId?: string }; // Act info for syncing intents
}) {
  // Profile state management (extracted to hook)
  const {
    lockKind,
    setLockKind,
    kind,
    setKind,
    inferredKind,
    synonymsText,
    setSynonymsText,
    regex,
    setRegex,
    formatText,
    setFormatText,
    examplesList,
    setExamplesList,
    minConf,
    setMinConf,
    postProcessText,
    setPostProcessText,
    waitingEsc1,
    setWaitingEsc1,
    waitingEsc2,
    setWaitingEsc2,
    jsonError,
    profile,
  } = useProfileState(node, locale, onChange);

  // Testing state (managed by hook)
  const [newExample, setNewExample] = React.useState<string>('');
  const [baselineStats, setBaselineStats] = React.useState<{ matched: number; falseAccept: number; totalGt: number } | null>(null);
  const [lastStats, setLastStats] = React.useState<{ matched: number; falseAccept: number; totalGt: number } | null>(null);
  const [activeTab, setActiveTab] = React.useState<'regex' | 'extractor' | 'post' | null>(null);

  // ✅ State per modalità di visualizzazione frasi nel Tester (solo per kind === 'intent')
  const [testPhraseMode, setTestPhraseMode] = React.useState<'all-training' | 'selected-training' | 'test-phrases'>('all-training');

  // ✅ Leggi kind da node.kind (mainData.kind) invece di actType
  const nodeKind = React.useMemo(() => {
    return node?.kind || 'generic';
  }, [node?.kind]);

  // ✅ Determina automaticamente il mode basandosi sul kind del nodo
  const testMode: 'extraction' | 'classification' = React.useMemo(() => {
    // Se kind === "intent" → classification mode
    if (nodeKind === 'intent') {
      return 'classification';
    }
    // Default: extraction mode per tutti gli altri kind
    return 'extraction';
  }, [nodeKind]);

  // ✅ Nascondi Kind selector, Confidence, Waiting quando kind === "intent"
  const isIntentKind = nodeKind === 'intent';

  // State for regex AI generation (used in hidden section)
  const regexInputRef = React.useRef<HTMLInputElement>(null);
  const [generatingRegex, setGeneratingRegex] = React.useState<boolean>(false);
  const [regexAiMode, setRegexAiMode] = React.useState<boolean>(false);
  const [regexAiPrompt, setRegexAiPrompt] = React.useState<string>('');
  const [regexBackup, setRegexBackup] = React.useState<string>('');

  // 🎯 Use custom hooks
  const {
    notes: cellNotes,
    getNote,
    hasNote,
    addNote,
    deleteNote,
    startEditing,
    stopEditing,
    isEditing,
    setHovered,
    isHovered
  } = useNotes();

  const {
    activeEditor,
    openEditor,
    closeEditor,
    toggleEditor,
    isEditorOpen,
    isAnyEditorOpen
  } = useEditorState();

  // Extraction testing (extracted to hook)
  const {
    rowResults,
    selectedRow,
    setSelectedRow,
    testing,
    cellOverrides,
    setCellOverrides,
    editingCell,
    setEditingCell,
    editingText,
    setEditingText,
    enabledMethods,
    runRowTest,
    runAllRows,
    cancelTesting,
    toggleMethod,
    computeStatsFromResults,
    summarizeVars,
    findAllOccurrences,
    mergeSpans,
    spansFromDate,
    spansFromScalar,
    expectedKeysForKind,
  } = useExtractionTesting({
    examplesList,
    kind,
    synonymsText,
    formatText,
    profile,
    onStatsUpdate: (stats) => {
      setLastStats(stats);
      if (!baselineStats) setBaselineStats(stats);
    },
  });

  const [endpointBase] = React.useState<string>(() => {
    try {
      const saved = typeof window !== 'undefined' ? localStorage.getItem('nlpEndpointBase') : null;
      return saved || ((import.meta as any)?.env?.VITE_PROMIS_URL || '/api');
    } catch {
      return ((import.meta as any)?.env?.VITE_PROMIS_URL || '/api');
    }
  });
  React.useEffect(() => {
    try { localStorage.setItem('nlpEndpointBase', endpointBase || ''); } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  // Auto-run parsing when a new phrase is appended
  const prevExamplesCountRef = React.useRef<number>(examplesList.length);
  React.useEffect(() => {
    if (examplesList.length > prevExamplesCountRef.current) {
      const newIdx = examplesList.length - 1;
      setSelectedRow(newIdx);
      setTimeout(() => { void runRowTest(newIdx); }, 0);
    }
    prevExamplesCountRef.current = examplesList.length;
  }, [examplesList.length, runRowTest, setSelectedRow]);

  // ✅ Aggiorna examplesList in base alla modalità selezionata (solo per kind === 'intent')
  const updateExamplesList = React.useCallback(() => {
    // Solo per kind === 'intent'
    if (nodeKind !== 'intent' || !act?.instanceId) {
      return;
    }

    const instance = instanceRepository.getInstance(act.instanceId);
    if (!instance?.problemIntents) return;

    let phrases: string[] = [];

    if (testPhraseMode === 'all-training') {
      // Tutte le frasi di training di tutti gli intenti
      phrases = instance.problemIntents.flatMap((pi: ProblemIntent) =>
        (pi.phrases?.matching || []).map((p: any) => p.text)
      );
    } else if (testPhraseMode === 'selected-training') {
      // Solo frasi dell'intento selezionato
      if (intentSelected) {
        const intent = instance.problemIntents.find(
          (pi: ProblemIntent) => pi.id === intentSelected || pi.name === intentSelected
        );
        phrases = (intent?.phrases?.matching || []).map((p: any) => p.text);
      }
    } else if (testPhraseMode === 'test-phrases') {
      // Frasi di test (da ProblemPayload.editor.tests)
      try {
        const pid = localStorage.getItem('current.projectId') || '';
        const key = `problem.${pid}.${act.id}`;
        const raw = localStorage.getItem(key);
        if (raw) {
          const payload = JSON.parse(raw);
          phrases = (payload?.editor?.tests || []).map((t: any) => t.text);
        }
      } catch (err) {
        console.warn('[NLPExtractorProfileEditor] Could not load test phrases:', err);
      }
    }

    // Rimuovi duplicati e ordina alfabeticamente
    const uniquePhrases = Array.from(new Set(phrases)).sort();
    setExamplesList(uniquePhrases);
  }, [testPhraseMode, intentSelected, act?.instanceId, act?.id, nodeKind, setExamplesList]);

  React.useEffect(() => {
    updateExamplesList();
  }, [updateExamplesList]);

  // ✅ Ascolta gli aggiornamenti di instanceRepository per aggiornare le frasi quando vengono generate
  React.useEffect(() => {
    if (nodeKind !== 'intent' || !act?.instanceId) {
      return;
    }

    const handleInstanceUpdate = (event: any) => {
      const { instanceId } = event.detail || {};
      if (instanceId === act.instanceId) {
        updateExamplesList();
      }
    };

    window.addEventListener('instanceRepository:updated', handleInstanceUpdate);
    return () => {
      window.removeEventListener('instanceRepository:updated', handleInstanceUpdate);
    };
  }, [act?.instanceId, nodeKind, updateExamplesList]);

  // Function to save current config to global database
  const saveToGlobal = async () => {
    try {
      const success = await saveNLPProfileToGlobal(profile);
      if (success) {
        alert('Configuration saved to global database!');
      } else {
        alert('Failed to save configuration.');
      }
    } catch (error: any) {
      console.error('Error saving to global:', error);
      alert('Error saving configuration: ' + (error?.message || 'Unknown error'));
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Header compatto + tab editor */}
      <div style={{ border: '2px solid #9ca3af', borderRadius: 12, padding: 12 }}>
        {/* ✅ Quando kind === "intent", mostra solo Waiting LLM con messaggio diverso */}
        {isIntentKind ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
            <div>
              <label
                style={{
                  opacity: 0.8,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  marginBottom: 4,
                  height: '16px', // ✅ Altezza fissa per consistenza
                }}
              >
                <MessageCircle size={14} />
                Waiting LLM
              </label>
              <input
                value={waitingEsc2 || 'Un momento per favore, sto analizzando la sua richiesta'}
                onChange={(e) => setWaitingEsc2(e.target.value)}
                title="Testo mostrato all'utente mentre si attende l'analisi LLM"
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  border: '2px solid #9ca3af',
                  borderRadius: 6,
                  background: '#f0fdf4',
                }}
              />
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 300px) 80px 1fr', gap: 12, alignItems: 'start' }}>
            {/* Kind Selector Component */}
            <KindSelector
              kind={kind}
              setKind={setKind}
              lockKind={lockKind}
              setLockKind={setLockKind}
              inferredKind={inferredKind}
              hideIfIntent={true}
            />

            {/* Confidence Component */}
            <ConfidenceInput value={minConf} onChange={setMinConf} />

            {/* Waiting Messages Component */}
            <WaitingMessagesConfig
              waitingNER={waitingEsc1}
              setWaitingNER={setWaitingEsc1}
              waitingLLM={waitingEsc2}
              setWaitingLLM={setWaitingEsc2}
            />
          </div>
        )}

        {/* OLD tab editors - now replaced by inline editors */}
        <div style={{ marginTop: 10, display: 'none' }}>
          {activeTab === 'regex' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ opacity: 0.8 }}>Regex</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  ref={regexInputRef}
                  value={
                    generatingRegex
                      ? "⏳ Creating regex..."
                      : (regexAiMode ? regexAiPrompt : regex)
                  }
                  onChange={(e) => {
                    if (regexAiMode && !generatingRegex) {
                      setRegexAiPrompt(e.target.value);
                    } else if (!generatingRegex) {
                      setRegex(e.target.value);
                    }
                  }}
                  onKeyDown={(e) => {
                    // ESC key: exit AI mode and restore original regex
                    if (e.key === 'Escape' && regexAiMode) {
                      setRegexAiMode(false);
                      // Keep regexAiPrompt in memory for future iterations
                      // Restore the original regex (even if it was empty!)
                      setRegex(regexBackup);
                      e.preventDefault();
                      console.log('[AI Regex] Cancelled via ESC - restored:', regexBackup, '- prompt kept in memory');
                    }
                  }}
                  placeholder={
                    regexAiMode && !generatingRegex
                      ? "Describe here what the regex should match (in English)"
                      : "es. \\b\\d{5}\\b"
                  }
                  disabled={generatingRegex}
                  style={{
                    flex: 1,
                    padding: 10,
                    border: regexAiMode ? '2px solid #3b82f6' : '1px solid #ddd',
                    borderRadius: 8,
                    fontFamily: regexAiMode ? 'inherit' : 'monospace',
                    backgroundColor: generatingRegex ? '#f9fafb' : (regexAiMode ? '#eff6ff' : '#fff'),
                    transition: 'all 0.2s ease'
                  }}
                />

                {/* Show WAND ONLY in normal mode (NOT in AI mode) */}
                {!regexAiMode && (
                  <button
                    type="button"
                    onClick={() => {
                      // Save current regex before entering AI mode (even if empty!)
                      setRegexBackup(regex);
                      setRegexAiMode(true);
                      // Keep regexAiPrompt in memory - don't reset it!
                      // Give focus to input after state update
                      setTimeout(() => {
                        regexInputRef.current?.focus();
                      }, 0);
                    }}
                    disabled={generatingRegex}
                    title="Generate regex with AI"
                    style={{
                      padding: 10,
                      border: '1px solid #ddd',
                      borderRadius: 8,
                      background: '#fff',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minWidth: 40,
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <Wand2 size={16} color='#666' />
                  </button>
                )}

                {/* Show CREATE BUTTON when: AI mode AND at least 5 characters */}
                {regexAiMode && regexAiPrompt.trim().length >= 5 && (
                  <button
                    type="button"
                    onClick={async () => {
                      if (!regexAiPrompt.trim()) return;

                      setGeneratingRegex(true);
                      try {
                        console.log('[AI Regex] Generating regex for:', regexAiPrompt);

                        // Extract sub-data from node if available
                        const subData = (node?.subData || node?.subSlots || []) as any[];
                        const subDataInfo = subData.map((sub: any, index: number) => ({
                          id: sub.id || `sub-${index}`,
                          label: sub.label || sub.name || '',
                          index: index + 1 // Position in capture groups (1, 2, 3...)
                        }));

                        console.log('[AI Regex] Sub-data info:', {
                          hasSubData: subDataInfo.length > 0,
                          subDataInfo,
                          kind
                        });

                        const response = await fetch('/api/nlp/generate-regex', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            description: regexAiPrompt,
                            subData: subDataInfo.length > 0 ? subDataInfo : undefined,
                            kind: kind || undefined
                          })
                        });

                        if (!response.ok) {
                          const error = await response.json();
                          throw new Error(error.detail || 'Failed to generate regex');
                        }

                        const data = await response.json();
                        console.log('[AI Regex] Response:', data);

                        if (data.success && data.regex) {
                          setRegex(data.regex);
                          console.log('[AI Regex] Regex generated successfully:', data.regex);

                          if (data.explanation) {
                            console.log('[AI Regex] Explanation:', data.explanation);
                            console.log('[AI Regex] Examples:', data.examples);
                          }

                          // Exit AI mode and return to normal
                          // Keep regexAiPrompt in memory for future iterations
                          setRegexAiMode(false);
                        } else {
                          throw new Error('No regex returned from API');
                        }
                      } catch (error) {
                        console.error('[AI Regex] Error:', error);
                        alert(`Error generating regex: ${error instanceof Error ? error.message : 'Unknown error'}`);
                      } finally {
                        setGeneratingRegex(false);
                      }
                    }}
                    disabled={generatingRegex}
                    title="Generate regex from description"
                    style={{
                      padding: '10px 16px',
                      border: '2px solid #3b82f6',
                      borderRadius: 8,
                      background: generatingRegex ? '#f3f4f6' : '#3b82f6',
                      color: '#fff',
                      cursor: generatingRegex ? 'default' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      fontWeight: 500,
                      minWidth: 120,
                      justifyContent: 'center',
                      transition: 'all 0.2s ease',
                      animation: 'fadeIn 0.2s ease-in'
                    }}
                  >
                    {generatingRegex ? (
                      <>
                        <span style={{
                          display: 'inline-block',
                          width: 14,
                          height: 14,
                          border: '2px solid #fff',
                          borderTopColor: 'transparent',
                          borderRadius: '50%',
                          animation: 'spin 0.8s linear infinite'
                        }} />
                        <span>Creating...</span>
                      </>
                    ) : (
                      'Create Regex'
                    )}
                  </button>
                )}
              </div>
                </div>
          )}
          {activeTab === 'extractor' && (
            <NLPCompactEditor
              synonymsText={synonymsText}
              setSynonymsText={setSynonymsText}
              formatText={formatText}
              setFormatText={setFormatText}
            />
          )}
          {activeTab === 'post' && (
            <PostProcessEditor value={postProcessText} onChange={setPostProcessText} />
          )}
          {jsonError && (
            <div style={{ color: '#b91c1c', marginTop: 6 }}>JSON non valido: {jsonError}</div>
          )}
        </div>
      </div>

      {/* Tester section - hidden when inline editor is active */}
      {!activeEditor && (
        <div style={{ border: '2px solid #9ca3af', borderRadius: 12, padding: 12 }}>
          {/* Header con Tester e toolbar per kind === 'intent' */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ fontWeight: 700 }}>Tester</div>
            {/* Toolbar con 3 pulsanti mutualmente esclusivi (solo per kind === 'intent') */}
            {isIntentKind && (
              <div style={{ display: 'flex', gap: 4 }}>
                <button
                  onClick={() => setTestPhraseMode('all-training')}
                  style={{
                    padding: '4px 8px',
                    border: '1px solid #9ca3af',
                    borderRadius: 4,
                    background: testPhraseMode === 'all-training' ? '#dbeafe' : '#fff',
                    cursor: 'pointer',
                    fontWeight: testPhraseMode === 'all-training' ? 600 : 400
                  }}
                  title="Mostra tutte le frasi di training di tutti gli intenti"
                >
                  All training phrases
                </button>
                <button
                  onClick={() => setTestPhraseMode('selected-training')}
                  disabled={!intentSelected}
                  style={{
                    padding: '4px 8px',
                    border: '1px solid #9ca3af',
                    borderRadius: 4,
                    background: testPhraseMode === 'selected-training' ? '#dbeafe' : '#fff',
                    cursor: intentSelected ? 'pointer' : 'not-allowed',
                    opacity: intentSelected ? 1 : 0.5,
                    fontWeight: testPhraseMode === 'selected-training' ? 600 : 400
                  }}
                  title={intentSelected ? "Mostra solo le frasi di training dell'intento selezionato" : "Seleziona un intento per vedere le sue frasi"}
                >
                  Training phrases for selected Intent
                </button>
                <button
                  onClick={() => setTestPhraseMode('test-phrases')}
                  style={{
                    padding: '4px 8px',
                    border: '1px solid #9ca3af',
                    borderRadius: 4,
                    background: testPhraseMode === 'test-phrases' ? '#dbeafe' : '#fff',
                    cursor: 'pointer',
                    fontWeight: testPhraseMode === 'test-phrases' ? 600 : 400
                  }}
                  title="Mostra le frasi di test (non usate per il training)"
                >
                  Test Phrases
                </button>
              </div>
            )}
          </div>
          {/* Controls toolbar */}
          <TesterControls
            newExample={newExample}
            setNewExample={setNewExample}
            examplesList={examplesList}
            setExamplesList={setExamplesList}
            selectedRow={selectedRow}
            setSelectedRow={setSelectedRow}
            runRowTest={runRowTest}
            runAllRows={runAllRows}
            cancelTesting={cancelTesting}
            testing={testing}
            kind={kind}
            locale={locale}
            synonymsText={synonymsText}
            formatText={formatText}
            regex={regex}
            postProcessText={postProcessText}
            rowResults={rowResults}
            cellOverrides={cellOverrides}
            expectedKeysForKind={expectedKeysForKind}
            setSynonymsText={setSynonymsText}
            setFormatText={setFormatText}
            setRegex={setRegex}
            setPostProcessText={setPostProcessText}
            baselineStats={baselineStats}
            lastStats={lastStats}
          />
          {/* 🎨 Grid - already hidden by parent !activeEditor condition */}
          <TesterGrid
            examplesList={examplesList}
            rowResults={rowResults}
            selectedRow={selectedRow}
            setSelectedRow={setSelectedRow}
            enabledMethods={enabledMethods}
            toggleMethod={toggleMethod}
            runRowTest={runRowTest}
            kind={kind}
            expectedKeysForKind={expectedKeysForKind}
            cellOverrides={cellOverrides}
            setCellOverrides={setCellOverrides}
            editingCell={editingCell}
            setEditingCell={setEditingCell}
            editingText={editingText}
            setEditingText={setEditingText}
            hasNote={hasNote}
            getNote={getNote}
            addNote={addNote}
            deleteNote={deleteNote}
            isEditing={isEditing}
            startEditing={startEditing}
            stopEditing={stopEditing}
            isHovered={isHovered}
            setHovered={setHovered}
            activeEditor={activeEditor}
            toggleEditor={toggleEditor}
            mode={testMode}
          />
        </div>
      )}

      {/* 🎨 Inline Editors - shown in place of Tester when activeEditor is set */}
      {/* 📐 Full-height container for inline editors */}
      {activeEditor && (
        <div style={{
          border: '1px solid #e5e7eb',
          borderRadius: 12,
          padding: 12,
          minHeight: 600,
          width: '100%',
          maxWidth: '100%',
          overflow: 'hidden'
        }}>
          {activeEditor === 'regex' && (
            <RegexInlineEditor
              regex={regex}
              setRegex={setRegex}
              onClose={closeEditor}
              node={node}
              kind={kind}
              profile={profile}
              onProfileUpdate={(updatedProfile) => {
                // Update profile via onChange callback
                onChange?.(updatedProfile);
              }}
            />
          )}

          {activeEditor === 'extractor' && (
            <ExtractorInlineEditor
              onClose={closeEditor}
              node={node}
              profile={profile}
              onProfileUpdate={(updatedProfile) => {
                onChange?.(updatedProfile);
              }}
            />
          )}

          {activeEditor === 'ner' && (
            <NERInlineEditor
              onClose={closeEditor}
              node={node}
              profile={profile}
              onProfileUpdate={(updatedProfile) => {
                onChange?.(updatedProfile);
              }}
            />
          )}

          {activeEditor === 'llm' && (
            <LLMInlineEditor
              onClose={closeEditor}
              node={node}
              profile={profile}
              onProfileUpdate={(updatedProfile) => {
                onChange?.(updatedProfile);
              }}
            />
          )}

          {activeEditor === 'embeddings' && (
            <IntentEditorInlineEditor
              onClose={closeEditor}
              node={node}
              profile={profile}
              onProfileUpdate={(updatedProfile) => {
                onChange?.(updatedProfile);
              }}
              intentSelected={intentSelected}
              act={act}
            />
          )}

          {activeEditor === 'post' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontWeight: 600 }}>Post Process Configuration</h3>
                <button
                  onClick={closeEditor}
                  style={{
                    padding: '6px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: 6,
                    background: '#fff',
                    cursor: 'pointer'
                  }}
                >
                  Close
                </button>
              </div>
              <PostProcessEditor value={postProcessText} onChange={setPostProcessText} />
              {jsonError && (
                <div style={{ color: '#b91c1c', padding: 8, background: '#fee2e2', borderRadius: 6 }}>
                  JSON Error: {jsonError}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Details panel rimosso */}

      {/* Save to Global Button */}
      <div style={{ marginTop: '20px', textAlign: 'center' }}>
        <button
          onClick={saveToGlobal}
          style={{
            padding: '10px 20px',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500'
          }}
        >
          💾 Save to Global Database
        </button>
        <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '8px' }}>
          Save this configuration to the global database for all projects
        </p>
      </div>
    </div>
  );
}


