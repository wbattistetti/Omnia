// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Play, Plus, X } from 'lucide-react';
import { useGrammarStore } from '../../core/state/grammarStoreContext';
import { TestPhraseList } from './TestPhraseList';
import { TestPhraseDetails } from './TestPhraseDetails';
import { TestPhraseStats } from './TestPhraseStats';
import { useTestPhrases } from '../../hooks/useTestPhrases';
import { normalizePhraseForDedup } from './testPhraseText';

export interface TestPhrase {
  id: string;
  text: string;
  status?: 'matched' | 'no-match' | 'ambiguous';
  result?: TestPhraseResult;
}

export interface TestPhraseResult {
  success: boolean;
  bindings: Record<string, any>;
  consumedWords: number;
  garbageUsed: number;
  matchDetails: MatchDetail[];
}

export interface MatchDetail {
  type: 'slot' | 'semantic-value' | 'linguistic';
  id: string;
  label: string;
  semanticValue?: string;
  linguisticText?: string;
  children?: MatchDetail[];
}

const MIN_HEIGHT = 150;
const MAX_HEIGHT = 600; // ✅ Increased to allow more expansion
const DEFAULT_HEIGHT = 250;
const DEFAULT_RIGHT_PANEL_WIDTH = 25; // Percentuale iniziale per pannello destro

interface TestPhrasesProps {
  initialPhrases?: string[];
  onPhrasesChange?: (phrases: string[]) => void;
}

export function TestPhrases({ initialPhrases = [], onPhrasesChange }: TestPhrasesProps) {
  const { grammar } = useGrammarStore();
  const [isOpen, setIsOpen] = useState(false);
  const [panelHeight, setPanelHeight] = useState(DEFAULT_HEIGHT);
  const [isResizing, setIsResizing] = useState(false);
  const [rightPanelWidth, setRightPanelWidth] = useState(DEFAULT_RIGHT_PANEL_WIDTH);
  const [isResizingVertical, setIsResizingVertical] = useState(false);
  const [phrases, setPhrases] = useState<TestPhrase[]>(() => {
    // Initialize from initialPhrases prop
    return initialPhrases.map((text, idx) => ({
      id: `phrase-${idx}-${Date.now()}`,
      text,
    }));
  });
  const [newPhrase, setNewPhrase] = useState('');
  const [selectedPhraseId, setSelectedPhraseId] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [editingPhraseId, setEditingPhraseId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');

  const { testPhrase, testAllPhrases } = useTestPhrases();
  const resizeStartRef = useRef<{ y: number; height: number } | null>(null);
  const resizeVerticalStartRef = useRef<{ x: number; width: number; containerWidth: number } | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Load saved height and width from localStorage
  useEffect(() => {
    const savedHeight = localStorage.getItem('grammar-test-phrases-height');
    if (savedHeight) {
      const height = parseInt(savedHeight, 10);
      if (height >= MIN_HEIGHT && height <= MAX_HEIGHT) {
        setPanelHeight(height);
      }
    }
    const savedWidth = localStorage.getItem('grammar-test-phrases-right-width');
    if (savedWidth) {
      const width = parseFloat(savedWidth);
      if (width >= 20 && width <= 60) {
        setRightPanelWidth(width);
      }
    }
  }, []);

  const onPhrasesChangeRef = useRef(onPhrasesChange);
  onPhrasesChangeRef.current = onPhrasesChange;

  const prevInitialPhrasesJsonRef = useRef<string | null>(null);

  useEffect(() => {
    const j = JSON.stringify(initialPhrases ?? []);
    if (prevInitialPhrasesJsonRef.current === null) {
      prevInitialPhrasesJsonRef.current = j;
      return;
    }
    if (j === prevInitialPhrasesJsonRef.current) return;
    prevInitialPhrasesJsonRef.current = j;
    const texts = initialPhrases ?? [];
    setPhrases(prev => {
      if (JSON.stringify(prev.map(p => p.text)) === j) return prev;
      return texts.map((text, idx) => ({
        id: prev[idx]?.id ?? `phrase-${idx}-${Date.now()}`,
        text,
      }));
    });
  }, [initialPhrases]);

  useEffect(() => {
    const phraseTexts = phrases.map(p => p.text);
    onPhrasesChangeRef.current?.(phraseTexts);
  }, [phrases]);

  const selectedPhrase = phrases.find(p => p.id === selectedPhraseId);

  const handleAddPhrase = useCallback(() => {
    const trimmed = newPhrase.trim();
    if (!trimmed) return;

    const key = normalizePhraseForDedup(trimmed);
    setPhrases(prev => {
      if (prev.some(p => normalizePhraseForDedup(p.text) === key)) {
        return prev;
      }
      return [
        ...prev,
        {
          id: `phrase-${Date.now()}`,
          text: trimmed,
        },
      ];
    });
    setNewPhrase('');
  }, [newPhrase]);

  const handleBeginEdit = useCallback((id: string) => {
    const p = phrases.find(x => x.id === id);
    if (!p) return;
    setEditingPhraseId(id);
    setEditDraft(p.text);
  }, [phrases]);

  const handleCancelEdit = useCallback(() => {
    setEditingPhraseId(null);
    setEditDraft('');
  }, []);

  const handleCommitEdit = useCallback((id: string) => {
    const trimmed = editDraft.trim();

    if (!trimmed) {
      setPhrases(prev => prev.filter(p => p.id !== id));
      setEditingPhraseId(null);
      setEditDraft('');
      return;
    }

    let duplicate = false;
    setPhrases(prev => {
      if (
        prev.some(
          p => p.id !== id && normalizePhraseForDedup(p.text) === normalizePhraseForDedup(trimmed)
        )
      ) {
        duplicate = true;
        return prev;
      }
      return prev.map(p => (p.id === id ? { ...p, text: trimmed } : p));
    });

    if (duplicate) {
      setEditingPhraseId(null);
      setEditDraft('');
      return;
    }

    setEditingPhraseId(null);
    setEditDraft('');
  }, [editDraft]);

  const handleRemovePhrase = useCallback((id: string) => {
    setPhrases(prev => prev.filter(p => p.id !== id));
    setSelectedPhraseId(prev => (prev === id ? null : prev));
    setEditingPhraseId(prev => (prev === id ? null : prev));
  }, []);

  const handleTestAll = useCallback(async () => {
    if (!grammar || phrases.length === 0) return;

    setIsTesting(true);
    try {
      const results = await testAllPhrases(grammar, phrases);

      setPhrases(prev => prev.map(phrase => {
        const result = results.find(r => r.phraseId === phrase.id);
        return {
          ...phrase,
          status: result?.success ? 'matched' : 'no-match',
          result: result,
        };
      }));
    } catch (error) {
      console.error('[TestPhrases] Test all failed:', error);
    } finally {
      setIsTesting(false);
    }
  }, [grammar, phrases, testAllPhrases]);

  const handleTestSingle = useCallback(async (phraseId: string) => {
    if (!grammar) return;

    const phrase = phrases.find(p => p.id === phraseId);
    if (!phrase) return;

    try {
      const result = await testPhrase(grammar, phrase.text);

      setPhrases(prev => prev.map(p =>
        p.id === phraseId
          ? { ...p, status: result.success ? 'matched' : 'no-match', result }
          : p
      ));

      setSelectedPhraseId(phraseId);
    } catch (error) {
      console.error('[TestPhrases] Test single failed:', error);
    }
  }, [grammar, phrases, testPhrase]);

  const stats = React.useMemo(() => {
    const matched = phrases.filter(p => p.status === 'matched').length;
    const noMatch = phrases.filter(p => p.status === 'no-match').length;
    const ambiguous = phrases.filter(p => p.status === 'ambiguous').length;

    return { total: phrases.length, matched, noMatch, ambiguous };
  }, [phrases]);

  const addWouldDuplicate = React.useMemo(() => {
    const t = newPhrase.trim();
    if (!t) return false;
    const key = normalizePhraseForDedup(t);
    return phrases.some(p => normalizePhraseForDedup(p.text) === key);
  }, [newPhrase, phrases]);

  // Handle horizontal splitter drag (altezza pannello)
  const handleSplitterMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    resizeStartRef.current = {
      y: e.clientY,
      height: panelHeight,
    };
  }, [panelHeight]);

  // Handle vertical splitter drag (larghezza pannello destro)
  const handleVerticalSplitterMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizingVertical(true);
    if (containerRef.current) {
      resizeVerticalStartRef.current = {
        x: e.clientX,
        width: rightPanelWidth,
        containerWidth: containerRef.current.offsetWidth,
      };
    }
  }, [rightPanelWidth]);

  // Handle horizontal resize (altezza)
  useEffect(() => {
    if (!isResizing) {
      // Remove no-pan class when not resizing
      document.body.classList.remove('grammar-editor-resizing');
      return;
    }

    // ✅ Add class to disable ReactFlow pan during resize
    document.body.classList.add('grammar-editor-resizing');

    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation(); // ✅ Stop propagation to prevent ReactFlow from intercepting
      if (!resizeStartRef.current) return;

      const delta = resizeStartRef.current.y - e.clientY; // Inverted: dragging up increases height
      const newHeight = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, resizeStartRef.current.height + delta));

      setPanelHeight(newHeight);
      localStorage.setItem('grammar-test-phrases-height', newHeight.toString());
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      resizeStartRef.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.body.classList.remove('grammar-editor-resizing');
    };

    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
    // ✅ Use capture phase to intercept events before ReactFlow
    document.addEventListener('mousemove', handleMouseMove, { passive: false, capture: true });
    document.addEventListener('mouseup', handleMouseUp, { capture: true });

    return () => {
      document.removeEventListener('mousemove', handleMouseMove, { capture: true });
      document.removeEventListener('mouseup', handleMouseUp, { capture: true });
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.body.classList.remove('grammar-editor-resizing');
    };
  }, [isResizing]);

  // Handle vertical resize (larghezza pannello destro)
  useEffect(() => {
    if (!isResizingVertical) {
      // Remove no-pan class when not resizing
      document.body.classList.remove('grammar-editor-resizing');
      return;
    }

    // ✅ Add class to disable ReactFlow pan during resize
    document.body.classList.add('grammar-editor-resizing');

    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation(); // ✅ Stop propagation to prevent ReactFlow from intercepting
      if (!resizeVerticalStartRef.current || !containerRef.current) return;

      const delta = e.clientX - resizeVerticalStartRef.current.x;
      const deltaPercent = (delta / resizeVerticalStartRef.current.containerWidth) * 100;

      const newWidth = Math.max(20, Math.min(60, resizeVerticalStartRef.current.width + deltaPercent));

      setRightPanelWidth(newWidth);
      localStorage.setItem('grammar-test-phrases-right-width', newWidth.toString());
    };

    const handleMouseUp = () => {
      setIsResizingVertical(false);
      resizeVerticalStartRef.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.body.classList.remove('grammar-editor-resizing');
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    // ✅ Use capture phase to intercept events before ReactFlow
    document.addEventListener('mousemove', handleMouseMove, { passive: false, capture: true });
    document.addEventListener('mouseup', handleMouseUp, { capture: true });

    return () => {
      document.removeEventListener('mousemove', handleMouseMove, { capture: true });
      document.removeEventListener('mouseup', handleMouseUp, { capture: true });
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.body.classList.remove('grammar-editor-resizing');
    };
  }, [isResizingVertical]);

  // Tab (linguetta) quando chiuso - centrata in basso
  if (!isOpen) {
    return (
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          height: '32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10,
        }}
      >
        <div
          onClick={() => setIsOpen(true)}
          style={{
            padding: '6px 16px',
            backgroundColor: '#f3f4f6',
            border: '1px solid #e5e7eb',
            borderBottom: 'none',
            borderTopLeftRadius: '6px',
            borderTopRightRadius: '6px',
            cursor: 'pointer',
            userSelect: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 -2px 4px rgba(0, 0, 0, 0.1)',
          }}
        >
          <span style={{
            fontSize: '12px',
            fontWeight: 500,
            color: '#374151',
          }}>
            Test Phrases
          </span>
        </div>
      </div>
    );
  }

  // Pannello completo quando aperto
  return (
    <>
      {/* Splitter handle (barra superiore per ridimensionare) - full width */}
      <div
        onMouseDown={handleSplitterMouseDown}
        style={{
          position: 'absolute',
          bottom: panelHeight,
          left: 0,
          right: 0,
          height: '6px', // ✅ Increased from 4px to 6px for easier capture
          backgroundColor: isResizing ? '#3b82f6' : 'rgba(59, 130, 246, 0.3)', // ✅ Always visible, not transparent
          cursor: 'row-resize',
          zIndex: 50,
          transition: isResizing ? 'none' : 'background-color 0.2s',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          touchAction: 'none',
          pointerEvents: 'auto', // ✅ Ensure mouse events work
        }}
        onMouseEnter={(e) => {
          if (!isResizing) {
            (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(59, 130, 246, 0.6)';
          }
        }}
        onMouseLeave={(e) => {
          if (!isResizing) {
            (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(59, 130, 246, 0.3)';
          }
        }}
      />

      {/* Pannello - full width del canvas */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: `${panelHeight}px`,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#f9fafb',
        borderTop: '1px solid #e5e7eb',
        boxShadow: '0 -4px 12px rgba(0, 0, 0, 0.15)',
        zIndex: 10,
      }}>
        {/* Header con titolo, Test All, stats e X */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          padding: '8px 12px',
          backgroundColor: '#f3f4f6',
          borderBottom: '1px solid #e5e7eb',
          gap: '8px',
          flexShrink: 0,
        }}>
          <span style={{ fontWeight: 600, fontSize: '14px' }}>Test Phrases</span>
          <div style={{ flex: 1 }} />
          <button
            type="button"
            onClick={handleTestAll}
            disabled={!grammar || phrases.length === 0 || isTesting}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 8px',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              backgroundColor: '#fff',
              cursor: (grammar && phrases.length > 0 && !isTesting) ? 'pointer' : 'not-allowed',
              opacity: (grammar && phrases.length > 0 && !isTesting) ? 1 : 0.5,
              fontSize: '12px',
            }}
          >
            <Play size={12} />
            <span>Test All ({phrases.length})</span>
          </button>
          <TestPhraseStats stats={stats} />
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            style={{
              padding: '4px 8px',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              borderRadius: '4px',
            }}
            title="Close panel"
          >
            <X size={16} color="#6b7280" />
          </button>
        </div>

        {/* Add new phrase */}
        <div style={{
          padding: '8px 12px',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          gap: '8px',
          flexShrink: 0,
        }}>
          <input
            type="text"
            value={newPhrase}
            onChange={(e) => setNewPhrase(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleAddPhrase();
              }
            }}
            placeholder="Add test phrase..."
            style={{
              flex: 1,
              padding: '6px 8px',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              fontSize: '14px',
            }}
          />
          <button
            type="button"
            onClick={handleAddPhrase}
            disabled={!newPhrase.trim() || addWouldDuplicate}
            title={addWouldDuplicate ? 'This phrase is already in the list' : undefined}
            style={{
              padding: '6px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              backgroundColor: '#fff',
              cursor: newPhrase.trim() && !addWouldDuplicate ? 'pointer' : 'not-allowed',
              opacity: newPhrase.trim() && !addWouldDuplicate ? 1 : 0.5,
            }}
          >
            <Plus size={16} />
          </button>
        </div>

        {/* Two-column layout with resizable splitter */}
        <div
          ref={containerRef}
          style={{
            display: 'flex',
            flex: 1,
            overflow: 'hidden',
            minHeight: 0,
          }}
        >
          {/* Left: Phrase list */}
          <div style={{
            width: `${100 - rightPanelWidth}%`,
            overflowY: 'auto',
          }}>
            <TestPhraseList
              phrases={phrases}
              selectedPhraseId={selectedPhraseId}
              editingPhraseId={editingPhraseId}
              editDraft={editDraft}
              onSelectPhrase={setSelectedPhraseId}
              onTestPhrase={handleTestSingle}
              onBeginEdit={handleBeginEdit}
              onEditDraftChange={setEditDraft}
              onCommitEdit={handleCommitEdit}
              onCancelEdit={handleCancelEdit}
              onRemovePhrase={handleRemovePhrase}
            />
          </div>

          {/* Vertical splitter */}
          <div
            onMouseDown={handleVerticalSplitterMouseDown}
            style={{
              width: '4px',
              backgroundColor: isResizingVertical ? '#3b82f6' : 'transparent',
              cursor: 'col-resize',
              flexShrink: 0,
              transition: isResizingVertical ? 'none' : 'background-color 0.2s',
              userSelect: 'none',
              WebkitUserSelect: 'none',
              touchAction: 'none',
              zIndex: 10,
              position: 'relative',
            }}
            onMouseEnter={(e) => {
              if (!isResizingVertical) {
                (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(59, 130, 246, 0.5)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isResizingVertical) {
                (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
              }
            }}
          />

          {/* Right: Match details panel */}
          <div style={{
            width: `${rightPanelWidth}%`,
            overflowY: 'auto',
            backgroundColor: '#fff',
            borderLeft: '1px solid #e5e7eb',
          }}>
            {selectedPhrase ? (
              selectedPhrase.result ? (
                <TestPhraseDetails
                  phrase={selectedPhrase}
                  grammar={grammar}
                />
              ) : (
                <div style={{
                  padding: '24px',
                  textAlign: 'center',
                  color: '#6b7280',
                  fontSize: '14px',
                }}>
                  No match details available. Click the play button to test this phrase.
                </div>
              )
            ) : (
              <div style={{
                padding: '24px',
                textAlign: 'center',
                color: '#6b7280',
                fontSize: '14px',
              }}>
                Select a phrase to view match details
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
