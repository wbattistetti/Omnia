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
import { useNewFlowOrchestrator } from './hooks/useNewFlowOrchestrator';
import { Node, Edge } from 'reactflow';
import { NodeData, EdgeData } from '../Flowchart/types/flowTypes';

// getStepIcon and getStepColor moved to chatSimulatorUtils.tsx
// Helper functions for message resolution moved to messageResolvers.ts
// UserMessage and BotMessage components moved to separate files

interface DDEBubbleChatProps {
  currentDDT?: AssembledDDT | null; // Optional for flow mode
  translations?: Record<string, string>;
  onUpdateDDT?: (updater: (ddt: AssembledDDT) => AssembledDDT) => void;
  // Flow mode props
  mode?: 'single-ddt' | 'flow';
  nodes?: Node<NodeData>[]; // For flow mode
  edges?: Edge<EdgeData>[]; // For flow mode
}

export default function DDEBubbleChat({
  currentDDT: propCurrentDDT,
  translations,
  onUpdateDDT,
  mode = 'single-ddt',
  nodes: propNodes,
  edges: propEdges
}: DDEBubbleChatProps) {
  // Flow orchestrator reads directly from window.__flowNodes in flow mode
  // This ensures it always has the latest nodes/rows order without polling or synchronization
  // Using new compiler-based orchestrator
  const getCurrentNodes = React.useCallback(() => {
    if (mode === 'flow') {
      try {
        return (window as any).__flowNodes || propNodes || [];
      } catch {
        return propNodes || [];
      }
    }
    return propNodes || [];
  }, [mode, propNodes]);

  const getCurrentEdges = React.useCallback(() => {
    if (mode === 'flow') {
      try {
        return (window as any).__flowEdges || propEdges || [];
      } catch {
        return propEdges || [];
      }
    }
    return propEdges || [];
  }, [mode, propEdges]);

  const orchestrator = useNewFlowOrchestrator({
    nodes: getCurrentNodes(),
    edges: getCurrentEdges(),
    onMessage: (message) => {
      // Add message to chat
      setMessages((prev) => [...prev, {
        id: message.id || `msg-${Date.now()}-${Math.random()}`,
        type: 'bot',
        text: message.text,
        stepType: message.stepType || 'message',
        color: getStepColor(message.stepType || 'message')
      }]);
    },
    onDDTStart: (ddt) => {
      // Set DDT as active
      if (onUpdateDDT) {
        onUpdateDDT(() => ddt);
      }
    },
    onDDTComplete: () => {
      // DDT completed, continue flow
      // Engine will automatically continue
    }
  });

  // Determine current DDT: from orchestrator in flow mode, from prop in single-ddt mode
  const currentDDT = React.useMemo(() => {
    if (mode === 'flow') {
      return orchestrator.currentDDT;
    }
    return propCurrentDDT || null;
  }, [mode, orchestrator.currentDDT, propCurrentDDT]);

  // Template for DDT simulator (only when DDT is active)
  const template: DDTTemplateV2 = React.useMemo(() => {
    if (!currentDDT) {
      // Return empty template when no DDT
      return { schemaVersion: '2', metadata: { id: 'DDT_Empty', label: 'Empty' }, nodes: [] } as DDTTemplateV2;
    }
    try {
      return adaptCurrentToV2(currentDDT);
    } catch {
      return { schemaVersion: '2', metadata: { id: 'DDT_Error', label: 'Error' }, nodes: [] } as DDTTemplateV2;
    }
  }, [currentDDT]);
  // Enable simulator debug logs only when explicitly toggled
  const debugEnabled = (() => { try { return localStorage.getItem('debug.chatSimulator') === '1'; } catch { return false; } })();
  const { state, send, reset, setConfig } = useDDTSimulator(template, { typingIndicatorMs: 0, debug: debugEnabled });

  // Re-initialize simulator when template changes
  // This ensures the simulator is ready when currentDDT changes
  React.useEffect(() => {
    if (!template || template.metadata.id === 'DDT_Empty' || template.metadata.id === 'DDT_Error') {
      return;
    }

    // Re-initialize simulator with new template
    // reset() calls setState(initEngine(template)) which updates state asynchronously
    // The useEffect that emits messages will re-run when state changes
    reset();
    // Reset the initial message emitted flag for new DDT
    initialMessageEmittedRef.current = '';

    try {
      if (debugEnabled) {
        console.log('[DDEBubbleChat][SIMULATOR_RESET]', {
          templateId: template.metadata.id,
          templateLabel: template.metadata.label,
          nodesCount: template.nodes?.length || 0
        });
      }
    } catch { }
  }, [template, reset, debugEnabled]);

  // Message ID generator with counter to ensure uniqueness
  const messageIdCounter = React.useRef(0);
  const generateMessageId = (prefix: string = 'msg') => {
    messageIdCounter.current += 1;
    return `${prefix}-${Date.now()}-${messageIdCounter.current}`;
  };
  // updateTranslation moved to useMessageEditing hook

  const [messages, setMessages] = React.useState<Message[]>([]);
  const lastKeyRef = React.useRef<string>('');
  // Track if initial message has been emitted for current DDT (synchronous check)
  const initialMessageEmittedRef = React.useRef<string>('');
  // Track no-input escalation counts per (mainIdx|subId|mode)
  const [noInputCounts, setNoInputCounts] = React.useState<Record<string, number>>({});
  // Track no-match escalation counts per (mainIdx|subId|mode)
  const [noMatchCounts, setNoMatchCounts] = React.useState<Record<string, number>>({});
  const legacyDict = React.useMemo(() => {
    if (!currentDDT) return {};
    return extractTranslations(currentDDT as any, translations);
  }, [currentDDT, translations]);

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

  // Non-interactive messages are now handled directly by orchestrator.onMessage callback

  // Expose variables globally for ConditionEditor and other panels (flow mode)
  React.useEffect(() => {
    if (mode === 'flow') {
      try {
        (window as any).__omniaVars = { ...(orchestrator.variableStore || {}) };
      } catch { }
    }
  }, [mode, orchestrator.variableStore]);

  // Auto-focus input when DDT becomes active
  React.useEffect(() => {
    if (currentDDT && inlineInputRef.current) {
      setTimeout(() => {
        try {
          inlineInputRef.current?.focus({ preventScroll: true } as any);
        } catch { }
      }, 100);
    }
  }, [currentDDT]);

  // Handle DDT completion (when DDT finishes, advance flow in flow mode)
  React.useEffect(() => {
    if (mode === 'flow' && state.mode === 'Completed' && orchestrator.isRunning) {
      orchestrator.onDDTCompleted();
    }
  }, [mode, state.mode, orchestrator.isRunning, orchestrator.onDDTCompleted]);

  // Removed auto-start - user must click Start button manually
  // This ensures tasks are loaded in memory before compilation

  React.useEffect(() => {
    // Skip if no DDT active
    if (!currentDDT) {
      try {
        const debugEnabled = localStorage.getItem('debug.chatSimulator') === '1';
        if (debugEnabled) {
          console.log('[DDEBubbleChat][NO_DDT]', {
            orchestratorCurrentDDT: orchestrator.currentDDT,
            propCurrentDDT: propCurrentDDT,
            mode
          });
        }
      } catch { }
      return;
    }

    try {
      const debugEnabled = localStorage.getItem('debug.chatSimulator') === '1';
      if (debugEnabled) {
        console.log('[DDEBubbleChat][DDT_ACTIVE]', {
          ddtId: currentDDT?.id,
          ddtLabel: currentDDT?.label,
          stateMode: state.mode,
          messagesCount: messages.length,
          mainDataKind: Array.isArray(currentDDT?.mainData)
            ? currentDDT.mainData[0]?.kind
            : (currentDDT?.mainData as any)?.kind,
          firstMainSteps: Array.isArray(currentDDT?.mainData)
            ? (currentDDT.mainData[0]?.steps ? Object.keys(currentDDT.mainData[0].steps) : [])
            : ((currentDDT?.mainData as any)?.steps ? Object.keys((currentDDT.mainData as any).steps) : [])
        });
      }
    } catch { }

    // On mount or reset, show initial ask
    const key = getPositionKey(state);
    const main = getMain(state);
    // Find legacy nodes
    const legacyMain = Array.isArray((currentDDT as any)?.mainData)
      ? (currentDDT as any)?.mainData[0]
      : (currentDDT as any)?.mainData;
    const legacySub = undefined;

    // If simulator is not ready yet (main is undefined), wait for it
    // reset() updates state asynchronously, so this useEffect will re-run when state changes
    // Single clean path: always wait for simulator to be ready before emitting
    if (!main) {
      try {
        const debugEnabled = localStorage.getItem('debug.chatSimulator') === '1';
        if (debugEnabled) {
          console.log('[DDEBubbleChat][WAITING_FOR_SIMULATOR]', {
            hasCurrentDDT: !!currentDDT,
            ddtId: currentDDT?.id,
            stateMode: state.mode,
            note: 'Waiting for simulator state to update after reset() - useEffect will re-run automatically'
          });
        }
      } catch { }
      return; // Wait for state to update after reset() - useEffect will re-run automatically
    }
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

    // Check if we've already emitted the initial message for this DDT
    // Use a ref to track emission synchronously (messages.length is async)
    const ddtKey = currentDDT?.id || '';
    const hasEmittedInitial = initialMessageEmittedRef.current === ddtKey && ddtKey !== '';

    if (!hasEmittedInitial) {
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
      // resolveAsk handles both intent (start) and data extraction (ask) uniformly
      // At this point, main is guaranteed to be available (we returned early if not)
      try {
        const debugEnabled = localStorage.getItem('debug.chatSimulator') === '1';

        if (debugEnabled) {
            console.log('[DDEBubbleChat][INIT_MESSAGE]', {
            hasMain: !!main,
            hasLegacyMain: !!legacyMain,
            mainKind: main?.kind,
            legacyMainKind: legacyMain?.kind,
            legacyMainSteps: legacyMain?.steps ? Object.keys(legacyMain.steps) : [],
            currentDDT: currentDDT ? {
              id: currentDDT.id,
              label: currentDDT.label,
              mainDataCount: Array.isArray(currentDDT.mainData) ? currentDDT.mainData.length : (currentDDT.mainData ? 1 : 0),
              firstMainKind: Array.isArray(currentDDT.mainData) ? currentDDT.mainData[0]?.kind : (currentDDT.mainData as any)?.kind
            } : null,
            ddtKey,
            hasEmittedInitial,
            initialMessageEmittedRef: initialMessageEmittedRef.current
          });
        }

        const { text, key: resolvedKey, stepType } = resolveAsk(main, undefined, translations, legacyDict, legacyMain, legacySub);

        if (debugEnabled) {
          console.log('[DDEBubbleChat][RESOLVE_ASK_RESULT]', {
            hasText: !!text,
            textLength: text?.length || 0,
            textPreview: text?.substring(0, 100),
            key: resolvedKey,
            stepType,
            willSetMessage: !!text
          });
        }

        // Use stepType from resolveAsk if provided, otherwise default to 'ask'
        const finalStepType = stepType || 'ask';

        if (text) {
          setMessages([{
            id: 'init',
            type: 'bot',
            text,
            stepType: finalStepType,
            textKey: resolvedKey,
            color: getStepColor(finalStepType)
          }]);
          lastKeyRef.current = resolvedKey || (finalStepType === 'start' ? 'start' : 'ask.base');
          initialMessageEmittedRef.current = ddtKey; // Mark as emitted for this DDT

          if (debugEnabled) {
            console.log('[DDEBubbleChat][MESSAGE_SET]', {
              stepType: finalStepType,
              textLength: text.length,
              lastKeyRef: lastKeyRef.current,
              ddtKey
            });
          }
        } else {
          if (debugEnabled) {
            console.warn('[DDEBubbleChat][NO_MESSAGE]', {
              reason: 'resolveAsk returned empty text',
              mainKind: main?.kind,
              legacyMainKind: legacyMain?.kind
            });
          }
        }
      } catch (err) {
        console.error('[DDEBubbleChat][INIT_MESSAGE_ERROR]', err);
      }
      return;
    } else {
      try {
        const debugEnabled = localStorage.getItem('debug.chatSimulator') === '1';
        if (debugEnabled) {
          console.log('[DDEBubbleChat][INIT_MESSAGE_SKIP]', {
            reason: 'Already emitted initial message for this DDT',
            ddtKey,
            initialMessageEmittedRef: initialMessageEmittedRef.current,
            messagesLength: messages.length
          });
        }
      } catch { }
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
  }, [state, currentDDT, translations, legacyDict, mode, messages, send]);

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

  // Combined messages: all messages from orchestrator
  const allMessages = React.useMemo(() => {
    return messages;
  }, [messages]);

  return (
    <div className="h-full flex flex-col bg-white">
      <div className="border-b p-3 bg-gray-50 flex items-center gap-2">
        {mode === 'flow' && (
          <>
            <button
              onClick={orchestrator.isRunning ? orchestrator.stop : orchestrator.start}
              className="px-2 py-1 text-xs rounded border bg-gray-100 border-gray-300 text-gray-700"
            >
              {orchestrator.isRunning ? 'Stop' : 'Start'}
            </button>
            {orchestrator.isRunning && orchestrator.currentNodeId && (
              <span className="text-xs text-gray-600">
                Node: {orchestrator.getCurrentNode()?.data?.title || orchestrator.currentNodeId}
              </span>
            )}
          </>
        )}
        <button
          onClick={() => {
            reset();
            setMessages([]);
            lastKeyRef.current = '';
            messageIdCounter.current = 0;
            initialMessageEmittedRef.current = '';
            setNoMatchCounts({});
            setNoInputCounts({});
            if (mode === 'flow') {
              orchestrator.reset();
            }
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
      {/* Error message from orchestrator (e.g., DDT validation failed) */}
      {mode === 'flow' && orchestrator.error && (
        <div className="mx-4 mt-2 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
          <AlertTriangle size={16} className="flex-shrink-0 text-red-600 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-800">Errore DDT</p>
            <p className="text-xs text-red-700 mt-1">{orchestrator.error}</p>
            <p className="text-xs text-red-600 mt-2">
              Il debugger si è fermato. Controlla che il DDT sia configurato correttamente per questo atto.
            </p>
          </div>
        </div>
      )}
      <div className="flex-1 overflow-y-auto p-4 space-y-3" ref={scrollContainerRef}>
        {allMessages.map((m) => {
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
        {/* Input field DOPO tutti i messaggi - show when DDT is active OR task is WaitingUserInput */}
        {(currentDDT || (mode === 'flow' && orchestrator.currentTask?.state === 'WaitingUserInput')) && (
          <div className="bg-white border border-gray-300 rounded-lg p-2 shadow-sm max-w-xs lg:max-w-md w-full mt-3">
            <input
              type="text"
              className="w-full px-2 py-1 border rounded focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
              ref={inlineInputRef}
              onFocus={() => {
                try { inlineInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch { }
              }}
              placeholder={mode === 'flow' && !currentDDT ? 'In attesa di atto interattivo...' : 'Type response...'}
              value={inlineDraft}
              onChange={(e) => setInlineDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const v = inlineDraft.trim();
                  if (!v) return;

                  // If there's a DDT active, use handleSend (existing DDT flow)
                  if (currentDDT) {
                    // 🆕 Freeze text: save it so we can clear input when it appears as a message
                    sentTextRef.current = v;
                    void handleSend(v);
                  } else if (mode === 'flow' && orchestrator.currentTask?.state === 'WaitingUserInput') {
                    // NEW: Handle input for WaitingUserInput task (interactive message in recovery)
                    // Add user message to chat
                    setMessages((prev) => [...prev, {
                      id: `msg-${Date.now()}-${Math.random()}`,
                      type: 'user',
                      text: v,
                      matchStatus: 'match'
                    }]);

                    // Complete the waiting task
                    const waitingTask = orchestrator.currentTask;
                    if (waitingTask && orchestrator.onDDTCompleted) {
                      // For interactive messages, we don't have a retrievalState, so use 'saturated'
                      orchestrator.onDDTCompleted('saturated');
                    }

                    // Clear input
                    sentTextRef.current = v;
                    setInlineDraft('');
                  }
                  // Focus will be handled after input is cleared (see useEffect below)
                }
              }}
              autoFocus
              disabled={!currentDDT && !(mode === 'flow' && orchestrator.currentTask?.state === 'WaitingUserInput')}
            />
          </div>
        )}
      </div>
      {/* input spostato nella nuvoletta inline sotto l'ultimo prompt */}
    </div>
  );
}

