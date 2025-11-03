import React from 'react';
import type { AssembledDDT } from '../DialogueDataTemplateBuilder/DDTAssembler/currentDDT.types';
import { adaptCurrentToV2 } from '../DialogueDataEngine/model/adapters/currentToV2';
import type { DDTNode, DDTTemplateV2 } from '../DialogueDataEngine/model/ddt.v2.types';
import { useDDTSimulator } from '../DialogueDataEngine/useSimulator';
// Removed resolveMessage and DEFAULT_FALLBACKS - using translations directly like StepEditor
import { extractTranslations, resolveActionText } from './DDTAdapter';
import { AlertTriangle } from 'lucide-react';
import UserMessage, { type Message } from './UserMessage';
import BotMessage from './BotMessage';
import { getStepColor } from './chatSimulatorUtils';
import {
  getMain,
  getSub,
  resolveAsk,
  resolveConfirm,
  resolveSuccess
} from './messageResolvers';
import { useMessageEditing } from './hooks/useMessageEditing';
import { useMessageHandling } from './hooks/useMessageHandling';

// getStepIcon and getStepColor moved to chatSimulatorUtils.tsx
// Helper functions for message resolution moved to messageResolvers.ts
// UserMessage and BotMessage components moved to separate files

export default function DDEBubbleChat({
  currentDDT,
  translations,
  onUpdateDDT
}: {
  currentDDT: AssembledDDT;
  translations?: Record<string, string>;
  onUpdateDDT?: (updater: (ddt: AssembledDDT) => AssembledDDT) => void;
}) {
  const template: DDTTemplateV2 = React.useMemo(() => adaptCurrentToV2(currentDDT), [currentDDT]);
  // Enable simulator debug logs only when explicitly toggled
  const debugEnabled = (() => { try { return localStorage.getItem('debug.chatSimulator') === '1'; } catch { return false; } })();
  const { state, send, reset, setConfig } = useDDTSimulator(template, { typingIndicatorMs: 0, debug: debugEnabled });

  // Message ID generator with counter to ensure uniqueness
  const messageIdCounter = React.useRef(0);
  const generateMessageId = (prefix: string = 'msg') => {
    messageIdCounter.current += 1;
    return `${prefix}-${Date.now()}-${messageIdCounter.current}`;
  };
  // updateTranslation moved to useMessageEditing hook

  const [messages, setMessages] = React.useState<Message[]>([]);
  const lastKeyRef = React.useRef<string>('');
  // Track no-input escalation counts per (mainIdx|subId|mode)
  const [noInputCounts, setNoInputCounts] = React.useState<Record<string, number>>({});
  // Track no-match escalation counts per (mainIdx|subId|mode)
  const [noMatchCounts, setNoMatchCounts] = React.useState<Record<string, number>>({});
  const legacyDict = React.useMemo(() => extractTranslations(currentDDT as any, translations), [currentDDT, translations]);

  // 🆕 Track sent text to clear input when it appears as a message
  const sentTextRef = React.useRef<string>('');

  // Message editing state and handlers (extracted to hook)
  const {
    hoveredId,
    setHoveredId,
    editingId,
    draftText,
    inlineDraft,
    setInlineDraft,
    scrollContainerRef,
    inlineInputRef,
    ensureInlineFocus,
    handleEdit,
    handleSave,
    handleCancel
  } = useMessageEditing({
    messages,
    setMessages,
    currentDDT,
    onUpdateDDT
  });
  // Removed lastBotIndex - input field is now rendered after all messages

  const getPositionKey = React.useCallback((s: any): string => (
    `${s.mode}|${s.currentIndex}|${s.currentSubId || 'main'}`
  ), []);

  React.useEffect(() => {
    // On mount or reset, show initial ask
    const key = getPositionKey(state);
    const main = getMain(state);
    // Find legacy nodes
    const legacyMain = Array.isArray((currentDDT as any)?.mainData)
      ? (currentDDT as any)?.mainData[0]
      : (currentDDT as any)?.mainData;
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
      // First, check if there's an introduction step in the root DDT
      const introductionStep = (currentDDT as any)?.introduction;
      if (introductionStep && Array.isArray(introductionStep.escalations) && introductionStep.escalations.length > 0) {
        const introEscalation = introductionStep.escalations[0];
        const introActions = introEscalation?.actions || [];
        const introTexts: string[] = [];
        const introKeys: string[] = [];

        for (const action of introActions) {
          const actionText = resolveActionText(action, { ...legacyDict, ...(translations || {}) });
          if (actionText) {
            introTexts.push(actionText);
            const textKey = action?.parameters?.find((p: any) => p?.parameterId === 'text')?.value;
            if (textKey) introKeys.push(textKey);
          }
        }

        // Show all introduction messages
        if (introTexts.length > 0) {
          const introMessages = introTexts.map((text, idx) => ({
            id: `intro-${idx}`,
            type: 'bot' as const,
            text,
            stepType: 'introduction' as const,
            textKey: introKeys[idx],
            color: getStepColor('introduction')
          }));
          setMessages(introMessages);
          lastKeyRef.current = introKeys[0] || 'introduction';
          return;
        }
      }

      // No introduction, show first main ask
      const { text, key } = resolveAsk(main, undefined, translations, legacyDict, legacyMain, legacySub);
      setMessages([{ id: 'init', type: 'bot', text, stepType: 'ask', textKey: key, color: getStepColor('ask') }]);
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
      const legacyMain = Array.isArray((currentDDT as any)?.mainData)
        ? (currentDDT as any)?.mainData[0]
        : (currentDDT as any)?.mainData;
      const legacySub = undefined;
      const { text, key: k } = resolveAsk(main, sub, translations, legacyDict, legacyMain, legacySub);
      setMessages((prev) => [...prev, { id: key || generateMessageId('bot'), type: 'bot', text, stepType: 'ask', textKey: k, color: getStepColor('ask') }]);
    } else if (state.mode === 'CollectingSub') {
      const sub = getSub(state);
      // find legacy sub by id label match
      const legacyMain = Array.isArray((currentDDT as any)?.mainData)
        ? (currentDDT as any)?.mainData[0]
        : (currentDDT as any)?.mainData;
      const candidate = (legacyMain?.subData || []).find((s: any) => (s?.id === sub?.id) || (String(s?.label || '').toLowerCase() === String(sub?.label || '').toLowerCase()));
      const { text, key: k } = resolveAsk(main, sub, translations, legacyDict, candidate || legacyMain, candidate);
      setMessages((prev) => [...prev, { id: key, type: 'bot', text, stepType: 'ask', textKey: k, color: getStepColor('ask') }]);
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
          const legacyMain = Array.isArray((currentDDT as any)?.mainData)
            ? (currentDDT as any)?.mainData[0]
            : (currentDDT as any)?.mainData;
          const candidate = (legacyMain?.subData || []).find((s: any) => (s?.id === sub?.id) || (String(s?.label || '').toLowerCase() === String(sub?.label || '').toLowerCase()));
          const { text, key: k } = resolveAsk(main, sub, translations, legacyDict, candidate || legacyMain, candidate);
          setMessages((prev) => [...prev, { id: key || generateMessageId('bot'), type: 'bot', text, stepType: 'ask', textKey: k, color: getStepColor('ask') }]);
          return;
        }
      }
      const legacyMain = Array.isArray((currentDDT as any)?.mainData)
        ? (currentDDT as any)?.mainData[0]
        : (currentDDT as any)?.mainData;
      const { text, key: k } = resolveConfirm(state, main, legacyDict, legacyMain, translations);
      setMessages((prev) => [...prev, { id: key, type: 'bot', text, stepType: 'confirm', textKey: k, color: getStepColor('confirm') }]);
    } else if (state.mode === 'NotConfirmed') {
      const tKey = main?.steps?.notConfirmed?.prompts?.[0];
      const mergedTranslations = { ...(legacyDict || {}), ...(translations || {}) };
      // Use translations directly like StepEditor does: translations[key] || key
      const text = typeof tKey === 'string' ? (mergedTranslations[tKey] || tKey) : '';
      setMessages((prev) => [...prev, { id: key, type: 'bot', text, stepType: 'notConfirmed', textKey: tKey, color: getStepColor('notConfirmed') }]);
    } else if (state.mode === 'SuccessMain') {
      const legacyMain = Array.isArray((currentDDT as any)?.mainData)
        ? (currentDDT as any)?.mainData[0]
        : (currentDDT as any)?.mainData;
      const { text, key: k } = resolveSuccess(main, translations, legacyDict, legacyMain);
      setMessages((prev) => [...prev, { id: key, type: 'bot', text, stepType: 'success', textKey: k, color: getStepColor('success') }]);
      // Auto-advance engine by sending an empty acknowledgment to move to next main
      // 🆕 Instant in debug mode, no delay
      void send('');
    }
  }, [state]);

  // 🆕 Clear input when sent text appears as a user message (frozen label)
  // This happens after handleSend adds the message to messages, before engine processes
  React.useEffect(() => {
    if (sentTextRef.current && messages.length > 0) {
      // Find the last user message that matches the sent text
      const matchingMessage = [...messages]
        .reverse()
        .find(m => m.type === 'user' && m.text === sentTextRef.current);

      if (matchingMessage) {
        // Message found in chat - text is now frozen/visible, clear input
        setInlineDraft('');
        sentTextRef.current = ''; // Reset ref
        // Ensure focus after clearing (new text box ready for next input)
        // 🆕 Use requestAnimationFrame for instant focus without delay
        requestAnimationFrame(() => ensureInlineFocus());
      }
    }
  }, [messages, setInlineDraft, ensureInlineFocus]);

  // Keep the inline input minimally in view when it exists
  React.useEffect(() => {
    // 🆕 Use requestAnimationFrame for instant execution, no setTimeout delay
    const rafId = requestAnimationFrame(() => {
      try {
        inlineInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } catch { }
      // After scroll, try to focus the inline input
      try { ensureInlineFocus(); } catch { }
    });
    return () => cancelAnimationFrame(rafId);
  }, [messages.length, ensureInlineFocus]);

  // Message handling logic (extracted to hook)
  const { handleSend } = useMessageHandling({
    state,
    send,
    currentDDT,
    translations,
    legacyDict,
    messages,
    setMessages,
    noInputCounts,
    setNoInputCounts,
    noMatchCounts,
    setNoMatchCounts,
    generateMessageId,
    getPositionKey
  });

  // handleSend function moved to useMessageHandling hook (see hooks/useMessageHandling.ts)

  return (
    <div className="h-full flex flex-col bg-white">
      <div className="border-b p-3 bg-gray-50 flex items-center gap-2">
        <button
          onClick={() => {
            reset();
            setMessages([]);
            lastKeyRef.current = '';
            messageIdCounter.current = 0;
            setNoMatchCounts({});
            setNoInputCounts({});
          }}
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
        {messages.map((m) => {
          // Render user message
          if (m.type === 'user') {
            return (
              <UserMessage
                key={m.id}
                message={m}
                editingId={editingId}
                draftText={draftText}
                onEdit={handleEdit}
                onSave={handleSave}
                onCancel={handleCancel}
                onHover={setHoveredId}
              />
            );
          }

          // Render bot message
          if (m.type === 'bot') {
            return (
              <BotMessage
                key={m.id}
                message={m}
                editingId={editingId}
                draftText={draftText}
                hoveredId={hoveredId}
                onEdit={handleEdit}
                onSave={handleSave}
                onCancel={handleCancel}
                onHover={setHoveredId}
              />
            );
          }

          // Render system message (legacy - dovrebbe essere raro ora)
          if (m.type === 'system') {
            return (
              <div key={m.id} className="flex items-center gap-2 text-xs text-yellow-700">
                <AlertTriangle size={12} className="flex-shrink-0 text-yellow-600" />
                <span>{m.text}</span>
              </div>
            );
          }

          return null;
        })}
        {/* Input field DOPO tutti i messaggi */}
        <div className="bg-white border border-gray-300 rounded-lg p-2 shadow-sm max-w-xs lg:max-w-md w-full mt-3">
          <input
            type="text"
            className="w-full px-2 py-1 border rounded focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
            ref={inlineInputRef}
            onFocus={() => {
              try { inlineInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch { }
            }}
            placeholder="Type response..."
            value={inlineDraft}
            onChange={(e) => setInlineDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const v = inlineDraft.trim();
                if (!v) return;
                // 🆕 Freeze text: save it so we can clear input when it appears as a message
                // The text will become a frozen message label, then engine processes it
                sentTextRef.current = v;
                void handleSend(v);
                // Focus will be handled after input is cleared (see useEffect below)
              }
            }}
            autoFocus
          />
        </div>
      </div>
      {/* input spostato nella nuvoletta inline sotto l'ultimo prompt */}
    </div>
  );
}

