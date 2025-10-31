import React from 'react';
import { Wand2 } from 'lucide-react';
import { databaseService } from '../../../nlp/services/databaseService';
import RegexEditor from './RegexEditor';
import NLPCompactEditor from './NLPCompactEditor';
import PostProcessEditor from './PostProcessEditor';
import { Calendar, Mail, Phone, Hash, Globe, MapPin, User, FileText, CreditCard, CarFront as Car, Badge, Landmark, Type as TypeIcon, ChevronDown, Plus, ChevronsRight, Wrench, BarChart2 } from 'lucide-react';

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

// 📊 Tester Grid
import TesterGrid from './TesterGrid';

export interface NLPProfile {
  slotId: string;
  locale: string;
  kind: string;
  synonyms: string[];
  regex?: string;
  formatHints?: string[];
  examples?: string[];
  minConfidence?: number;
  postProcess?: any;
  subSlots?: any;
  waitingEsc1?: string;
  waitingEsc2?: string;
}

// Helper functions moved to useProfileState hook
function toCommaList(list?: string[] | null): string {
  return Array.isArray(list) ? list.join(', ') : '';
}

function fromCommaList(text: string): string[] {
  return (text || '')
    .split(',')
    .map((s) => s.trim())
    .filter((s, i, arr) => s.length > 0 && arr.indexOf(s) === i);
}

function tryParseJSON<T = any>(text: string): { value?: T; error?: string } {
  const t = (text || '').trim();
  if (!t) return { value: undefined as any };
  try {
    return { value: JSON.parse(t) };
  } catch (e: any) {
    return { error: e?.message || 'JSON parse error' };
  }
}

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
  const [reportOpen, setReportOpen] = React.useState<boolean>(false);
  const [activeTab, setActiveTab] = React.useState<'regex' | 'extractor' | 'post' | null>(null);

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

  // renderStackedSummary and renderTimeBar moved to TesterGrid component

  // Helper function to summarize extraction results (used in renderStackedSummary)
  const summarizeResult = (result: any, currentField: string): string => {
    try {
      if (!result || result.status !== 'accepted' || result.value === undefined || result.value === null)
        return "—";

      // For age (number), show the value directly
      if (currentField === 'age') {
        return `value=${result.value}`;
      }

      // For other fields, use existing logic
      if (currentField === 'dateOfBirth') {
        const v: any = result.value || {};
        return summarizeVars({ day: v.day, month: v.month, year: v.year },
          v.day && v.month && v.year ? `${String(v.day).padStart(2,'0')}/${String(v.month).padStart(2,'0')}/${v.year}` : undefined);
      } else if (currentField === 'phone') {
        const v: any = result.value || {};
        return v.e164 ? `value=${v.e164}` : '—';
      } else if (currentField === 'email') {
        return result.value ? `value=${String(result.value)}` : '—';
      } else {
        return result.value ? `value=${String(result.value)}` : '—';
      }
    } catch (error) {
      console.error('[NLP_TESTER] summarizeResult error:', error, { result, currentField });
      return "—";
    }
  };

  // Function to save current config to global database
  const saveToGlobal = async () => {
    try {
      // Create config from current profile
      const globalConfig: NLPConfigDB = {
        supportedKinds: [profile.kind],
        aliases: {},
        extractorMapping: { [profile.kind]: profile.kind },
        typeMetadata: {
          [profile.kind]: {
            description: profile.description || `Extractor for ${profile.kind}`,
            examples: profile.examples || [],
            regex: profile.regex ? [profile.regex] : undefined,
            // TODO: Add more fields from profile
          }
        },
        aiPrompts: {},  // Required field
        version: "1.0.0",
        lastUpdated: new Date().toISOString(),
        permissions: { canEdit: true, canCreate: true, canDelete: false },
        auditLog: true
      };

      const success = await databaseService.saveNLPConfig(globalConfig);
      if (success) {
        alert('Configuration saved to global database!');
      } else {
        alert('Failed to save configuration.');
      }
    } catch (error) {
      console.error('Error saving to global:', error);
      alert('Error saving configuration: ' + error.message);
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

                        const response = await fetch('/api/nlp/generate-regex', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ description: regexAiPrompt })
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

      {/* 🎨 Tester section - hidden when inline editor is active */}
      {!activeEditor && (
      <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Tester</div>
          {/* Controls in one line: input fills, icons right */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
            <input
              value={newExample}
              onChange={(e) => setNewExample(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  const t = (newExample || '').trim();
                  if (!t) return;
                  const existIdx = examplesList.findIndex((p) => p === t);
                  if (existIdx !== -1) {
                    setSelectedRow(existIdx);
                    // avvia il riconoscimento in background anche se già esiste
                    setTimeout(() => { void runRowTest(existIdx); }, 0);
                  } else {
                    const next = Array.from(new Set([...examplesList, t]));
                    setExamplesList(next);
                    const newIdx = next.length - 1;
                    setSelectedRow(newIdx);
                    // avvia dopo che lo state è aggiornato
                    setTimeout(() => { void runRowTest(newIdx); }, 0);
                  }
                  setNewExample('');
                }
              }}
              placeholder="Aggiungi frase…"
              style={{ flex: 1, padding: 10, border: '1px solid #4b5563', background: '#111827', color: '#e5e7eb', borderRadius: 8 }}
            />
            <button title="Aggiungi" onClick={() => {
                const t = (newExample || '').trim();
                if (!t) return;
                const existIdx = examplesList.findIndex((p) => p === t);
                if (existIdx !== -1) {
                  setSelectedRow(existIdx);
                  setTimeout(() => { void runRowTest(existIdx); }, 0);
                } else {
                  const next = Array.from(new Set([...examplesList, t]));
                  setExamplesList(next);
                  const newIdx = next.length - 1;
                  setSelectedRow(newIdx);
                  setTimeout(() => { void runRowTest(newIdx); }, 0);
                }
                setNewExample('');
              }} style={{ border: '1px solid #10b981', background: '#065f46', color: '#ecfdf5', borderRadius: 8, padding: '8px 10px', cursor: 'pointer' }}>
              <Plus size={14} />
            </button>
            <button onClick={runAllRows} disabled={testing || examplesList.length === 0} title="Prova tutte" style={{ border: '1px solid #22c55e', background: testing ? '#eab308' : '#14532d', color: '#dcfce7', borderRadius: 8, padding: '8px 10px', cursor: testing ? 'default' : 'pointer' }}>
              <ChevronsRight size={16} />
            </button>
            {/* Tuning */}
            <button
              title="Tuning"
              onClick={async () => {
                const errors: Array<any> = [];
                (examplesList || []).forEach((phrase, rowIdx) => {
                  const rr = rowResults[rowIdx] || {} as any;
                  const cols: Array<{ id: 'det'|'ner'|'llm'; src?: string }> = [
                    { id: 'det', src: rr?.deterministic },
                    { id: 'ner', src: rr?.ner },
                    { id: 'llm', src: rr?.llm },
                  ];
                  const keys = expectedKeysForKind(kind);
                  keys.forEach((kKey) => {
                    const gt = cellOverrides[`${rowIdx}:det:${kKey}`];
                    cols.forEach(({ id, src }) => {
                      const predMap: Record<string,string|undefined> = {};
                      const t = (src || '').toString();
                      if (t && t !== '—') {
                        t.split(',').forEach(part => { const sp = part.split('='); const kk = sp[0]?.trim(); const vv = sp[1] != null ? String(sp[1]).trim() : undefined; if (kk) predMap[kk] = vv; });
                      }
                      const pred = predMap[kKey];
                      if ((gt && !pred) || (gt && pred && pred !== gt)) {
                        errors.push({ phrase, key: kKey, pred: pred ?? null, gt, type: pred ? 'false-accept' : 'unmatched', engine: id });
                      }
                    });
                  });
                });
                try {
                  const res = await fetch('/api/nlp/tune-contract', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, locale: initial.locale, profile: { synonyms: fromCommaList(synonymsText), formatHints: fromCommaList(formatText), regex: regex || undefined, postProcess: tryParseJSON(postProcessText).value }, errors }) });
                  if (res.ok) {
                    const obj = await res.json();
                    const s = obj?.suggested || {};
                    if (Array.isArray(s.synonyms)) setSynonymsText(toCommaList(s.synonyms));
                    if (Array.isArray(s.formatHints)) setFormatText(toCommaList(s.formatHints));
                    if (typeof s.regex === 'string') setRegex(String(s.regex));
                    if (typeof s.postProcess !== 'undefined') setPostProcessText(typeof s.postProcess === 'string' ? s.postProcess : JSON.stringify(s.postProcess, null, 2));
                    await runAllRows();
                  }
                } catch {}
              }}
              style={{ border: '1px solid #f59e0b', background: '#7c2d12', color: '#ffedd5', borderRadius: 8, padding: '8px 10px', cursor: 'pointer' }}>
              <Wrench size={16} />
            </button>
            {/* Report dropdown moved to the far right */}
            <div style={{ position: 'relative' }}>
              <button title="Report" onClick={() => setReportOpen(o => !o)} style={{ border: '1px solid #60a5fa', background: '#0c4a6e', color: '#dbeafe', borderRadius: 8, padding: '8px 10px', cursor: 'pointer' }}>
                <BarChart2 size={16} />
              </button>
              {reportOpen && (
                <div style={{ position: 'absolute', right: 0, marginTop: 6, background: '#111827', color: '#e5e7eb', border: '1px solid #374151', borderRadius: 8, padding: 10, minWidth: 260, zIndex: 30 }}>
                  {(() => {
                    const base = baselineStats || { matched: 0, falseAccept: 0, totalGt: 0 };
                    const last = lastStats || base;
                    const pct = (n: number, d: number) => d > 0 ? Math.round((n / d) * 100) : 0;
                    const gainedMatched = pct(last.matched, last.totalGt) - pct(base.matched, base.totalGt);
                    const removedFA = pct(base.falseAccept, base.totalGt) - pct(last.falseAccept, last.totalGt);
                    const stillUnmatch = Math.max(0, (last.totalGt - last.matched - last.falseAccept));
                    const stillFA = last.falseAccept;
                    const sign = (v: number) => (v > 0 ? `+${v}` : `${v}`);
                    return (
                      <div style={{ display: 'grid', gap: 6 }}>
                        <div><strong>Gained Matched:</strong> {sign(gainedMatched)}%</div>
                        <div><strong>Removed False acceptance:</strong> {sign(removedFA)}%</div>
                        <div><strong>Still UnMatching:</strong> {stillUnmatch}</div>
                        <div><strong>Still False acceptance:</strong> {stillFA} ({sign(pct(last.falseAccept, last.totalGt) - pct(base.falseAccept, base.totalGt))}%)</div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>
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
          />
      </div>
      )}

      {/* 🎨 Inline Editors - shown in place of Tester when activeEditor is set */}
      {/* 📐 Full-height container for inline editors */}
      {activeEditor && (
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 12, minHeight: 600 }}>
          {activeEditor === 'regex' && (
            <RegexInlineEditor
              regex={regex}
              setRegex={setRegex}
              onClose={closeEditor}
            />
          )}

          {activeEditor === 'extractor' && (
            <ExtractorInlineEditor
              onClose={closeEditor}
            />
          )}

          {activeEditor === 'ner' && (
            <NERInlineEditor onClose={closeEditor} />
          )}

          {activeEditor === 'llm' && (
            <LLMInlineEditor onClose={closeEditor} />
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


