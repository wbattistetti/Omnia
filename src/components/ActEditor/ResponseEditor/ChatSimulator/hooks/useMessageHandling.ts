import { useCallback } from 'react';
import type { AssembledDDT } from '../../../../DialogueDataTemplateBuilder/DDTAssembler/currentDDT.types';
import { extractField, type ExtractionContext } from '../../../../../nlp/pipeline';
import type { SlotDecision } from '../../../../../nlp/types';
import { getStepColor } from '../chatSimulatorUtils';
import {
  getMain,
  getSub,
  findOriginalNode,
  resolveEscalation,
  resolveAsk
} from '../messageResolvers';
import type { Message } from '../UserMessage';
import { extractTranslations } from '../DDTAdapter';

interface UseMessageHandlingProps {
  state: any;
  send: (text: string) => Promise<void>;
  currentDDT: AssembledDDT;
  translations?: Record<string, string>;
  legacyDict: Record<string, string>;
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  noInputCounts: Record<string, number>;
  setNoInputCounts: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  noMatchCounts: Record<string, number>;
  setNoMatchCounts: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  generateMessageId: (prefix?: string) => string;
  getPositionKey: (s: any) => string;
}

/**
 * Hook to handle message sending logic in Chat Simulator.
 * Manages validation, escalation handling, and message state updates.
 */
export function useMessageHandling({
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
}: UseMessageHandlingProps) {
  const handleSend = useCallback(async (text: string) => {
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
  }, [
    state,
    send,
    currentDDT,
    translations,
    legacyDict,
    noInputCounts,
    noMatchCounts,
    setMessages,
    setNoInputCounts,
    setNoMatchCounts,
    generateMessageId,
    getPositionKey
  ]);

  return { handleSend };
}

