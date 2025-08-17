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

function resolveConfirm(state: any, node?: DDTNode, translations?: Record<string, string>, legacyDict?: Record<string, string>, legacyNode?: any): { text: string; key?: string } {
  if (!node) return { text: 'Can you confirm?' };
  // Legacy deref first
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
  // eslint-disable-next-line no-console
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
  const { state, send, reset, setConfig } = useDDTSimulator(template, { typingIndicatorMs: 0, debug: true });
  const { updateTranslation } = useDDTManager();

  const [messages, setMessages] = React.useState<Message[]>([]);
  const lastKeyRef = React.useRef<string>('');
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

  React.useEffect(() => {
    // On mount or reset, show initial ask
    const key = `${state.mode}|${state.currentIndex}|${state.currentSubId || ''}`;
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
      lastKeyRef.current = key;
      return;
    }
    if (lastKeyRef.current === key) return;
    lastKeyRef.current = key;
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
      setMessages((prev) => [...prev, { id: key, type: 'bot', text, stepType: 'ask', textKey: k }]);
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
      const legacyMain = (currentDDT as any)?.mainData;
      const { text, key: k } = resolveConfirm(state, main, translations, legacyDict, legacyMain);
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

  const handleSend = async (text: string) => {
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


