import React from 'react';
import type { AssembledDDT } from '../../../DialogueDataTemplateBuilder/DDTAssembler/currentDDT.types';
import { adaptCurrentToV2 } from '../../../DialogueDataEngine/model/adapters/currentToV2';
import type { DDTNode, DDTTemplateV2 } from '../../../DialogueDataEngine/model/ddt.v2.types';
import { useDDTSimulator } from '../../../DialogueDataEngine/useSimulator';
import { resolveMessage, DEFAULT_FALLBACKS } from '../../../DialogueDataEngine/messageResolver';
import { extractTranslations, getEscalationActions, resolveActionText } from './DDTAdapter';

type Message = { id: string; type: 'bot' | 'user'; text: string; stepType?: string };

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

function resolveAsk(node?: DDTNode, sub?: DDTNode, translations?: Record<string, string>, legacyDict?: Record<string, string>, legacyNode?: any, legacySub?: any): string {
  // Try legacy deref (exact same as legacy simulator)
  if (legacyNode) {
    const actions = getEscalationActions(legacySub || legacyNode, 'start', 1);
    for (const a of actions) {
      const txt = resolveActionText(a, legacyDict || {});
      if (txt) {
        // eslint-disable-next-line no-console
        console.log('[DDE][ask][legacy]', { key: a?.parameters?.[0]?.value, text: txt, node: legacySub?.label || legacyNode?.label });
        return txt;
      }
    }
  }
  if (sub) {
    const key = sub?.steps?.ask?.base;
    return resolveMessage({ textKey: key, translations, fallback: DEFAULT_FALLBACKS.ask(sub.label) });
  }
  if (node) {
    const key = node?.steps?.ask?.base;
    return resolveMessage({ textKey: key, translations, fallback: DEFAULT_FALLBACKS.ask(node.label) });
  }
  return 'Please provide the requested information.';
}

function resolveConfirm(state: any, node?: DDTNode, translations?: Record<string, string>, legacyDict?: Record<string, string>, legacyNode?: any): string {
  if (!node) return 'Can you confirm?';
  // Legacy deref first
  if (legacyNode) {
    const actions = getEscalationActions(legacyNode, 'confirmation', 1);
    for (const a of actions) {
      const txt = resolveActionText(a, legacyDict || {});
      if (txt) return txt;
    }
  }
  const key = node?.steps?.confirm?.base;
  const summary = summarizeValue(state, node);
  const fb = DEFAULT_FALLBACKS.confirm(node.label, summary);
  const resolved = resolveMessage({ textKey: key, translations, fallback: fb });
  // eslint-disable-next-line no-console
  console.log('[DDE][confirm]', { key, text: resolved, node: node?.label });
  return resolved;
}

function resolveSuccess(node?: DDTNode, translations?: Record<string, string>, legacyDict?: Record<string, string>, legacyNode?: any): string {
  if (!node) return 'Saved.';
  // Legacy deref first
  if (legacyNode) {
    const actions = getEscalationActions(legacyNode, 'success', 1);
    for (const a of actions) {
      const txt = resolveActionText(a, legacyDict || {});
      if (txt) return txt;
    }
  }
  const key = node?.steps?.success?.base?.[0];
  const resolved = resolveMessage({ textKey: key, translations, fallback: DEFAULT_FALLBACKS.success(node.label) });
  // eslint-disable-next-line no-console
  console.log('[DDE][success]', { key, text: resolved, node: node?.label });
  return resolved;
}

export default function DDEBubbleChat({ currentDDT, translations }: { currentDDT: AssembledDDT, translations?: Record<string, string> }) {
  const template: DDTTemplateV2 = React.useMemo(() => adaptCurrentToV2(currentDDT), [currentDDT]);
  const { state, send, reset, setConfig } = useDDTSimulator(template, { typingIndicatorMs: 0, debug: true });

  const [messages, setMessages] = React.useState<Message[]>([]);
  const lastKeyRef = React.useRef<string>('');
  const legacyDict = React.useMemo(() => extractTranslations(currentDDT as any, translations), [currentDDT, translations]);

  React.useEffect(() => {
    // On mount or reset, show initial ask
    const key = `${state.mode}|${state.currentIndex}|${state.currentSubId || ''}`;
    const main = getMain(state);
    // Find legacy nodes
    const legacyMain = (currentDDT as any)?.mainData;
    const legacySub = undefined;
    if (!main) return;
    if (!messages.length) {
      const text = resolveAsk(main, undefined, translations, legacyDict, legacyMain, legacySub);
      // eslint-disable-next-line no-console
      console.log('[DDE][ask][init]', { node: legacyMain?.label, text });
      setMessages([{ id: 'init', type: 'bot', text, stepType: 'ask' }]);
      lastKeyRef.current = key;
      return;
    }
    if (lastKeyRef.current === key) return;
    lastKeyRef.current = key;
    // Push appropriate bot message for new state
    if (state.mode === 'CollectingMain') {
      const sub = undefined;
      const legacyMain = (currentDDT as any)?.mainData;
      const legacySub = undefined;
      const text = resolveAsk(main, sub, translations, legacyDict, legacyMain, legacySub);
      setMessages((prev) => [...prev, { id: key, type: 'bot', text, stepType: 'ask' }]);
    } else if (state.mode === 'CollectingSub') {
      const sub = getSub(state);
      // find legacy sub by id label match
      const legacyMain = (currentDDT as any)?.mainData;
      const candidate = (legacyMain?.subData || []).find((s: any) => (s?.id === sub?.id) || (String(s?.label || '').toLowerCase() === String(sub?.label || '').toLowerCase()));
      const text = resolveAsk(main, sub, translations, legacyDict, candidate || legacyMain, candidate);
      // eslint-disable-next-line no-console
      console.log('[DDE][ask][sub]', { sub: candidate?.label || sub?.label, text });
      setMessages((prev) => [...prev, { id: key, type: 'bot', text, stepType: 'ask' }]);
    } else if (state.mode === 'ConfirmingMain') {
      const legacyMain = (currentDDT as any)?.mainData;
      const text = resolveConfirm(state, main, translations, legacyDict, legacyMain);
      setMessages((prev) => [...prev, { id: key, type: 'bot', text, stepType: 'confirm' }]);
    } else if (state.mode === 'NotConfirmed') {
      const opts = (main?.subs || []).join(', ');
      const tKey = main?.steps?.notConfirmed?.prompts?.[0];
      const text = resolveMessage({ textKey: tKey, translations, fallback: `What do you want to fix?${opts ? ` (choose:${opts})` : ''}` });
      setMessages((prev) => [...prev, { id: key, type: 'bot', text, stepType: 'notConfirmed' }]);
    } else if (state.mode === 'SuccessMain') {
      const legacyMain = (currentDDT as any)?.mainData;
      const text = resolveSuccess(main, translations, legacyDict, legacyMain);
      setMessages((prev) => [...prev, { id: key, type: 'bot', text, stepType: 'success' }]);
      // Auto-advance engine by sending an empty acknowledgment to move to next main
      // after a short delay so the success bubble remains visible.
      setTimeout(() => { void send(''); }, 10);
    }
  }, [state]);

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
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.type === 'bot' ? 'justify-start' : 'justify-end'}`}>
            <div className={`${m.type === 'bot' ? 'bg-gray-100 border border-gray-200' : 'bg-purple-600 text-white'} max-w-xs lg:max-w-md px-4 py-2 rounded-lg`}>
              <div className="text-sm">{m.text}</div>
              {m.type === 'bot' && m.stepType && (
                <div className="text-[11px] opacity-70 font-mono mt-1">{m.stepType}</div>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="border-t p-3 bg-gray-50">
        <input
          type="text"
          className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
          placeholder="Type response... (e.g., 'mario', 'no', 'choose:lastname')"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              const el = e.currentTarget as HTMLInputElement;
              const v = el.value;
              el.value = '';
              void handleSend(v);
            }
          }}
        />
      </div>
    </div>
  );
}


