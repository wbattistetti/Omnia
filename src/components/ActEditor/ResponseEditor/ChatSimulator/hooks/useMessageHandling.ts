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
    // Removed verbose logging

    // Empty input → use configured noInput escalation per current mode
    if (trimmed.trim().length === 0) {
      const main = getMain(state);
      const sub = getSub(state);
      const keyId = getPositionKey(state);
      const count = noInputCounts[keyId] || 0;
      const escalationLevel = count + 1; // 1-indexed per getEscalationActions

      // Determina quale node usare (legacy)
      let legacyNode: any = undefined;
      if (state.mode === 'ConfirmingMain') {
        legacyNode = Array.isArray((currentDDT as any)?.mainData)
          ? (currentDDT as any)?.mainData[0]
          : (currentDDT as any)?.mainData;
        const { text: escalationText, key, level: foundLevel } = resolveEscalation(legacyNode, 'noInput', escalationLevel, legacyDict, translations);
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
      return;
    }

    // Non-empty: validate using Data Extractor (Contract) instead of simple pattern matching
    // Skip this check during confirmation; the engine handles yes/no.
    if (state.mode !== 'ConfirmingMain') {
      const main = getMain(state);
      const sub = getSub(state);
      const fieldName = sub?.label || main?.label || '';

      if (fieldName) {
        // Build extraction context with node structure and regex from NLP profile
        const targetNode = sub || main;

        // Find original node in currentDDT to get nlpProfile (not preserved in state.plan)
        const originalNode = findOriginalNode(currentDDT, targetNode?.label, targetNode?.id);
        const nlpProfile = originalNode?.nlpProfile || (targetNode as any)?.nlpProfile;

        // Check if regex exists BEFORE try/catch to determine correct warning message
        const hasRegex = !!(nlpProfile?.regex && nlpProfile.regex.trim());

        const context: ExtractionContext | undefined = targetNode ? {
          node: {
            subData: targetNode.subData || originalNode?.subData || targetNode.subs?.map((sid: string) => state?.plan?.byId?.[sid]) || [],
            subSlots: nlpProfile?.subSlots,
            kind: targetNode.kind,
            label: targetNode.label
          },
          regex: nlpProfile?.regex
        } : undefined;

        try {


          // Usa il Data Extractor per validare l'input
          const extractionResult: SlotDecision<any> = await extractField(fieldName, trimmed, undefined, context);

          // Determina matchStatus basato sul risultato dell'estrazione
          let matchStatus: 'match' | 'noMatch' | 'partialMatch';
          if (extractionResult.status === 'accepted') {
            matchStatus = 'match'; // Estrazione completa
          } else if (extractionResult.status === 'ask-more') {
            matchStatus = 'partialMatch'; // Estrazione parziale, mancano campi
          } else {
            matchStatus = 'noMatch'; // Estrazione fallita
          }

          // Se l'estrazione fallisce, mostra escalation noMatch
          if (extractionResult.status === 'reject') {
            const keyId = getPositionKey(state);
            const count = noMatchCounts[keyId] || 0;
            const escalationLevel = count + 1; // 1-indexed per getEscalationActions

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
            } else if (state.mode === 'CollectingMain') {
              // currentDDT.mainData è un array!
              legacyNode = Array.isArray((currentDDT as any)?.mainData)
                ? (currentDDT as any)?.mainData[0]
                : (currentDDT as any)?.mainData;
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
                return;
              }

              // Se non trova NESSUNA escalation disponibile, mostra il normal prompt (ask)
              const mainAsk = getMain(state);
              const subAsk = getSub(state);
              const { text: askText, key: askKey } = resolveAsk(mainAsk, subAsk, translations, legacyDict, legacyNode, subAsk);
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
                return;
              }
            }
            // Se non trova né escalation né prompt normale, mostra comunque il messaggio utente con noMatch
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

          // Determina il warning message corretto basato su regex ed escalation
          let warningMessage: string | undefined = undefined;
          if (isConfigMissing) {
            if (hasRegex) {
              // Regex esiste ma manca escalation/config completo
              warningMessage = 'only regex, no escalation';
            } else {
              // Nessuna regex, configurazione completa mancante
              warningMessage = 'grammar missing';
            }
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
          } else if (state.mode === 'CollectingMain') {
            // currentDDT.mainData è un array!
            legacyNode = Array.isArray((currentDDT as any)?.mainData)
              ? (currentDDT as any)?.mainData[0]
              : (currentDDT as any)?.mainData;
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
                warningMessage: warningMessage
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
              return;
            }

            // Se non trova NESSUNA escalation disponibile, mostra il normal prompt (ask)
            const mainAsk = getMain(state);
            const subAsk = getSub(state);
            const { text: askText, key: askKey } = resolveAsk(mainAsk, subAsk, translations, legacyDict, legacyNode, subAsk);
            if (askText) {
              setMessages((prev) => [...prev,
              {
                id: generateMessageId('user'),
                type: 'user',
                text: trimmed,
                matchStatus: 'noMatch',
                warningMessage: warningMessage
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
              return;
            }
          }

          // Se non trova né escalation né prompt normale, mostra comunque il messaggio utente con noMatch
          setMessages((prev) => [...prev, {
            id: generateMessageId('user'),
            type: 'user',
            text: trimmed,
            matchStatus: 'noMatch',
            warningMessage: warningMessage
          }]);
          return;
        }
      }
    }

    // Fallback: se non abbiamo fieldName o siamo in confirmation, usa il comportamento precedente
    // Non-empty input: reset counter for this position and send to engine
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

