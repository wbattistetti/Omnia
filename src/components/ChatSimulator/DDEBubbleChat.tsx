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

  console.log('🔵🔵🔵 [DDEBubbleChat] FUNCTION CALLED 🔵🔵🔵', {
    renderCount: renderCountRef.current,
    mode,
    hasPropCurrentDDT: !!propCurrentDDT,
    propCurrentDDTId: propCurrentDDT?.id,
    propCurrentDDTLabel: propCurrentDDT?.label,
    translationsKeys: translations ? Object.keys(translations).length : 0,
    propNodesCount: propNodes?.length || 0,
    propEdgesCount: propEdges?.length || 0,
    stackTrace: new Error().stack?.split('\n').slice(1, 4).join('\n')
  });

  // Flow orchestrator reads directly from window.__flowNodes in flow mode
  // This ensures it always has the latest nodes/rows order without polling or synchronization
  // Using new compiler-based orchestrator
  const getCurrentNodes = React.useCallback(() => {
    const nodes = mode === 'flow'
      ? ((window as any).__flowNodes || propNodes || [])
      : (propNodes || []);
    console.log('🔵 [DDEBubbleChat] getCurrentNodes called', { mode, nodesCount: nodes.length, propNodesCount: propNodes?.length || 0 });
    return nodes;
  }, [mode, propNodes]);

  const getCurrentEdges = React.useCallback(() => {
    const edges = mode === 'flow'
      ? ((window as any).__flowEdges || propEdges || [])
      : (propEdges || []);
    console.log('🔵 [DDEBubbleChat] getCurrentEdges called', { mode, edgesCount: edges.length, propEdgesCount: propEdges?.length || 0 });
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
  const emptyConfigRef = React.useRef({ nodes: [], edges: [], onMessage: () => {}, onDDTStart: () => {}, onDDTComplete: () => {} });

  const orchestratorConfig = React.useMemo(() => {
    console.log('🔵 [DDEBubbleChat] orchestratorConfig useMemo recalculated', {
      mode,
      renderCount: renderCountRef.current,
      propNodesCount: propNodes?.length || 0,
      propEdgesCount: propEdges?.length || 0
    });
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
          const uniqueId = message.id ? `${message.id}-${Date.now()}-${Math.random()}` : `msg-${Date.now()}-${Math.random()}`;
          flushSync(() => {
            setMessages((prev) => {
              const existingIndex = prev.findIndex(m => m.text === message.text && m.type === 'bot');
              if (existingIndex >= 0) return prev;
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
        },
        onDDTStart: (ddt: any) => {
          if (onUpdateDDTRef.current) {
            onUpdateDDTRef.current(() => ddt);
          }
        },
        onDDTComplete: () => {}
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
    if (mode === 'flow' && flowOrchestrator) {
      console.log('🔵 [DDEBubbleChat] orchestrator changed', {
        hasOrchestrator: !!flowOrchestrator,
        currentDDTId: flowOrchestrator?.currentDDT?.id,
        renderCount: renderCountRef.current
      });
    }
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
    console.log('🔵 [DDEBubbleChat] currentDDT useMemo recalculated', {
      mode,
      resultId: result?.id,
      propCurrentDDTId: propCurrentDDT?.id,
      orchestratorDDTId: mode === 'flow' ? orchestrator?.currentDDT?.id : 'N/A',
      renderCount: renderCountRef.current
    });
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

  // Log when onUpdateDDT changes
  React.useEffect(() => {
    console.log('🔵 [DDEBubbleChat] onUpdateDDT changed', {
      hasOnUpdateDDT: !!onUpdateDDT,
      renderCount: renderCountRef.current
    });
  }, [onUpdateDDT]);

  // Use DDT simulator for single-ddt mode to handle user input
  const template = React.useMemo(() => {
    console.log('🔵 [DDEBubbleChat] template useMemo recalculated', {
      mode,
      hasCurrentDDT: !!currentDDT,
      currentDDTId: currentDDT?.id,
      renderCount: renderCountRef.current
    });
    if (mode === 'single-ddt' && currentDDT) {
      try {
        const result = adaptCurrentToV2(currentDDT);
        console.log('🔵 [DDEBubbleChat] template adapted successfully', { hasResult: !!result });
        return result;
      } catch (err) {
        console.error('[DDEBubbleChat] Error adapting DDT to V2', err);
        return null;
      }
    }
    return null;
  }, [mode, currentDDT]);

  const debugEnabled = React.useMemo(() => {
    try {
      return localStorage.getItem('debug.chatSimulator') === '1';
    } catch {
      return false;
    }
  }, []);

  const simulator = mode === 'single-ddt' && template
    ? useDDTSimulator(template, { typingIndicatorMs: 0, debug: debugEnabled })
    : null;

  // Track last position key to avoid duplicate messages
  const lastKeyRef = React.useRef<string>('');

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
    console.log('🔵 [DDEBubbleChat] useEffect - simulator state listener', {
      mode,
      hasSimulator: !!simulator,
      stateMode: simulator?.state?.mode,
      currentIndex: simulator?.state?.currentIndex,
      currentSubId: simulator?.state?.currentSubId,
      renderCount: renderCountRef.current
    });

    if (mode !== 'single-ddt' || !simulator) return;

    const state = simulator.state;
    const key = getPositionKey(state);

    // Skip if same position - only add message when position changes
    if (lastKeyRef.current === key) {
      console.log('🔵 [DDEBubbleChat] useEffect - same position key, skipping', { key, lastKey: lastKeyRef.current });
      return;
    }
    console.log('🔵 [DDEBubbleChat] useEffect - position key changed', { key, lastKey: lastKeyRef.current });
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

    // 🔍 LOG DIAGNOSTICO: Verifica quale nodo viene controllato
    console.log('🔍 [DIAGNOSTIC] Controllo nodeState per step', {
      hasSub: !!sub,
      subId: sub?.id,
      subLabel: sub?.label,
      mainId: main?.id,
      mainLabel: main?.label,
      targetNodeId: targetNodeId,
      targetNodeType: sub ? 'sub' : 'main',
      mainStep: mainStep,
      mainCounters: mainCounters,
      targetStep: targetStep,
      targetCounters: targetCounters,
      finalStep: step,
      finalCounters: counters,
      // Controlla anche il sub per vedere il suo step
      subNodeState: sub?.id ? state.nodeStates?.[sub.id] : null,
      subStep: sub?.id ? state.nodeStates?.[sub.id]?.step : undefined,
      subCounters: sub?.id ? state.nodeStates?.[sub.id]?.counters : undefined,
      mode: state.mode,
      currentSubId: state.currentSubId,
      // Tutti i nodeStates per vedere lo stato completo
      allNodeStates: Object.keys(state.nodeStates || {}).map(k => ({
        id: k,
        step: state.nodeStates[k]?.step,
        counters: state.nodeStates[k]?.counters
      }))
    });

    // Resolve and add message based on current mode and step
    if (step === 'NoMatch') {
      console.log('🔵 [DDEBubbleChat] Step NoMatch rilevato', {
        targetNodeId: targetNodeId,
        isSub: !!sub,
        subId: sub?.id,
        subLabel: sub?.label,
        mainId: main?.id,
        mainLabel: main?.label,
        counters: counters,
        escalationLevel: (counters.noMatch || 0) + 1,
        mode: state.mode,
        currentSubId: state.currentSubId,
        nodeStates: Object.keys(state.nodeStates || {}).map(k => ({
          id: k,
          step: state.nodeStates[k]?.step,
          counters: state.nodeStates[k]?.counters
        }))
      });

      const escalationLevel = (counters.noMatch || 0) + 1; // Counter is 0-based, escalation is 1-based
      // NoMatch totale → sempre escalation sul main, non sul sub
      // Perché è un fallimento globale, non del sub specifico
      // Anche se siamo in ToComplete con sub attivo, il noMatch è sempre sul main
      const legacyNode = legacyMain; // Sempre main per noMatch totale

      console.log('🔵 [DDEBubbleChat] Cercando escalation', {
        legacyNodeId: legacyNode?.id,
        legacyNodeLabel: legacyNode?.label,
        escalationLevel,
        stepType: 'noMatch',
        hasLegacyDict: !!legacyDict,
        hasTranslations: !!translations
      });

      const { text, key: textKey } = resolveEscalation(legacyNode, 'noMatch', escalationLevel, legacyDict, translations);

      console.log('🔵 [DDEBubbleChat] Risultato escalation', {
        found: !!text,
        text: text ? text.substring(0, 100) : undefined,
        textKey,
        escalationLevel
      });

      if (text) {
        console.log('🔵 [DDEBubbleChat] Adding NoMatch message', { escalationLevel, text, textKey, node: 'main' });
        setMessages((prev) => [...prev, {
          id: `sim-${Date.now()}-${Math.random()}`,
          type: 'bot',
          text,
          stepType: 'noMatch',
          textKey,
          color: getStepColor('noMatch')
        }]);
      } else {
        console.warn('🔵 [DDEBubbleChat] Escalation non trovata!', {
          legacyNodeId: legacyNode?.id,
          escalationLevel
        });
      }
    } else if (step === 'NoInput') {
      const escalationLevel = (counters.noInput || 0) + 1; // Counter is 0-based, escalation is 1-based
      // NoInput → sempre escalation sul main, non sul sub (stessa logica di noMatch)
      const legacyNode = legacyMain; // Sempre main per noInput
      const { text, key: textKey } = resolveEscalation(legacyNode, 'noInput', escalationLevel, legacyDict, translations);
      if (text) {
        console.log('🔵 [DDEBubbleChat] Adding NoInput message', { escalationLevel, text, textKey, node: 'main' });
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
      console.log('🔍 [DIAGNOSTIC] Entrato in CollectingMain/CollectingSub invece di NoMatch', {
        step: step,
        targetNodeId: targetNodeId,
        targetNodeType: sub ? 'sub' : 'main',
        mainHasNoMatch: main?.id ? state.nodeStates?.[main.id]?.step === 'NoMatch' : false,
        subHasNoMatch: sub?.id ? state.nodeStates?.[sub.id]?.step === 'NoMatch' : false,
        mode: state.mode,
        mainStep: main?.id ? state.nodeStates?.[main.id]?.step : undefined,
        subStep: sub?.id ? state.nodeStates?.[sub.id]?.step : undefined
      });

      // Trova legacySub se c'è un sub attivo
      // findOriginalNode si aspetta: (currentDDT, nodeLabel?, nodeId?)
      const legacySub = sub?.id && currentDDT ? findOriginalNode(currentDDT, undefined, sub.id) : undefined;

      const { text, key: textKey } = resolveAsk(main, sub, translations, legacyDict, legacyMain, legacySub);
      if (text) {
        console.log('🔍 [DIAGNOSTIC] Aggiungendo messaggio ask normale', {
          text: text.substring(0, 100),
          textKey,
          messagesCount: 'will be logged in setMessages',
          hasSub: !!sub,
          hasLegacySub: !!legacySub
        });
        setMessages((prev) => {
          // Rimuovi 'init' solo se esiste un altro messaggio ask diverso da 'init'
          // 'init' è un messaggio di bootstrap, non va trattato con regole generiche dei bot messages
          const hasOtherAskMessage = prev.some(
            m => m.id !== 'init' && (m.stepType === 'ask' || m.stepType === 'start')
          );
          const filtered = hasOtherAskMessage ? prev.filter(m => m.id !== 'init') : prev;
          console.log('🔍 [DIAGNOSTIC] Messaggi prima di aggiungere ask', {
            prevCount: prev.length,
            filteredCount: filtered.length,
            removedInit: prev.length - filtered.length,
            hasOtherAskMessage,
            lastMessages: prev.slice(-3).map(m => ({ id: m.id, type: m.type, stepType: m.stepType, text: m.text?.substring(0, 50) }))
          });
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
            if (mode === 'flow') {
              orchestrator.reset();
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

                  console.log('[DDEBubbleChat] Enter pressed', {
                    mode,
                    input: v,
                    hasCurrentDDT: !!currentDDT,
                    hasSimulator: !!simulator
                  });

                  // Handle single-ddt mode
                  if (mode === 'single-ddt' && currentDDT && simulator) {
                    // Add user message to chat
                    const userMessageId = `msg-${Date.now()}-${Math.random()}`;
                    lastUserMessageIdRef.current = userMessageId;
                    lastUserInputRef.current = v;
                    setMessages((prev) => [...prev, {
                      id: userMessageId,
                      type: 'user',
                      text: v,
                      matchStatus: undefined
                    }]);

                    // Send input to simulator
                    console.log('[DDEBubbleChat] Sending input to simulator', { input: v });
                    simulator.send(v);

                    // Clear input
                    sentTextRef.current = v;
                    setInlineDraft('');
                    return;
                  }

                  // Handle empty input (noInput)
                  if (!v) {
                    if (mode === 'single-ddt' && simulator) {
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
                      matchStatus: undefined // Will be updated after processing
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

