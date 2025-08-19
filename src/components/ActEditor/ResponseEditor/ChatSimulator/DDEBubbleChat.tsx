import React from 'react';
import type { AssembledDDT } from '../../../DialogueDataTemplateBuilder/DDTAssembler/currentDDT.types';
import { adaptCurrentToV2 } from '../../../DialogueDataEngine/model/adapters/currentToV2';
import type { DDTNode, DDTTemplateV2 } from '../../../DialogueDataEngine/model/ddt.v2.types';
import { useDDTSimulator } from '../../../DialogueDataEngine/useSimulator';
import { resolveMessage, DEFAULT_FALLBACKS } from '../../../DialogueDataEngine/messageResolver';
import { extractTranslations, getEscalationActions, resolveActionText } from './DDTAdapter';
import { useDDTManager } from '../../../../context/DDTManagerContext';
import { Pencil, Check, X as XIcon } from 'lucide-react';

type Message = { id: string; type: 'bot' | 'user'; text: string; stepType?: string; textKey?: string };

function getMain(state: any): DDTNode | undefined {
  const id = state?.plan?.order?.[state?.currentIndex];
  return state?.plan?.byId?.[id];
}

function getSub(state: any): DDTNode | undefined {
  const sid = state?.currentSubId;
  return sid ? state?.plan?.byId?.[sid] : undefined;
}

function summarizeValue(state: any, main: DDTNode | undefined): string {
  if (!main) return '';
  const v = state?.memory?.[main.id]?.value;
  if (!v) return '';
  if (typeof v === 'string') return v;
  try { return Object.values(v).filter(Boolean).join(' '); } catch { return ''; }
}

function resolveAsk(node?: DDTNode, sub?: DDTNode, translations?: Record<string, string>, legacyDict?: Record<string, string>, legacyNode?: any, legacySub?: any): { text: string; key?: string } {
  // Try legacy deref (exact same as legacy simulator)
  if (legacyNode) {
    const actions = getEscalationActions(legacySub || legacyNode, 'start', 1);
    for (const a of actions) {
      const txt = resolveActionText(a, legacyDict || {});
      if (txt) {
        // eslint-disable-next-line no-console
        console.log('[DDE][ask][legacy]', { key: a?.parameters?.[0]?.value, text: txt, node: legacySub?.label || legacyNode?.label });
        return { text: txt, key: a?.parameters?.[0]?.value };
      }
    }
  }
  if (sub) {
    const key = sub?.steps?.ask?.base;
    return { text: resolveMessage({ textKey: key, translations, fallback: DEFAULT_FALLBACKS.ask(sub.label) }), key };
  }
  if (node) {
    const key = node?.steps?.ask?.base;
    return { text: resolveMessage({ textKey: key, translations, fallback: DEFAULT_FALLBACKS.ask(node.label) }), key };
  }
  return { text: 'Please provide the requested information.' };
}

function resolveConfirm(state: any, node?: DDTNode, legacyDict?: Record<string, string>, legacyNode?: any): { text: string; key?: string } {
  if (!node) return { text: 'Can you confirm?' };
  if (legacyNode) {
    const actions = getEscalationActions(legacyNode, 'confirmation', 1);
    for (const a of actions) {
      const txt = resolveActionText(a, legacyDict || {});
      if (txt) return { text: txt, key: a?.parameters?.[0]?.value };
    }
  }
  const key = node?.steps?.confirm?.base;
  const summary = summarizeValue(state, node);
  const trimmed = String(summary || '').trim();
  const resolved = trimmed ? `${trimmed}. Corretto?` : 'Corretto?';
  console.log('[DDE][confirm]', { key, text: resolved, node: node?.label });
  return { text: resolved, key };
}

function resolveSuccess(node?: DDTNode, translations?: Record<string, string>, legacyDict?: Record<string, string>, legacyNode?: any): { text: string; key?: string } {
  if (!node) return { text: 'Saved.' };
  // Legacy deref first
  if (legacyNode) {
    const actions = getEscalationActions(legacyNode, 'success', 1);
    for (const a of actions) {
      const txt = resolveActionText(a, legacyDict || {});
      if (txt) return { text: txt, key: a?.parameters?.[0]?.value };
    }
  }
  const key = node?.steps?.success?.base?.[0];
  const resolved = resolveMessage({ textKey: key, translations, fallback: DEFAULT_FALLBACKS.success(node.label) });
  // eslint-disable-next-line no-console
  console.log('[DDE][success]', { key, text: resolved, node: node?.label });
  return { text: resolved, key };
}

export default function DDEBubbleChat({ currentDDT, translations }: { currentDDT: AssembledDDT, translations?: Record<string, string> }) {
  const template: DDTTemplateV2 = React.useMemo(() => adaptCurrentToV2(currentDDT), [currentDDT]);
  // Enable simulator debug logs only when explicitly toggled
  const debugEnabled = (() => { try { return localStorage.getItem('debug.chatSimulator') === '1'; } catch { return false; } })();
  const { state, send, reset, setConfig } = useDDTSimulator(template, { typingIndicatorMs: 0, debug: debugEnabled });
  const { updateTranslation } = useDDTManager();

  const [messages, setMessages] = React.useState<Message[]>([]);
  const lastKeyRef = React.useRef<string>('');
  // Track no-input escalation counts per (mainIdx|subId|mode)
  const [noInputCounts, setNoInputCounts] = React.useState<Record<string, number>>({});
  // Track no-match escalation counts per (mainIdx|subId|mode)
  const [noMatchCounts, setNoMatchCounts] = React.useState<Record<string, number>>({});
  const legacyDict = React.useMemo(() => extractTranslations(currentDDT as any, translations), [currentDDT, translations]);
  const [hoveredId, setHoveredId] = React.useState<string | null>(null);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [draftText, setDraftText] = React.useState<string>('');
  const [inlineDraft, setInlineDraft] = React.useState<string>('');
  const scrollContainerRef = React.useRef<HTMLDivElement | null>(null);
  const inlineInputRef = React.useRef<HTMLInputElement | null>(null);
  const ensureInlineFocus = React.useCallback((retries: number = 8) => {
    const attempt = (i: number) => {
      const el = inlineInputRef.current;
      if (!el) return;
      try { el.focus({ preventScroll: true } as any); } catch {}
      if (document.activeElement !== el && i < retries) {
        setTimeout(() => attempt(i + 1), 50);
      }
    };
    requestAnimationFrame(() => attempt(0));
  }, []);
  const lastBotIndex = React.useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i]?.type === 'bot') return i;
    }
    return -1;
  }, [messages]);

  // Helper to check if a main's subs are all present in memory
  const allSubsPresent = React.useCallback((node: any, memory: any) => {
    if (!node || !Array.isArray(node.subs) || node.subs.length === 0) return true;
    for (const sid of node.subs) {
      const mv = memory?.[sid]?.value;
      if (mv === undefined || mv === null || String(mv).length === 0) return false;
    }
    return true;
  }, []);

  const getPositionKey = React.useCallback((s: any): string => (
    `${s.mode}|${s.currentIndex}|${s.currentSubId || 'main'}`
  ), []);

  const pickReask = (keys: string[] | undefined, count: number): string | undefined =>
    Array.isArray(keys) && keys.length > 0 ? keys[Math.min(count, keys.length - 1)] || keys[0] : undefined;

  React.useEffect(() => {
    // On mount or reset, show initial ask
    const key = getPositionKey(state);
    const main = getMain(state);
    // Find legacy nodes
    const legacyMain = (currentDDT as any)?.mainData;
    const legacySub = undefined;
    if (!main) return;
    // If we are collecting a main but it is already saturated (all subs present), auto-advance to confirmation
    if (state.mode === 'CollectingMain' && main && Array.isArray((main as any).subs) && (main as any).subs.length > 0) {
      const allPresent = (main as any).subs.every((sid: string) => {
        const m = (state as any)?.memory?.[sid];
        return m && m.value !== undefined && m.value !== null && String(m.value).length > 0;
      });
      if (allPresent) {
        void send('');
        return;
      }
    }

    if (!messages.length) {
      const { text, key } = resolveAsk(main, undefined, translations, legacyDict, legacyMain, legacySub);
      // eslint-disable-next-line no-console
      console.log('[DDE][ask][init]', { node: legacyMain?.label, text });
      setMessages([{ id: 'init', type: 'bot', text, stepType: 'ask', textKey: key }]);
      lastKeyRef.current = key || 'ask.base';
      return;
    }
    if (lastKeyRef.current === key) return;
    lastKeyRef.current = key || getPositionKey(state);
    // Push appropriate bot message for new state
    if (state.mode === 'CollectingMain') {
      // If already saturated, jump to confirmation without showing ask
      if (main && Array.isArray((main as any).subs) && (main as any).subs.length > 0) {
        const allPresent = (main as any).subs.every((sid: string) => {
          const m = (state as any)?.memory?.[sid];
          return m && m.value !== undefined && m.value !== null && String(m.value).length > 0;
        });
        if (allPresent) {
          void send('');
          return;
        }
      }
      const sub = undefined;
      const legacyMain = (currentDDT as any)?.mainData;
      const legacySub = undefined;
      const { text, key: k } = resolveAsk(main, sub, translations, legacyDict, legacyMain, legacySub);
      setMessages((prev) => [...prev, { id: key || String(Date.now()), type: 'bot', text, stepType: 'ask', textKey: k }]);
    } else if (state.mode === 'CollectingSub') {
      const sub = getSub(state);
      // find legacy sub by id label match
      const legacyMain = (currentDDT as any)?.mainData;
      const candidate = (legacyMain?.subData || []).find((s: any) => (s?.id === sub?.id) || (String(s?.label || '').toLowerCase() === String(sub?.label || '').toLowerCase()));
      const { text, key: k } = resolveAsk(main, sub, translations, legacyDict, candidate || legacyMain, candidate);
      // eslint-disable-next-line no-console
      console.log('[DDE][ask][sub]', { sub: candidate?.label || sub?.label, text });
      setMessages((prev) => [...prev, { id: key, type: 'bot', text, stepType: 'ask', textKey: k }]);
    } else if (state.mode === 'ConfirmingMain') {
      // If the main has REQUIRED subs missing, ask the first missing REQUIRED sub instead of confirming
      if (main && Array.isArray((main as any).subs) && (main as any).subs.length > 0) {
        const firstMissingRequired = (main as any).subs.find((sid: string) => {
          const sub = state.plan?.byId?.[sid];
          if (!sub || sub.required === false) return false;
          const mv = state.memory?.[sid]?.value;
          return mv === undefined || mv === null || String(mv).length === 0;
        });
        if (firstMissingRequired) {
          const sub = state.plan?.byId?.[firstMissingRequired];
          const legacyMain = (currentDDT as any)?.mainData;
          const candidate = (legacyMain?.subData || []).find((s: any) => (s?.id === sub?.id) || (String(s?.label || '').toLowerCase() === String(sub?.label || '').toLowerCase()));
          const { text, key: k } = resolveAsk(main, sub, translations, legacyDict, candidate || legacyMain, candidate);
          setMessages((prev) => [...prev, { id: key || String(Date.now()), type: 'bot', text, stepType: 'ask', textKey: k }]);
          return;
        }
      }
      const legacyMain = (currentDDT as any)?.mainData;
      const { text, key: k } = resolveConfirm(state, main, legacyDict, legacyMain);
      setMessages((prev) => [...prev, { id: key, type: 'bot', text, stepType: 'confirm', textKey: k }]);
    } else if (state.mode === 'NotConfirmed') {
      const opts = (main?.subs || []).join(', ');
      const tKey = main?.steps?.notConfirmed?.prompts?.[0];
      const text = resolveMessage({ textKey: tKey, translations, fallback: `What do you want to fix?${opts ? ` (choose:${opts})` : ''}` });
      setMessages((prev) => [...prev, { id: key, type: 'bot', text, stepType: 'notConfirmed', textKey: tKey }]);
    } else if (state.mode === 'SuccessMain') {
      const legacyMain = (currentDDT as any)?.mainData;
      const { text, key: k } = resolveSuccess(main, translations, legacyDict, legacyMain);
      setMessages((prev) => [...prev, { id: key, type: 'bot', text, stepType: 'success', textKey: k }]);
      // Auto-advance engine by sending an empty acknowledgment to move to next main
      // after a short delay so the success bubble remains visible.
      setTimeout(() => { void send(''); }, 10);
    }
  }, [state]);

  // Keep the inline input minimally in view when it exists
  React.useEffect(() => {
    const id = setTimeout(() => {
      try {
        inlineInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } catch {}
      // After scroll, try to focus the inline input
      try { ensureInlineFocus(); } catch {}
    }, 0);
    return () => clearTimeout(id);
  }, [messages.length, lastBotIndex, ensureInlineFocus]);

  const isClearlyInvalidForKind = (kind: string | undefined, text: string, subLabel?: string): boolean => {
    const t = String(text || '').trim();
    const k = String(kind || '').toLowerCase();
    if (!t) return false;
    if (k === 'date') {
      // Require at least numbers; if no digits at all, clearly invalid
      return !/[0-9]/.test(t);
    }
    if (k === 'email') {
      return !/.+@.+\..+/.test(t);
    }
    if (k === 'phone') {
      // Require at least 5 digits
      const digits = (t.match(/\d/g) || []).length;
      return digits < 5;
    }
    if (k === 'name') {
      const sub = String(subLabel || '').toLowerCase();
      if (/first/.test(sub) || /last/.test(sub)) {
        // sub First/Last name: accept a single word alphabetic
        return !/^[A-Za-zÀ-ÿ'\-]{2,}$/i.test(t);
      }
      // full name: require two words
      return !/^[A-Za-zÀ-ÿ'\-]{2,}(\s+[A-Za-zÀ-ÿ'\-]{2,})+$/i.test(t);
    }
    if (k === 'address') {
      // Require some letters and at least one space (heuristic). 'xxxx' or symbols-only -> invalid
      const letters = /[A-Za-zÀ-ÿ]/.test(t);
      const hasWordBoundary = /\s/.test(t);
      return !(letters && hasWordBoundary);
    }
    return false;
  };

  const handleSend = async (text: string) => {
    const trimmed = String(text || '');
    // Empty input → use configured noInput escalation per current mode
    if (trimmed.trim().length === 0) {
      const main = getMain(state);
      const sub = getSub(state);
      const keyId = getPositionKey(state);
      const count = noInputCounts[keyId] || 0;
      let keys: string[] | undefined;
      let stepType: 'ask' | 'confirm' = 'ask';
      if (state.mode === 'ConfirmingMain') {
        stepType = 'confirm';
        keys = (main as any)?.steps?.confirm?.noInput as string[] | undefined;
      } else if (state.mode === 'CollectingSub') {
        keys = (sub as any)?.steps?.ask?.reaskNoInput as string[] | undefined;
      } else if (state.mode === 'CollectingMain') {
        keys = (main as any)?.steps?.ask?.reaskNoInput as string[] | undefined;
      }
      const chosenKey = pickReask(keys, count);
      if (chosenKey) {
        const txt = resolveMessage({ textKey: chosenKey, translations, fallback: stepType === 'confirm' ? 'Corretto?' : DEFAULT_FALLBACKS.ask((sub?.label || main?.label || '') as any) });
        setMessages((prev) => [...prev, { id: `noInput-${Date.now()}`, type: 'bot', text: txt, stepType, textKey: chosenKey }]);
        setNoInputCounts((prev) => ({ ...prev, [keyId]: Math.min(count + 1, Array.isArray(keys) ? keys.length : 1) }));
        return; // don't advance engine on empty input
      }
      // If no configured keys, just do nothing
      return;
    }

    // Non-empty: if clearly invalid for current kind, show noMatch escalation and do not advance
    // Skip this check during confirmation; the engine handles yes/no.
    if (state.mode !== 'ConfirmingMain') {
      const main = getMain(state);
      const sub = getSub(state);
      const kind = String((sub || main)?.kind || '').toLowerCase();
      // If collecting main Name with subs, allow partial (first) and let engine route to Last name
      const allowPartialName = kind === 'name' && state.mode === 'CollectingMain' && Array.isArray((main as any)?.subs) && (main as any).subs.length > 0;
      if (!allowPartialName && isClearlyInvalidForKind(kind, trimmed, getSub(state)?.label)) {
        const keyId = getPositionKey(state);
        const count = noMatchCounts[keyId] || 0;
        let keys: string[] | undefined;
        let stepType: 'ask' | 'confirm' = 'ask';
        if (state.mode === 'CollectingSub') {
          keys = (sub as any)?.steps?.ask?.reaskNoMatch as string[] | undefined;
        } else if (state.mode === 'CollectingMain') {
          keys = (main as any)?.steps?.ask?.reaskNoMatch as string[] | undefined;
        }
        const chosenKey = pickReask(keys, count);
        if (chosenKey) {
          const txt = resolveMessage({ textKey: chosenKey, translations, fallback: DEFAULT_FALLBACKS.ask((sub?.label || main?.label || '') as any) });
          // echo user then bot re-ask
          setMessages((prev) => [...prev, { id: String(Date.now()), type: 'user', text }, { id: `noMatch-${Date.now()}`, type: 'bot', text: txt, stepType, textKey: chosenKey }]);
          setNoMatchCounts((prev) => ({ ...prev, [keyId]: Math.min(count + 1, Array.isArray(keys) ? keys.length : 1) }));
          return;
        }
      }
    }

    // Non-empty input: reset counter for this position and send to engine
    const keyId = getPositionKey(state);
    setNoInputCounts((prev) => ({ ...prev, [keyId]: 0 }));
    setNoMatchCounts((prev) => ({ ...prev, [keyId]: 0 }));
    setMessages((prev) => [...prev, { id: String(Date.now()), type: 'user', text }]);
    await send(text);
  };

  return (
    <div className="h-full flex flex-col bg-white">
      <div className="border-b p-3 bg-gray-50 flex items-center gap-2">
        <button
          onClick={() => { reset(); setMessages([]); lastKeyRef.current = ''; }}
          className="px-2 py-1 text-xs rounded border bg-gray-100 border-gray-300 text-gray-700"
        >
          Reset
        </button>
        <button
          onClick={() => setConfig({ typingIndicatorMs: 150 })}
          className="px-2 py-1 text-xs rounded border bg-gray-100 border-gray-300 text-gray-700"
        >
          Typing 150ms
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3" ref={scrollContainerRef}>
        {messages.map((m, idx) => (
          <React.Fragment key={m.id}>
            {m.type === 'bot' && idx === lastBotIndex ? (
              <div className="flex flex-col items-start">
                <div
                  className={`bg-gray-100 border border-gray-200 relative max-w-xs lg:max-w-md px-4 py-2 rounded-lg`}
                  onMouseEnter={() => setHoveredId(m.id)}
                  onMouseLeave={() => setHoveredId((prev) => (prev === m.id ? null : prev))}
                >
                  {editingId === m.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        autoFocus
                        className="w-full px-2 py-1 border rounded text-sm"
                        value={draftText}
                        onChange={(e) => setDraftText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            if (m.textKey) {
                              try { updateTranslation(m.textKey, draftText); } catch {}
                              setMessages((prev) => prev.map(x => x.id === m.id ? { ...x, text: draftText } : x));
                            }
                            setEditingId(null);
                          } else if (e.key === 'Escape') {
                            setEditingId(null);
                            setDraftText('');
                          }
                        }}
                        onBlur={() => {
                          if (m.textKey) {
                            try { updateTranslation(m.textKey, draftText); } catch {}
                            setMessages((prev) => prev.map(x => x.id === m.id ? { ...x, text: draftText } : x));
                          }
                          setEditingId(null);
                        }}
                      />
                      <button className="p-1 text-green-600" title="Save" onMouseDown={(e) => e.preventDefault()} onClick={() => {
                        if (m.textKey) {
                          try { updateTranslation(m.textKey, draftText); } catch {}
                          setMessages((prev) => prev.map(x => x.id === m.id ? { ...x, text: draftText } : x));
                        }
                        setEditingId(null);
                      }}>
                        <Check size={16} />
                      </button>
                      <button className="p-1 text-red-600" title="Cancel" onMouseDown={(e) => e.preventDefault()} onClick={() => { setEditingId(null); setDraftText(''); }}>
                        <XIcon size={16} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div
                        className="text-sm cursor-pointer"
                        title={m.textKey ? 'Click to edit' : undefined}
                        onClick={() => {
                          if (m.textKey) {
                            setEditingId(m.id);
                            setDraftText(m.text);
                          }
                        }}
                      >
                        {m.text}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        {m.stepType && <div className="text-[11px] opacity-70 font-mono">{m.stepType}</div>}
                      </div>
                      {m.textKey && hoveredId === m.id && (
                        <button className="absolute -top-2 -right-2 bg-white border border-gray-300 rounded-full p-1 shadow-sm" title="Edit" onClick={() => { setEditingId(m.id); setDraftText(m.text); }}>
                          <Pencil size={14} />
                        </button>
                      )}
                    </>
                  )}
                </div>
                <div className="bg-white border border-gray-300 rounded-lg p-2 shadow-sm max-w-xs lg:max-w-md w-full mt-3">
                  <input
                    type="text"
                    className="w-full px-2 py-1 border rounded focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                    ref={inlineInputRef}
                    onFocus={() => {
                      try { inlineInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch {}
                    }}
                    placeholder="Type response..."
                    value={inlineDraft}
                    onChange={(e) => setInlineDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const v = inlineDraft;
                        setInlineDraft('');
                        void handleSend(v);
                        // After sending, keep focus for the next input
                        setTimeout(() => ensureInlineFocus(), 0);
                      }
                    }}
                    autoFocus
                  />
                </div>
              </div>
            ) : (
              <div
                className={`flex justify-start`}
                onMouseEnter={() => setHoveredId(m.id)}
                onMouseLeave={() => setHoveredId((prev) => (prev === m.id ? null : prev))}
              >
                <div
                  className={`${m.type === 'bot' ? 'bg-gray-100 border border-gray-200 text-gray-900' : 'bg-purple-50 border border-purple-300 text-purple-900'} relative max-w-xs lg:max-w-md px-4 py-2 rounded-lg`}
                >
              {editingId === m.id ? (
                <div className="flex items-center gap-2">
                  <input
                    autoFocus
                    className="w-full px-2 py-1 border rounded text-sm"
                    value={draftText}
                    onChange={(e) => setDraftText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        if (m.textKey) {
                          try { updateTranslation(m.textKey, draftText); } catch {}
                          setMessages((prev) => prev.map(x => x.id === m.id ? { ...x, text: draftText } : x));
                        }
                        setEditingId(null);
                      } else if (e.key === 'Escape') {
                        setEditingId(null);
                        setDraftText('');
                      }
                    }}
                    onBlur={() => {
                      if (m.textKey) {
                        try { updateTranslation(m.textKey, draftText); } catch {}
                        setMessages((prev) => prev.map(x => x.id === m.id ? { ...x, text: draftText } : x));
                      }
                      setEditingId(null);
                    }}
                  />
                  <button
                    className="p-1 text-green-600"
                    title="Save"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      if (m.textKey) {
                        try { updateTranslation(m.textKey, draftText); } catch {}
                        setMessages((prev) => prev.map(x => x.id === m.id ? { ...x, text: draftText } : x));
                      }
                      setEditingId(null);
                    }}
                  >
                    <Check size={16} />
                  </button>
                  <button
                    className="p-1 text-red-600"
                    title="Cancel"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => { setEditingId(null); setDraftText(''); }}
                  >
                    <XIcon size={16} />
                  </button>
                </div>
              ) : (
                <>
                  <div
                    className="text-sm cursor-pointer"
                    title={m.textKey ? 'Click to edit' : undefined}
                    onClick={() => {
                      if (m.textKey) {
                        setEditingId(m.id);
                        setDraftText(m.text);
                      }
                    }}
                  >
                    {m.text}
                  </div>
                  {(
                    <div className="flex items-center gap-2 mt-1">
                      {m.stepType && <div className="text-[11px] opacity-70 font-mono">{m.stepType}</div>}
                    </div>
                  )}
                  {m.textKey && hoveredId === m.id && (
                    <button
                      className="absolute -top-2 -right-2 bg-white border border-gray-300 rounded-full p-1 shadow-sm"
                      title="Edit"
                      onClick={() => { setEditingId(m.id); setDraftText(m.text); }}
                    >
                      <Pencil size={14} />
                    </button>
                  )}
                </>
              )}
            </div>
              </div>
            )}
          </React.Fragment>
        ))}
      </div>
      {/* input spostato nella nuvoletta inline sotto l'ultimo prompt */}
    </div>
  );
}


