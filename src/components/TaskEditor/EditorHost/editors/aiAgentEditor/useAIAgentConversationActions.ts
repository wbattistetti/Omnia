/**
 * Azioni AI per il passo «conversations» del wizard use case (passo 2):
 * - {@link handleAssembleConversation}: monta una conversazione mescolando più use case,
 *   con outcome dichiarato dal designer e ammissione opzionale di use case emergenti (lampadina).
 * - {@link handleProofreadConversationAgentTurns}: corregge ortografia/punteggiatura
 *   delle bubble agente modificate manualmente (non riformula).
 *
 * Estratto dal controller principale per SRP e per mantenerne la dimensione gestibile.
 */

import React from 'react';
import {
  assembleAIAgentConversationApi,
  proofreadAIAgentConversationAgentTurnsApi,
  type AiCallMeta,
} from '@services/aiAgentDesignApi';
import { AI_CALL_PURPOSE } from '@domain/aiCalls/purposes';
import { resolveAiAgentOutputLanguage } from './resolveAiAgentOutputLanguage';
import {
  isUseCaseIncludedInConversations,
  type AIAgentUseCase,
} from '@types/aiAgentUseCases';
import type {
  UseCaseGeneratorWizardConversation,
  UseCaseGeneratorWizardConversationOutcome,
  UseCaseGeneratorWizardTurnAgent,
} from '@domain/useCaseGeneratorWizard/types';

export interface AssembleConversationParams {
  /** Conteggio conversazioni già montate (per hint di variazione mix). */
  previousConversationsCount: number;
  /** Outcome richiesto dal designer (radio toolbar). */
  outcome: UseCaseGeneratorWizardConversationOutcome;
  /** Checkbox toolbar: lascia all'AI la facoltà di proporre AL MASSIMO 1 use case emergente. */
  allowSuggestedUseCases: boolean;
}

export interface ProofreadConversationAgentTurnsParams {
  /** Conversazione completa (lo stato corrente, post-edit). */
  conversation: UseCaseGeneratorWizardConversation;
  /** Bubble agente modificate vs baseline (`ConversationStylePlan.modifiedAgentTurns`). */
  modifiedAgentTurns: Array<{
    turnId: string;
    useCaseId: string;
    currentText: string;
    baselineText: string;
  }>;
}

export interface UseAIAgentConversationActionsParams {
  provider: string;
  model: string;
  useCases: readonly AIAgentUseCase[];
  /** Runtime context concat passato al prompt AI. */
  runtimeContext: string;
  globalStyleContract: string;
  /**
   * Helper opzionale per costruire i metadati di tracing/cost-log delle chiamate IA. Se omesso,
   * le chiamate vengono loggate senza `taskId/taskLabel` e finiscono sotto "Globale (senza task)"
   * nel report ad albero.
   */
  buildCallMeta?: (purpose: string) => AiCallMeta;
  onError?: (message: string) => void;
}

export interface AIAgentConversationActionsModel {
  assembleConversationBusy: boolean;
  proofreadConversationBusy: boolean;
  /** Restituisce la nuova conversazione (non la appende — orchestrazione esterna). */
  handleAssembleConversation: (
    params: AssembleConversationParams
  ) => Promise<UseCaseGeneratorWizardConversation | null>;
  /** Restituisce la conversazione con le bubble agente proofreaded (no side effects). */
  handleProofreadConversationAgentTurns: (
    params: ProofreadConversationAgentTurnsParams
  ) => Promise<UseCaseGeneratorWizardConversation | null>;
}

export function useAIAgentConversationActions({
  provider,
  model,
  useCases,
  runtimeContext,
  globalStyleContract,
  buildCallMeta,
  onError,
}: UseAIAgentConversationActionsParams): AIAgentConversationActionsModel {
  const [assembleConversationBusy, setAssembleConversationBusy] = React.useState(false);
  const [proofreadConversationBusy, setProofreadConversationBusy] = React.useState(false);

  const onErrorRef = React.useRef(onError);
  onErrorRef.current = onError;
  const fail = React.useCallback((msg: string) => {
    onErrorRef.current?.(msg);
  }, []);

  const handleAssembleConversation = React.useCallback(
    async ({
      previousConversationsCount,
      outcome,
      allowSuggestedUseCases,
    }: AssembleConversationParams): Promise<UseCaseGeneratorWizardConversation | null> => {
      /**
       * Filtro inclusione: passiamo all'IA SOLO gli use case con `included_in_conversations !==
       * false` (toggle nell'header della lista). Quelli esclusi non devono comparire come
       * sorgente nelle conversazioni n\u00e9 nel system prompt finale. Restano comunque nel catalogo
       * lato UI per non essere ri-proposti come duplicati. Vedi
       * {@link isUseCaseIncludedInConversations}.
       */
      const includedUseCases = useCases.filter(isUseCaseIncludedInConversations);
      if (includedUseCases.length < 2) {
        fail(
          useCases.length < 2
            ? 'Servono almeno 2 use case per montare una conversazione.'
            : 'Servono almeno 2 use case INCLUSI per montare una conversazione (rimuovi qualche esclusione).'
        );
        return null;
      }
      setAssembleConversationBusy(true);
      try {
        const { tag: outputLanguage } = resolveAiAgentOutputLanguage();
        const conversation = await assembleAIAgentConversationApi({
          useCases: includedUseCases,
          runtimeContext,
          outputLanguage,
          globalStyleContract,
          previousConversationsCount,
          outcome,
          allowSuggestedUseCases,
          provider,
          model,
          ...(buildCallMeta
            ? {
                callMeta: buildCallMeta(
                  allowSuggestedUseCases
                    ? AI_CALL_PURPOSE.CONVERSATION_SUGGESTED
                    : outcome === 'negative'
                      ? AI_CALL_PURPOSE.CONVERSATION_NEGATIVE
                      : AI_CALL_PURPOSE.CONVERSATION_POSITIVE
                ),
              }
            : {}),
        });
        return conversation;
      } catch (e) {
        fail(e instanceof Error ? e.message : String(e));
        return null;
      } finally {
        setAssembleConversationBusy(false);
      }
    },
    [useCases, runtimeContext, globalStyleContract, provider, model, buildCallMeta, fail]
  );

  const handleProofreadConversationAgentTurns = React.useCallback(
    async ({
      conversation,
      modifiedAgentTurns,
    }: ProofreadConversationAgentTurnsParams): Promise<UseCaseGeneratorWizardConversation | null> => {
      /**
       * Filtro inclusione: scartiamo i turni il cui use case sorgente \u00e8 stato escluso. Il
       * proofread non deve riformulare bubble di use case che il designer non considera pi\u00f9
       * parte della conversazione (anche se la bubble \u00e8 ancora in storage).
       */
      const excludedUseCaseIds = new Set(
        useCases.filter((u) => !isUseCaseIncludedInConversations(u)).map((u) => u.id)
      );
      const filteredAgentTurns = modifiedAgentTurns.filter(
        (t) => !excludedUseCaseIds.has(t.useCaseId)
      );
      if (filteredAgentTurns.length === 0) {
        fail(
          modifiedAgentTurns.length === 0
            ? 'Nessuna bubble agente modificata da correggere.'
            : 'Le bubble modificate appartengono a use case esclusi: niente da proofreaded.'
        );
        return null;
      }
      setProofreadConversationBusy(true);
      try {
        const { tag: outputLanguage } = resolveAiAgentOutputLanguage();
        const { updates } = await proofreadAIAgentConversationAgentTurnsApi({
          conversation,
          modifiedAgentTurns: filteredAgentTurns,
          provider,
          model,
          outputLanguage,
          ...(buildCallMeta
            ? { callMeta: buildCallMeta(AI_CALL_PURPOSE.CONVERSATION_PROOFREAD) }
            : {}),
        });
        const byTurnId = new Map(updates.map((u) => [u.turnId, u.text]));
        const nextTurns = conversation.turns.map((t) => {
          if (t.role !== 'agent') return t;
          const newText = byTurnId.get(t.turnId);
          if (newText === undefined) return t;
          const agent = t as UseCaseGeneratorWizardTurnAgent;
          return { ...agent, text: newText };
        });
        return {
          ...conversation,
          turns: nextTurns,
        };
      } catch (e) {
        fail(e instanceof Error ? e.message : String(e));
        return null;
      } finally {
        setProofreadConversationBusy(false);
      }
    },
    [provider, model, useCases, buildCallMeta, fail]
  );

  return {
    assembleConversationBusy,
    proofreadConversationBusy,
    handleAssembleConversation,
    handleProofreadConversationAgentTurns,
  };
}
