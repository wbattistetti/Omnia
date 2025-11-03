import React from 'react';
import { Wand2 } from 'lucide-react';
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
  locale = 'it-IT',
  onChange,
}: {
  node: any;
  locale?: string;
  onChange?: (profile: NLPProfile) => void;
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

  // 🧪 TEMPORARY: Test toggle for mode (will be removed in Fase 6)
  const [testMode, setTestMode] = React.useState<'extraction' | 'classification'>('extraction');

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
      <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 300px) 80px 1fr', alignItems: 'end', gap: 12 }}>
          {/* Kind Selector Component */}
          <KindSelector
            kind={kind}
            setKind={setKind}
            lockKind={lockKind}
            setLockKind={setLockKind}
            inferredKind={inferredKind}
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

        {/* 🧪 TEMPORARY: Test toggle for mode (will be removed in Fase 6) */}
        <div style={{ marginTop: 12, padding: 8, background: '#fef3c7', borderRadius: 8, border: '1px solid #fbbf24' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#92400e' }}>
              🧪 Test Mode:
            </label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button
                onClick={() => setTestMode('extraction')}
                style={{
                  padding: '4px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: 6,
                  background: testMode === 'extraction' ? '#3b82f6' : '#fff',
                  color: testMode === 'extraction' ? '#fff' : '#374151',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: testMode === 'extraction' ? 600 : 400
                }}
              >
                Extraction (4 colonne)
              </button>
              <button
                onClick={() => setTestMode('classification')}
                style={{
                  padding: '4px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: 6,
                  background: testMode === 'classification' ? '#3b82f6' : '#fff',
                  color: testMode === 'classification' ? '#fff' : '#374151',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: testMode === 'classification' ? 600 : 400
                }}
              >
                Classification (3 colonne: Regex, Embeddings, LLM)
              </button>
            </div>
            <span style={{ fontSize: 11, color: '#92400e', opacity: 0.8 }}>
              ⚠️ Temporaneo per test - rimuoveremo in Fase 6
            </span>
          </div>
        </div>

        {/* OLD tab editors - now replaced by inline editors */}
        <div style={{ marginTop: 10, display: 'none' }}>
          {activeTab === 'regex' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ fontSize: 12, opacity: 0.8 }}>Regex</label>
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
                      fontSize: 13,
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
            <div style={{ color: '#b91c1c', fontSize: 12, marginTop: 6 }}>JSON non valido: {jsonError}</div>
          )}
        </div>
      </div>

      {/* Tester section - hidden when inline editor is active */}
      {!activeEditor && (
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Tester</div>
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Intent Classifier (Embeddings)</h3>
                <button
                  onClick={closeEditor}
                  style={{
                    padding: '6px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: 6,
                    background: '#fff',
                    cursor: 'pointer',
                    fontSize: 14
                  }}
                >
                  Close
                </button>
              </div>
              <div style={{ padding: 20, textAlign: 'center', color: '#6b7280' }}>
                <p>Intent Editor will be integrated here in Fase 4</p>
              </div>
            </div>
          )}

          {activeEditor === 'post' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Post Process Configuration</h3>
                <button
                  onClick={closeEditor}
                  style={{
                    padding: '6px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: 6,
                    background: '#fff',
                    cursor: 'pointer',
                    fontSize: 14
                  }}
                >
                  Close
                </button>
              </div>
              <PostProcessEditor value={postProcessText} onChange={setPostProcessText} />
              {jsonError && (
                <div style={{ color: '#b91c1c', fontSize: 12, padding: 8, background: '#fee2e2', borderRadius: 6 }}>
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


