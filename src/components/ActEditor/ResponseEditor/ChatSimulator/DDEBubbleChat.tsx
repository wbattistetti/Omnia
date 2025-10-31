import React from 'react';
import type { AssembledDDT } from '../../../DialogueDataTemplateBuilder/DDTAssembler/currentDDT.types';
import { adaptCurrentToV2 } from '../../../DialogueDataEngine/model/adapters/currentToV2';
import type { DDTNode, DDTTemplateV2 } from '../../../DialogueDataEngine/model/ddt.v2.types';
import { useDDTSimulator } from '../../../DialogueDataEngine/useSimulator';
// Removed resolveMessage and DEFAULT_FALLBACKS - using translations directly like StepEditor
import { extractTranslations, getEscalationActions, resolveActionText } from './DDTAdapter';
import { useDDTManager } from '../../../../context/DDTManagerContext';
import { AlertTriangle } from 'lucide-react';
import { extractField, type ExtractionContext } from '../../../../nlp/pipeline';
import type { SlotDecision } from '../../../../nlp/types';
import UserMessage, { type Message } from './UserMessage';
import BotMessage from './BotMessage';
import { getStepColor } from './chatSimulatorUtils';
import {
  findLastAvailableEscalation,
  resolveEscalation,
  getMain,
  getSub,
  findOriginalNode,
  summarizeValue,
  resolveAsk,
  resolveConfirm,
  resolveSuccess
} from './messageResolvers';

// getStepIcon and getStepColor moved to chatSimulatorUtils.tsx
// Helper functions for message resolution moved to messageResolvers.ts
// UserMessage and BotMessage components moved to separate files

export default function DDEBubbleChat({ currentDDT, translations }: { currentDDT: AssembledDDT, translations?: Record<string, string> }) {
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
      try { el.focus({ preventScroll: true } as any); } catch { }
      if (document.activeElement !== el && i < retries) {
        setTimeout(() => attempt(i + 1), 50);
      }
    };
    requestAnimationFrame(() => attempt(0));
  }, []);
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
      // eslint-disable-next-line no-console
      console.log('[DDE][ask][init]', { node: legacyMain?.label, text });
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
      // eslint-disable-next-line no-console
      console.log('[DDE][ask][sub]', { sub: candidate?.label || sub?.label, text });
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
      // after a short delay so the success bubble remains visible.
      setTimeout(() => { void send(''); }, 10);
    }
  }, [state]);

  // Keep the inline input minimally in view when it exists
  React.useEffect(() => {
    const id = setTimeout(() => {
      try {
        inlineInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } catch { }
      // After scroll, try to focus the inline input
      try { ensureInlineFocus(); } catch { }
    }, 0);
    return () => clearTimeout(id);
  }, [messages.length, ensureInlineFocus]);

  const handleSend = async (text: string) => {
    const trimmed = String(text || '');
    console.error('[ChatSimulator][handleSend] START', { text: trimmed, mode: state.mode, currentIndex: state.currentIndex, currentSubId: state.currentSubId });

    // Empty input → use configured noInput escalation per current mode
    if (trimmed.trim().length === 0) {
      console.error('[ChatSimulator][handleSend] Empty input detected');
      const main = getMain(state);
      const sub = getSub(state);
      const keyId = getPositionKey(state);
      const count = noInputCounts[keyId] || 0;
      const escalationLevel = count + 1; // 1-indexed per getEscalationActions
      console.error('[ChatSimulator][handleSend][noInput]', { keyId, count, escalationLevel, mainLabel: main?.label, subLabel: sub?.label });

      // Determina quale node usare (legacy)
      let legacyNode: any = undefined;
      if (state.mode === 'ConfirmingMain') {
        legacyNode = Array.isArray((currentDDT as any)?.mainData)
          ? (currentDDT as any)?.mainData[0]
          : (currentDDT as any)?.mainData;
        const { text: escalationText, key, level: foundLevel } = resolveEscalation(legacyNode, 'noInput', escalationLevel, legacyDict, translations);
        console.error('[ChatSimulator][handleSend][noInput][ConfirmingMain]', { escalationText, key, found: !!escalationText, requested: escalationLevel, foundLevel });
        if (escalationText) {
          const finalEscalationLevel = foundLevel;
          setMessages((prev) => [...prev, {
            id: generateMessageId('noInput'),
            type: 'bot',
            text: escalationText,
            stepType: 'noInput',
            textKey: key,
            escalationNumber: finalEscalationLevel,
            color: getStepColor('noInput')
          }]);
          setNoInputCounts((prev) => ({ ...prev, [keyId]: finalEscalationLevel }));
          return;
        }
        // Se non c'è escalation, torna al prompt normale (ask)
        const mainAsk = getMain(state);
        const subAsk = getSub(state);
        const { text: askText, key: askKey } = resolveAsk(mainAsk, subAsk, translations, legacyDict, legacyNode, undefined);
        console.error('[ChatSimulator][handleSend][noInput][ConfirmingMain][fallback]', { askText, askKey, found: !!askText });
        if (askText) {
          setMessages((prev) => [...prev, {
            id: generateMessageId('ask'),
            type: 'bot',
            text: askText,
            stepType: 'ask',
            textKey: askKey,
            color: getStepColor('ask')
          }]);
          setNoInputCounts((prev) => ({ ...prev, [keyId]: 0 }));
          return;
        }
      } else if (state.mode === 'CollectingSub') {
        const legacyMain = Array.isArray((currentDDT as any)?.mainData)
          ? (currentDDT as any)?.mainData[0]
          : (currentDDT as any)?.mainData;
        const candidate = (legacyMain?.subData || []).find((s: any) => {
          const sub = getSub(state);
          return (s?.id === sub?.id) || (String(s?.label || '').toLowerCase() === String(sub?.label || '').toLowerCase());
        });
        legacyNode = candidate || legacyMain;
        const { text: escalationText, key, level: foundLevel } = resolveEscalation(legacyNode, 'noInput', escalationLevel, legacyDict, translations);
        console.error('[ChatSimulator][handleSend][noInput][CollectingSub]', { escalationText, key, found: !!escalationText, requested: escalationLevel, foundLevel });
        if (escalationText) {
          const finalEscalationLevel = foundLevel;
          setMessages((prev) => [...prev, {
            id: generateMessageId('noInput'),
            type: 'bot',
            text: escalationText,
            stepType: 'noInput',
            textKey: key,
            escalationNumber: finalEscalationLevel,
            color: getStepColor('noInput')
          }]);
          setNoInputCounts((prev) => ({ ...prev, [keyId]: finalEscalationLevel }));
          return;
        }
        // Se non c'è escalation, torna al prompt normale (ask)
        const mainAsk = getMain(state);
        const subAsk = getSub(state);
        const { text: askText, key: askKey } = resolveAsk(mainAsk, subAsk, translations, legacyDict, legacyNode, subAsk);
        console.error('[ChatSimulator][handleSend][noInput][CollectingSub][fallback]', { askText, askKey, found: !!askText });
        if (askText) {
          setMessages((prev) => [...prev, {
            id: generateMessageId('ask'),
            type: 'bot',
            text: askText,
            stepType: 'ask',
            textKey: askKey,
            color: getStepColor('ask')
          }]);
          setNoInputCounts((prev) => ({ ...prev, [keyId]: 0 }));
          return;
        }
      } else if (state.mode === 'CollectingMain') {
        legacyNode = Array.isArray((currentDDT as any)?.mainData)
          ? (currentDDT as any)?.mainData[0]
          : (currentDDT as any)?.mainData;
        const { text: escalationText, key, level: foundLevel } = resolveEscalation(legacyNode, 'noInput', escalationLevel, legacyDict, translations);
        console.error('[ChatSimulator][handleSend][noInput][CollectingMain]', { escalationText, key, found: !!escalationText, requested: escalationLevel, foundLevel });
        if (escalationText) {
          const finalEscalationLevel = foundLevel;
          setMessages((prev) => [...prev, {
            id: generateMessageId('noInput'),
            type: 'bot',
            text: escalationText,
            stepType: 'noInput',
            textKey: key,
            escalationNumber: finalEscalationLevel,
            color: getStepColor('noInput')
          }]);
          setNoInputCounts((prev) => ({ ...prev, [keyId]: finalEscalationLevel }));
          return;
        }
        // Se non c'è escalation, torna al prompt normale (ask)
        const mainAsk = getMain(state);
        const { text: askText, key: askKey } = resolveAsk(mainAsk, undefined, translations, legacyDict, legacyNode, undefined);
        console.error('[ChatSimulator][handleSend][noInput][CollectingMain][fallback]', { askText, askKey, found: !!askText });
        if (askText) {
          setMessages((prev) => [...prev, {
            id: generateMessageId('ask'),
            type: 'bot',
            text: askText,
            stepType: 'ask',
            textKey: askKey,
            color: getStepColor('ask')
          }]);
          setNoInputCounts((prev) => ({ ...prev, [keyId]: 0 }));
          return;
        }
      }
      console.error('[ChatSimulator][handleSend][noInput] No escalation and no fallback found, returning');
      return;
    }

    // Non-empty: validate using Data Extractor (Contract) instead of simple pattern matching
    // Skip this check during confirmation; the engine handles yes/no.
    if (state.mode !== 'ConfirmingMain') {
      const main = getMain(state);
      const sub = getSub(state);
      const fieldName = sub?.label || main?.label || '';
      console.error('[ChatSimulator][handleSend][validation]', { fieldName, mainLabel: main?.label, subLabel: sub?.label, kind: sub?.kind || main?.kind });

      if (fieldName) {
        try {
          // Build extraction context with node structure and regex from NLP profile
          const targetNode = sub || main;

          // Find original node in currentDDT to get nlpProfile (not preserved in state.plan)
          const originalNode = findOriginalNode(currentDDT, targetNode?.label, targetNode?.id);
          const nlpProfile = originalNode?.nlpProfile || (targetNode as any)?.nlpProfile;

          console.log('[ChatSimulator][handleSend] Building context...', {
            hasTargetNode: !!targetNode,
            targetNodeLabel: targetNode?.label,
            targetNodeKind: targetNode?.kind,
            hasOriginalNode: !!originalNode,
            hasNlpProfile: !!nlpProfile,
            regex: nlpProfile?.regex,
            subData: targetNode?.subData || originalNode?.subData,
            subSlots: nlpProfile?.subSlots,
            subs: targetNode?.subs
          });

          const context: ExtractionContext | undefined = targetNode ? {
            node: {
              subData: targetNode.subData || originalNode?.subData || targetNode.subs?.map((sid: string) => state?.plan?.byId?.[sid]) || [],
              subSlots: nlpProfile?.subSlots,
              kind: targetNode.kind,
              label: targetNode.label
            },
            regex: nlpProfile?.regex
          } : undefined;

          console.error('[ChatSimulator][handleSend][extractField] Calling extractField...', {
            fieldName,
            text: trimmed,
            hasContext: !!context,
            contextNodeLabel: context?.node?.label,
            contextNodeKind: context?.node?.kind,
            contextRegex: context?.regex,
            contextSubData: context?.node?.subData,
            contextSubSlots: context?.node?.subSlots,
            isComposite: !!(context?.node && ((Array.isArray(context.node.subData) && context.node.subData.length > 0) ||
                                              (Array.isArray(context.node.subSlots) && context.node.subSlots.length > 0))),
            hasRegex: !!context?.regex
          });

          // Usa il Data Extractor per validare l'input
          const extractionResult: SlotDecision<any> = await extractField(fieldName, trimmed, undefined, context);
          console.error('[ChatSimulator][handleSend][extractField] Result:', {
            status: extractionResult.status,
            value: extractionResult.status === 'accepted' ? extractionResult.value : undefined,
            source: extractionResult.status === 'accepted' ? extractionResult.source : undefined,
            confidence: extractionResult.status === 'accepted' ? extractionResult.confidence : undefined,
            reasons: extractionResult.status === 'reject' ? extractionResult.reasons : undefined,
            missing: extractionResult.status === 'ask-more' ? extractionResult.missing : undefined
          });

          // Determina matchStatus basato sul risultato dell'estrazione
          let matchStatus: 'match' | 'noMatch' | 'partialMatch';
          if (extractionResult.status === 'accepted') {
            matchStatus = 'match'; // Estrazione completa
          } else if (extractionResult.status === 'ask-more') {
            matchStatus = 'partialMatch'; // Estrazione parziale, mancano campi
          } else {
            matchStatus = 'noMatch'; // Estrazione fallita
          }
          console.error('[ChatSimulator][handleSend][matchStatus] Determined:', { matchStatus, extractionStatus: extractionResult.status });

          // Se l'estrazione fallisce, mostra escalation noMatch
          if (extractionResult.status === 'reject') {
            console.error('[ChatSimulator][handleSend][noMatch] Extraction rejected, showing escalation');
            const keyId = getPositionKey(state);
            const count = noMatchCounts[keyId] || 0;
            const escalationLevel = count + 1; // 1-indexed per getEscalationActions
            console.error('[ChatSimulator][handleSend][noMatch]', { keyId, count, escalationLevel });

            // Determina quale node usare (legacy)
            let legacyNode: any = undefined;
            if (state.mode === 'CollectingSub') {
              // currentDDT.mainData è un array!
              const legacyMain = Array.isArray((currentDDT as any)?.mainData)
                ? (currentDDT as any)?.mainData[0]
                : (currentDDT as any)?.mainData;
              const candidate = (legacyMain?.subData || []).find((s: any) => {
                return (s?.id === sub?.id) || (String(s?.label || '').toLowerCase() === String(sub?.label || '').toLowerCase());
              });
              legacyNode = candidate || legacyMain;
              console.error('🔍 [ChatSimulator][handleSend][noMatch][CollectingSub]', {
                subId: sub?.id,
                subLabel: sub?.label,
                foundCandidate: !!candidate,
                candidateLabel: candidate?.label,
                usingMain: !candidate,
                legacyNodeLabel: legacyNode?.label,
                legacyNodeSteps: legacyNode?.steps ? Object.keys(legacyNode.steps) : [],
                legacyNodeFull: legacyNode
              });
            } else if (state.mode === 'CollectingMain') {
              // currentDDT.mainData è un array!
              legacyNode = Array.isArray((currentDDT as any)?.mainData)
                ? (currentDDT as any)?.mainData[0]
                : (currentDDT as any)?.mainData;
              console.error('🔍 [ChatSimulator][handleSend][noMatch][CollectingMain]', {
                legacyNodeLabel: legacyNode?.label,
                legacyNodeSteps: legacyNode?.steps ? Object.keys(legacyNode.steps) : [],
                legacyNodeFull: legacyNode
              });
            }
            console.error('🔍 [ChatSimulator][handleSend][noMatch] Legacy node:', { found: !!legacyNode, mode: state.mode });

            if (legacyNode) {
              // Cerca escalation: prima quella richiesta, poi l'ultima disponibile
              const { text: escalationText, key, level: foundLevel } = resolveEscalation(
                legacyNode,
                'noMatch',
                escalationLevel,
                legacyDict,
                translations
              );

              if (escalationText) {
                // Usa il livello trovato (potrebbe essere diverso da escalationLevel richiesto)
                const finalEscalationLevel = foundLevel;
                setMessages((prev) => [...prev,
                {
                  id: generateMessageId('user'),
                  type: 'user',
                  text: trimmed,
                  matchStatus: 'noMatch'
                },
                {
                  id: generateMessageId('noMatch'),
                  type: 'bot',
                  text: escalationText,
                  stepType: 'noMatch',
                  textKey: key,
                  escalationNumber: finalEscalationLevel,
                  color: getStepColor('noMatch')
                }
                ]);
                // IMPORTANTE: aggiorna il counter con il livello trovato
                setNoMatchCounts((prev) => ({ ...prev, [keyId]: finalEscalationLevel }));
                console.error('[ChatSimulator][handleSend][noMatch] Messages added with escalation', {
                  requested: escalationLevel,
                  found: finalEscalationLevel
                });
                return;
              }

              // Se non trova NESSUNA escalation disponibile, mostra il normal prompt (ask)
              const mainAsk = getMain(state);
              const subAsk = getSub(state);
              const { text: askText, key: askKey } = resolveAsk(mainAsk, subAsk, translations, legacyDict, legacyNode, subAsk);
              console.error('[ChatSimulator][handleSend][noMatch][fallback]', { askText, askKey, found: !!askText });
              if (askText) {
                setMessages((prev) => [...prev,
                {
                  id: generateMessageId('user'),
                  type: 'user',
                  text: trimmed,
                  matchStatus: 'noMatch'
                },
                {
                  id: generateMessageId('ask'),
                  type: 'bot',
                  text: askText,
                  stepType: 'ask',
                  textKey: askKey,
                  color: getStepColor('ask')
                }
                ]);
                // Reset counter quando si usa ask
                setNoMatchCounts((prev) => ({ ...prev, [keyId]: 0 }));
                console.error('[ChatSimulator][handleSend][noMatch] Messages added with fallback ask');
                return;
              }
            }
            // Se non trova né escalation né prompt normale, mostra comunque il messaggio utente con noMatch
            console.error('[ChatSimulator][handleSend][noMatch] No escalation or fallback, showing user message only');
            setMessages((prev) => [...prev, {
              id: generateMessageId('user'),
              type: 'user',
              text: trimmed,
              matchStatus: 'noMatch'
            }]);
            return;
          }

          // Se l'estrazione è parziale (ask-more), mostra partialMatch ma invia comunque al motore
          // Il motore gestirà la richiesta di ulteriori informazioni
          if (extractionResult.status === 'ask-more') {
            console.error('[ChatSimulator][handleSend][partialMatch] Partial extraction, sending to engine');
            setMessages((prev) => [...prev, {
              id: generateMessageId('user'),
              type: 'user',
              text: trimmed,
              matchStatus: 'partialMatch'
            }]);
            await send(text);
            return;
          }

          // Estrazione riuscita: imposta matchStatus = 'match' e invia al motore
          console.error('[ChatSimulator][handleSend][match] Extraction successful, sending to engine');
          setMessages((prev) => [...prev, {
            id: generateMessageId('user'),
            type: 'user',
            text: trimmed,
            matchStatus: 'match'
          }]);
          await send(text);
          return;
        } catch (error) {
          // Recupera main e sub PRIMA di usarli (sono definiti nel blocco try)
          const sub = getSub(state);

          // Verifica se l'errore è dovuto alla configurazione NLP mancante
          const errorMessage = error instanceof Error ? error.message : String(error);
          const isConfigMissing = errorMessage.includes('NLP configuration not found') ||
            errorMessage.includes('Failed to load NLP configuration');

          if (isConfigMissing) {
            // Configurazione mancante: gestito gracefully, non loggare come errore
            console.debug('[ChatSimulator][handleSend][extractField] NLP configuration missing - handled gracefully');
            // NON aggiungere messaggio system separato - il warning sarà incorporato nel user message
            // Continua con la logica noMatch invece di return
          } else {
            // Altri errori: logga come errore
            console.error('[ChatSimulator][handleSend][extractField] ERROR:', error);
          }

          // Per altri errori o se config missing, considera noMatch e continua
          const keyId = getPositionKey(state);
          const count = noMatchCounts[keyId] || 0;
          const escalationLevel = count + 1;

          let legacyNode: any = undefined;
          if (state.mode === 'CollectingSub') {
            // currentDDT.mainData è un array!
            const legacyMain = Array.isArray((currentDDT as any)?.mainData)
              ? (currentDDT as any)?.mainData[0]
              : (currentDDT as any)?.mainData;
            const candidate = (legacyMain?.subData || []).find((s: any) => {
              return (s?.id === sub?.id) || (String(s?.label || '').toLowerCase() === String(sub?.label || '').toLowerCase());
            });
            legacyNode = candidate || legacyMain;
            console.error('🔍 [ChatSimulator][handleSend][noMatch][catch][CollectingSub]', {
              subId: sub?.id,
              subLabel: sub?.label,
              foundCandidate: !!candidate,
              candidateLabel: candidate?.label,
              usingMain: !candidate,
              legacyNodeLabel: legacyNode?.label,
              legacyNodeSteps: legacyNode?.steps ? Object.keys(legacyNode.steps) : [],
              legacyNodeFull: legacyNode
            });
          } else if (state.mode === 'CollectingMain') {
            // currentDDT.mainData è un array!
            legacyNode = Array.isArray((currentDDT as any)?.mainData)
              ? (currentDDT as any)?.mainData[0]
              : (currentDDT as any)?.mainData;
            console.error('🔍 [ChatSimulator][handleSend][noMatch][catch][CollectingMain]', {
              legacyNodeLabel: legacyNode?.label,
              legacyNodeSteps: legacyNode?.steps ? Object.keys(legacyNode.steps) : [],
              legacyNodeFull: legacyNode
            });
          }

          if (legacyNode) {
            // Cerca escalation: prima quella richiesta, poi l'ultima disponibile
            const { text: escalationText, key, level: foundLevel } = resolveEscalation(
              legacyNode,
              'noMatch',
              escalationLevel,
              legacyDict,
              translations
            );

            if (escalationText) {
              // Usa il livello trovato (potrebbe essere diverso da escalationLevel richiesto)
              const finalEscalationLevel = foundLevel;
              setMessages((prev) => [...prev,
              {
                id: generateMessageId('user'),
                type: 'user',
                text: trimmed,
                matchStatus: 'noMatch',
                warningMessage: isConfigMissing ? 'grammar missing' : undefined
              },
              {
                id: generateMessageId('noMatch'),
                type: 'bot',
                text: escalationText,
                stepType: 'noMatch',
                textKey: key,
                escalationNumber: finalEscalationLevel,
                color: getStepColor('noMatch')
              }
              ]);
              // IMPORTANTE: aggiorna il counter con il livello trovato
              setNoMatchCounts((prev) => ({ ...prev, [keyId]: finalEscalationLevel }));
              console.error('[ChatSimulator][handleSend][noMatch] Messages added with escalation', {
                requested: escalationLevel,
                found: finalEscalationLevel
              });
              return;
            }

            // Se non trova NESSUNA escalation disponibile, mostra il normal prompt (ask)
            const mainAsk = getMain(state);
            const subAsk = getSub(state);
            const { text: askText, key: askKey } = resolveAsk(mainAsk, subAsk, translations, legacyDict, legacyNode, subAsk);
            console.error('[ChatSimulator][handleSend][noMatch][fallback]', { askText, askKey, found: !!askText });
            if (askText) {
              setMessages((prev) => [...prev,
              {
                id: generateMessageId('user'),
                type: 'user',
                text: trimmed,
                matchStatus: 'noMatch',
                warningMessage: isConfigMissing ? 'grammar missing' : undefined
              },
              {
                id: generateMessageId('ask'),
                type: 'bot',
                text: askText,
                stepType: 'ask',
                textKey: askKey,
                color: getStepColor('ask')
              }
              ]);
              // Reset counter quando si usa ask
              setNoMatchCounts((prev) => ({ ...prev, [keyId]: 0 }));
              console.error('[ChatSimulator][handleSend][noMatch] Messages added with fallback ask');
              return;
            }
          }

          // Se non trova né escalation né prompt normale, mostra comunque il messaggio utente con noMatch
          console.error('[ChatSimulator][handleSend][noMatch] No escalation or fallback, showing user message only');
          setMessages((prev) => [...prev, {
            id: generateMessageId('user'),
            type: 'user',
            text: trimmed,
            matchStatus: 'noMatch',
            warningMessage: isConfigMissing ? 'grammar missing' : undefined
          }]);
          return;
        }
      } else {
        console.error('[ChatSimulator][handleSend][validation] No fieldName found, skipping validation');
      }
    } else {
      console.error('[ChatSimulator][handleSend][validation] Skipping validation (mode is ConfirmingMain)');
    }

    // Fallback: se non abbiamo fieldName o siamo in confirmation, usa il comportamento precedente
    // Non-empty input: reset counter for this position and send to engine
    console.error('[ChatSimulator][handleSend][fallback] Using fallback behavior');
    const keyId = getPositionKey(state);
    setNoInputCounts((prev) => ({ ...prev, [keyId]: 0 }));
    setNoMatchCounts((prev) => ({ ...prev, [keyId]: 0 }));

    // Se non abbiamo potuto validare, assumiamo match (comportamento precedente)
    setMessages((prev) => [...prev, {
      id: generateMessageId('user'),
      type: 'user',
      text: trimmed,
      matchStatus: 'match'
    }]);
    console.error('[ChatSimulator][handleSend][fallback] Sending to engine');
    await send(text);
  };

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
          // Callback handlers
          const handleEdit = (id: string, text: string) => {
            setEditingId(id);
            setDraftText(text);
          };

          const handleSave = (id: string, text: string) => {
            const msg = messages.find(x => x.id === id);
            if (msg?.textKey) {
              try { updateTranslation(msg.textKey, text); } catch { }
              setMessages((prev) => prev.map(x => x.id === id ? { ...x, text } : x));
            }
            setEditingId(null);
          };

          const handleCancel = () => {
            setEditingId(null);
            setDraftText('');
          };

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
                const v = inlineDraft;
                setInlineDraft('');
                void handleSend(v);
                setTimeout(() => ensureInlineFocus(), 0);
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


