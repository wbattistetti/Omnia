import React from 'react';
import { flushSync } from 'react-dom';
import type { AssembledDDT } from '../DialogueDataTemplateBuilder/DDTAssembler/currentDDT.types';
import { AlertTriangle } from 'lucide-react';
import UserMessage, { type Message } from './UserMessage';
import BotMessage from './BotMessage';
import { getStepColor } from './chatSimulatorUtils';
import { useMessageEditing } from './hooks/useMessageEditing';
import { useNewFlowOrchestrator } from './hooks/useNewFlowOrchestrator';
import { Node, Edge } from 'reactflow';
import { NodeData, EdgeData } from '../Flowchart/types/flowTypes';
import { extractTranslations, resolveActionText } from './DDTAdapter';
import { adaptCurrentToV2 } from '../DialogueDataEngine/model/adapters/currentToV2';
import { useDDTSimulator } from '../DialogueDataEngine/useSimulator';
import { getMain, getSub, resolveAsk, resolveConfirm, resolveSuccess, resolveEscalation, findOriginalNode } from './messageResolvers';

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
  const renderCountRef = React.useRef(0);
  renderCountRef.current += 1;

  // Flow orchestrator reads directly from window.__flowNodes in flow mode
  // This ensures it always has the latest nodes/rows order without polling or synchronization
  // Using new compiler-based orchestrator
  const getCurrentNodes = React.useCallback(() => {
    const nodes = mode === 'flow'
      ? ((window as any).__flowNodes || propNodes || [])
      : (propNodes || []);
    return nodes;
  }, [mode, propNodes]);

  const getCurrentEdges = React.useCallback(() => {
    const edges = mode === 'flow'
      ? ((window as any).__flowEdges || propEdges || [])
      : (propEdges || []);
    return edges;
  }, [mode, propEdges]);

  // Track last user input message ID for updating matchStatus
  const lastUserMessageIdRef = React.useRef<string | null>(null);
  const lastUserInputRef = React.useRef<string | null>(null);

  // Create stable stub orchestrator for single-ddt mode to avoid re-renders
  const stubOrchestratorRef = React.useRef({
    currentDDT: null,
    variableStore: {},
    onUserInputProcessedRef: { current: null }
  });

  // Store onUpdateDDT in ref to avoid re-creating orchestratorConfig
  const onUpdateDDTRef = React.useRef(onUpdateDDT);
  React.useEffect(() => {
    onUpdateDDTRef.current = onUpdateDDT;
  }, [onUpdateDDT]);

  // Stabilize nodes and edges to prevent re-renders
  const stableNodesRef = React.useRef(propNodes || []);
  const stableEdgesRef = React.useRef(propEdges || []);
  React.useEffect(() => {
    // Only update if length or IDs actually changed
    const nodesChanged = (propNodes?.length || 0) !== (stableNodesRef.current?.length || 0) ||
      propNodes?.some((n, i) => n?.id !== stableNodesRef.current[i]?.id);
    const edgesChanged = (propEdges?.length || 0) !== (stableEdgesRef.current?.length || 0) ||
      propEdges?.some((e, i) => e?.id !== stableEdgesRef.current[i]?.id);

    if (nodesChanged) {
      stableNodesRef.current = propNodes || [];
    }
    if (edgesChanged) {
      stableEdgesRef.current = propEdges || [];
    }
  }, [propNodes, propEdges]);

  // Create stable empty config for single-ddt mode (never changes)
  const emptyConfigRef = React.useRef({ nodes: [], edges: [], onMessage: () => { }, onDDTStart: () => { }, onDDTComplete: () => { } });

  const orchestratorConfig = React.useMemo(() => {
    if (mode === 'flow') {
      const nodes = mode === 'flow'
        ? ((window as any).__flowNodes || stableNodesRef.current || [])
        : (stableNodesRef.current || []);
      const edges = mode === 'flow'
        ? ((window as any).__flowEdges || stableEdgesRef.current || [])
        : (stableEdgesRef.current || []);
      return {
        nodes,
        edges,
        onMessage: (message: any) => {
          console.log('[DDEBubbleChat] ═══════════════════════════════════════════════════════');
          console.log('[DDEBubbleChat] 📨 MESSAGE RECEIVED FROM FLOW ORCHESTRATOR');
          console.log('[DDEBubbleChat] ═══════════════════════════════════════════════════════');
          console.log('[DDEBubbleChat] onMessage received', {
            messageText: message.text?.substring(0, 100),
            fullText: message.text,
            messageId: message.id,
            stepType: message.stepType,
            escalationNumber: message.escalationNumber
          });
          const uniqueId = message.id ? `${message.id}-${Date.now()}-${Math.random()}` : `msg-${Date.now()}-${Math.random()}`;
          flushSync(() => {
            setMessages((prev) => {
              const existingIndex = prev.findIndex(m => m.text === message.text && m.type === 'bot');
              if (existingIndex >= 0) {
                console.log('[DDEBubbleChat] ⚠️ Message already exists, skipping', { text: message.text });
                return prev;
              }
              console.log('[DDEBubbleChat] ✅ Adding message to state', {
                messageCount: prev.length + 1,
                text: message.text?.substring(0, 50)
              });
              return [...prev, {
                id: uniqueId,
                type: 'bot',
                text: message.text,
                stepType: message.stepType || 'message',
                escalationNumber: message.escalationNumber,
                color: getStepColor(message.stepType || 'message')
              }];
            });
          });
          console.log('[DDEBubbleChat] ✅ Message added successfully');
        },
        onDDTStart: (ddt: any) => {
          if (onUpdateDDTRef.current) {
            onUpdateDDTRef.current(() => ddt);
          }
        },
        onDDTComplete: () => { }
      };
    }
    // Return stable empty config for single-ddt mode
    return emptyConfigRef.current;
  }, [mode]); // Remove propNodes and propEdges from dependencies

  // Always call hook (React rules), but use stub in single-ddt mode
  const flowOrchestrator = useNewFlowOrchestrator(orchestratorConfig);
  const orchestrator = mode === 'flow' ? flowOrchestrator : stubOrchestratorRef.current;

  // Only log orchestrator changes in flow mode
  React.useEffect(() => {
    // Orchestrator change tracking removed - not needed
  }, [mode, flowOrchestrator]);

  // Set up callback to update user message matchStatus
  React.useEffect(() => {
    if (orchestrator.onUserInputProcessedRef) {
      orchestrator.onUserInputProcessedRef.current = (input: string, matchStatus: 'match' | 'noMatch' | 'partialMatch') => {
        // Update the last user message matchStatus
        if (lastUserMessageIdRef.current && lastUserInputRef.current === input) {
          setMessages((prev) => prev.map((msg) =>
            msg.id === lastUserMessageIdRef.current && msg.type === 'user'
              ? { ...msg, matchStatus }
              : msg
          ));
        }
      };
    }
    return () => {
      if (orchestrator.onUserInputProcessedRef) {
        orchestrator.onUserInputProcessedRef.current = null;
      }
    };
  }, [orchestrator.onUserInputProcessedRef]);

  // Determine current DDT: from orchestrator in flow mode, from prop in single-ddt mode
  const currentDDT = React.useMemo(() => {
    const result = mode === 'flow' ? (orchestrator?.currentDDT || null) : (propCurrentDDT || null);
    return result;
  }, [mode, propCurrentDDT, mode === 'flow' ? orchestrator?.currentDDT : null]);

  // Message ID generator with counter to ensure uniqueness
  const messageIdCounter = React.useRef(0);
  const generateMessageId = (prefix: string = 'msg') => {
    messageIdCounter.current += 1;
    return `${prefix}-${Date.now()}-${messageIdCounter.current}`;
  };

  // Messages state - must be declared before useEffect that uses it
  const [messages, setMessages] = React.useState<Message[]>([]);


  // Use DDT simulator for single-ddt mode to handle user input
  const [template, setTemplate] = React.useState<any>(null);

  React.useEffect(() => {
    if (mode === 'single-ddt' && currentDDT) {
      // ✅ projectLanguage è OBBLIGATORIO - nessun fallback
      let projectLanguage: string;
      try {
        const lang = localStorage.getItem('project.lang');
        if (!lang) {
          throw new Error('[DDEBubbleChat] project.lang not found in localStorage. Cannot adapt DDT without project language.');
        }
        projectLanguage = lang;
      } catch (err) {
        console.error('[DDEBubbleChat] Failed to get project language:', err);
        setTemplate(null);
        return;
      }

      adaptCurrentToV2(currentDDT, projectLanguage)
        .then((result) => {
          setTemplate(result);
        })
        .catch((err) => {
          console.error('[DDEBubbleChat] Error adapting DDT to V2', err);
          setTemplate(null);
        });
    } else {
      setTemplate(null);
    }
  }, [mode, currentDDT]);

  const debugEnabled = React.useMemo(() => {
    try {
      return localStorage.getItem('debug.chatSimulator') === '1';
    } catch {
      return false;
    }
  }, []);

  // ✅ Always call useDDTSimulator (React hooks rules) - use empty template if not ready
  // The hook will automatically reset when template changes from empty to valid
  const emptyTemplate = React.useMemo(() => ({ nodes: [], introduction: undefined }), []);
  const simulatorTemplate = mode === 'single-ddt' && template ? template : emptyTemplate;
  const simulator = useDDTSimulator(simulatorTemplate, { typingIndicatorMs: 0, debug: debugEnabled });

  // Track last position key to avoid duplicate messages
  const lastKeyRef = React.useRef<string>('');

  // Update user message with grammarMissing flag after simulator processes input
  React.useEffect(() => {
    if (!simulator?.state || mode !== 'single-ddt' || !template || !lastUserMessageIdRef.current) return;

    const currentState = simulator.state;
    if (currentState.grammarMissing) {
      setMessages((prev) => prev.map((msg) =>
        msg.id === lastUserMessageIdRef.current && msg.type === 'user'
          ? { ...msg, grammarMissing: true }
          : msg
      ));
    }
  }, [simulator?.state?.grammarMissing, mode]);

  // Helper to get position key from simulator state
  // Include counters to trigger when escalation happens (same position, different message)
  const getPositionKey = React.useCallback((state: any) => {
    if (!state) return '';
    const main = getMain(state);
    const sub = getSub(state);
    const targetNode = sub || main;
    const targetNodeId = targetNode?.id;
    const nodeState = targetNodeId ? state.nodeStates?.[targetNodeId] : null;

    // Include step and counters in the key to trigger on escalation
    const step = nodeState?.step || 'Normal';
    const noMatchCounter = nodeState?.counters?.noMatch || 0;
    const noInputCounter = nodeState?.counters?.noInput || 0;

    if (sub) {
      const mainNodeState = state.nodeStates?.[main?.id];
      const mainKey = main ? `${main.id}:${mainNodeState?.step || 'Normal'}:${mainNodeState?.counters?.noMatch || 0}:${mainNodeState?.counters?.noInput || 0}` : 'main';
      const subKey = `${sub.id}:${step}:${noMatchCounter}:${noInputCounter}`;
      return `${mainKey}/${subKey}`;
    }
    const mainKey = main ? `${main.id}:${step}:${noMatchCounter}:${noInputCounter}` : 'main';
    return mainKey;
  }, []);

  // Listen to simulator state changes and add messages to chat
  React.useEffect(() => {
    if (mode !== 'single-ddt' || !simulator || !template) return;

    const state = simulator.state;
    const key = getPositionKey(state);

    // Skip if same position - only add message when position changes
    if (lastKeyRef.current === key) {
      return;
    }
    lastKeyRef.current = key;

    const main = getMain(state);
    const sub = getSub(state);
    const legacyMain = Array.isArray(currentDDT?.mainData) ? currentDDT.mainData[0] : currentDDT?.mainData;
    const legacyDict = extractTranslations(currentDDT as any, translations);

    // Get current node state to check for NoMatch/NoInput
    // IMPORTANT: NoMatch/NoInput are always on the main, not the sub
    // So check main first for NoMatch/NoInput, then use targetNode for other steps
    const mainNodeState = main?.id ? state.nodeStates?.[main.id] : null;
    const mainStep = mainNodeState?.step;
    const mainCounters = mainNodeState?.counters || {};

    const targetNode = sub || main;
    const targetNodeId = targetNode?.id;
    const nodeState = targetNodeId ? state.nodeStates?.[targetNodeId] : null;
    const targetStep = nodeState?.step;
    const targetCounters = nodeState?.counters || {};

    // Use main step for NoMatch/NoInput, target step for others
    const step = (mainStep === 'NoMatch' || mainStep === 'NoInput') ? mainStep : targetStep;
    const counters = (mainStep === 'NoMatch' || mainStep === 'NoInput') ? mainCounters : targetCounters;

    // Resolve and add message based on current mode and step
    if (step === 'NoMatch') {
      // Mostra sempre il normale messaggio di escalation NoMatch
      // Il badge "Grammar missing!" viene mostrato sul messaggio utente, non qui
      const escalationLevel = (counters.noMatch || 0) + 1;
      const legacyNode = legacyMain;
      const { text, key: textKey } = resolveEscalation(legacyNode, 'noMatch', escalationLevel, legacyDict, translations);
      if (text) {
        setMessages((prev) => [...prev, {
          id: `sim-${Date.now()}-${Math.random()}`,
          type: 'bot',
          text,
          stepType: 'noMatch',
          textKey,
          color: getStepColor('noMatch')
        }]);
      }
    } else if (step === 'NoInput') {
      const escalationLevel = (counters.noInput || 0) + 1;
      const legacyNode = legacyMain;
      const { text, key: textKey } = resolveEscalation(legacyNode, 'noInput', escalationLevel, legacyDict, translations);
      if (text) {
        setMessages((prev) => [...prev, {
          id: `sim-${Date.now()}-${Math.random()}`,
          type: 'bot',
          text,
          stepType: 'noInput',
          textKey,
          color: getStepColor('noInput')
        }]);
      }
    } else if (state.mode === 'CollectingMain' || state.mode === 'CollectingSub') {
      // Trova legacySub se c'è un sub attivo
      const legacySub = sub?.id && currentDDT ? findOriginalNode(currentDDT, undefined, sub.id) : undefined;
      const { text, key: textKey } = resolveAsk(main, sub, translations, legacyDict, legacyMain, legacySub);
      if (text) {
        setMessages((prev) => {
          // Rimuovi 'init' solo se esiste un altro messaggio ask diverso da 'init'
          const hasOtherAskMessage = prev.some(
            m => m.id !== 'init' && (m.stepType === 'ask' || m.stepType === 'start')
          );
          const filtered = hasOtherAskMessage ? prev.filter(m => m.id !== 'init') : prev;
          return [...filtered, {
            id: `sim-${Date.now()}-${Math.random()}`,
            type: 'bot',
            text,
            stepType: 'ask',
            textKey,
            color: getStepColor('ask')
          }];
        });
      }
    } else if (state.mode === 'ConfirmingMain') {
      const { text, key: textKey } = resolveConfirm(state, main, legacyDict, legacyMain, translations);
      if (text) {
        setMessages((prev) => [...prev, {
          id: `sim-${Date.now()}-${Math.random()}`,
          type: 'bot',
          text,
          stepType: 'confirmation',
          textKey,
          color: getStepColor('confirmation')
        }]);
      }
    } else if (state.mode === 'SuccessMain') {
      const { text, key: textKey } = resolveSuccess(main, translations, legacyDict, legacyMain);
      if (text) {
        setMessages((prev) => [...prev, {
          id: `sim-${Date.now()}-${Math.random()}`,
          type: 'bot',
          text,
          stepType: 'success',
          textKey,
          color: getStepColor('success')
        }]);
      }
    }
  }, [mode, simulator?.state?.mode, simulator?.state?.currentIndex, simulator?.state?.currentSubId, simulator?.state?.nodeStates, currentDDT, translations]);

  // updateTranslation moved to useMessageEditing hook

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

  // Non-interactive messages are now handled directly by orchestrator.onMessage callback

  // Expose variables globally for ConditionEditor and other panels (flow mode)
  React.useEffect(() => {
    if (mode === 'flow') {
      try {
        (window as any).__omniaVars = { ...(orchestrator.variableStore || {}) };
      } catch { }
    }
  }, [mode, orchestrator.variableStore]);

  // Show initial message when DDT is available in single-ddt mode
  React.useEffect(() => {
    if (mode === 'single-ddt' && currentDDT && messages.length === 0) {
      console.log('[DDEBubbleChat] ════════════════════════════════════════');
      console.log('[DDEBubbleChat] useEffect - showing initial message for single-ddt mode', {
        hasCurrentDDT: !!currentDDT,
        currentDDTId: currentDDT?.id,
        currentDDTLabel: currentDDT?.label,
        translationsKeys: translations ? Object.keys(translations).length : 0,
        messagesCount: messages.length
      });

      const legacyDict = extractTranslations(currentDDT as any, translations);
      console.log('[DDEBubbleChat] legacyDict extracted', {
        legacyDictKeys: Object.keys(legacyDict).length,
        translationsKeys: translations ? Object.keys(translations).length : 0
      });

      // Try to find the first main data node
      const mainData = Array.isArray(currentDDT?.mainData)
        ? currentDDT.mainData[0]
        : currentDDT?.mainData;

      console.log('[DDEBubbleChat] mainData check', {
        hasMainData: !!mainData,
        mainDataLabel: mainData?.label,
        mainDataSteps: mainData?.steps ? Object.keys(mainData.steps) : [],
        hasStartStep: !!mainData?.steps?.start,
        startStepEscalations: mainData?.steps?.start?.escalations?.length || 0
      });

      if (mainData) {
        // Try to get the start step prompt
        const startStep = mainData?.steps?.start;
        if (startStep && Array.isArray(startStep.escalations) && startStep.escalations.length > 0) {
          const firstEscalation = startStep.escalations[0];
          const firstAction = firstEscalation?.actions?.[0];

          console.log('[DDEBubbleChat] firstAction check', {
            hasFirstEscalation: !!firstEscalation,
            hasFirstAction: !!firstAction,
            actionId: firstAction?.actionId,
            actionInstanceId: firstAction?.actionInstanceId,
            hasParameters: !!firstAction?.parameters,
            parametersCount: firstAction?.parameters?.length || 0
          });

          if (firstAction) {
            const mergedDict = { ...legacyDict, ...(translations || {}) };
            console.log('[DDEBubbleChat] Resolving action text', {
              mergedDictKeys: Object.keys(mergedDict).length,
              sampleMergedKeys: Object.keys(mergedDict).slice(0, 5)
            });

            const text = resolveActionText(firstAction, mergedDict);

            console.log('[DDEBubbleChat] Action text resolved', {
              text,
              textLength: text?.length,
              found: !!text
            });

            if (text) {
              const textKey = firstAction?.parameters?.[0]?.value;
              console.log('[DDEBubbleChat] ✅ Found initial message text', {
                text: text.substring(0, 50),
                textKey
              });
              setMessages([{
                id: 'init',
                type: 'bot',
                text,
                stepType: 'ask',
                textKey,
                color: getStepColor('ask')
              }]);
              return;
            } else {
              console.warn('[DDEBubbleChat] ❌ resolveActionText returned empty', {
                actionId: firstAction.actionId,
                actionInstanceId: firstAction.actionInstanceId,
                hasText: !!firstAction.text,
                parameters: firstAction.parameters
              });
            }
          } else {
            console.warn('[DDEBubbleChat] ❌ No first action found in escalation');
          }
        } else {
          console.warn('[DDEBubbleChat] ❌ No start step or escalations found', {
            hasStartStep: !!startStep,
            escalationsCount: startStep?.escalations?.length || 0
          });
        }
      } else {
        console.warn('[DDEBubbleChat] ❌ No mainData found in currentDDT');
      }
    }
  }, [mode, currentDDT, messages.length, translations]);

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

  // Message handling removed - flow mode uses orchestrator.handleUserInput

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
            setMessages([]);
            messageIdCounter.current = 0;
            lastKeyRef.current = ''; // Reset position key tracking
            if (mode === 'flow') {
              orchestrator.reset();
            } else if (mode === 'single-ddt' && simulator && template) {
              simulator.reset(); // Reset simulator state to initial state
            }
          }}
          className="px-2 py-1 text-xs rounded border bg-gray-100 border-gray-300 text-gray-700"
        >
          Reset
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
        {/* Input field DOPO tutti i messaggi - show when DDT is active AND retrieve is NOT in progress */}
        {(currentDDT || (mode === 'flow' && orchestrator.currentTask?.state === 'WaitingUserInput')) &&
          !orchestrator.isRetrieving && (
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
                    e.preventDefault();
                    const v = inlineDraft.trim();


                    // Handle single-ddt mode
                    if (mode === 'single-ddt' && currentDDT && simulator && template) {
                      // Add user message to chat
                      const userMessageId = `msg-${Date.now()}-${Math.random()}`;
                      lastUserMessageIdRef.current = userMessageId;
                      lastUserInputRef.current = v;
                      setMessages((prev) => [...prev, {
                        id: userMessageId,
                        type: 'user',
                        text: v,
                        matchStatus: undefined,
                        grammarMissing: simulator?.state?.grammarMissing || false
                      }]);

                      // Send input to simulator
                      simulator.send(v);

                      // Clear input
                      sentTextRef.current = v;
                      setInlineDraft('');
                      return;
                    }

                    // Handle empty input (noInput)
                    if (!v) {
                      if (mode === 'single-ddt' && simulator && template) {
                        console.log('[DDEBubbleChat] Empty input - sending noInput');
                        simulator.send('');
                        return;
                      }
                      if (mode === 'flow' && orchestrator.handleUserInput) {
                        orchestrator.handleUserInput('');
                        return;
                      }
                      return;
                    }

                    // In flow mode, always use new DDT navigator (handleUserInput)
                    if (mode === 'flow' && (currentDDT || orchestrator.currentTask?.state === 'WaitingUserInput')) {
                      // Add user message to chat
                      const userMessageId = `msg-${Date.now()}-${Math.random()}`;
                      lastUserMessageIdRef.current = userMessageId;
                      lastUserInputRef.current = v;
                      setMessages((prev) => [...prev, {
                        id: userMessageId,
                        type: 'user',
                        text: v,
                        matchStatus: undefined, // Will be updated after processing
                        grammarMissing: false // Will be updated after processing in flow mode
                      }]);

                      // Send input to DDT navigator (async, no await needed)
                      if (orchestrator.handleUserInput) {
                        console.log('[DDEBubbleChat] Calling handleUserInput', { input: v, hasCurrentDDT: !!currentDDT, taskState: orchestrator.currentTask?.state });
                        void orchestrator.handleUserInput(v);
                      } else {
                        console.warn('[DDEBubbleChat] handleUserInput not available');
                        // Fallback: complete the waiting task
                        const waitingTask = orchestrator.currentTask;
                        if (waitingTask && orchestrator.onDDTCompleted) {
                          orchestrator.onDDTCompleted('saturated');
                        }
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

