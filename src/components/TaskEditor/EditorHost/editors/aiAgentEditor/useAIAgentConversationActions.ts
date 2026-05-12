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
} from '@services/aiAgentDesignApi';
import { resolveAiAgentOutputLanguage } from './resolveAiAgentOutputLanguage';
import type { AIAgentUseCase } from '@types/aiAgentUseCases';
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
      if (useCases.length < 2) {
        fail('Servono almeno 2 use case per montare una conversazione.');
        return null;
      }
      setAssembleConversationBusy(true);
      try {
        const { tag: outputLanguage } = resolveAiAgentOutputLanguage();
        const conversation = await assembleAIAgentConversationApi({
          useCases,
          runtimeContext,
          outputLanguage,
          globalStyleContract,
          previousConversationsCount,
          outcome,
          allowSuggestedUseCases,
          provider,
          model,
        });
        return conversation;
      } catch (e) {
        fail(e instanceof Error ? e.message : String(e));
        return null;
      } finally {
        setAssembleConversationBusy(false);
      }
    },
    [useCases, runtimeContext, globalStyleContract, provider, model, fail]
  );

  const handleProofreadConversationAgentTurns = React.useCallback(
    async ({
      conversation,
      modifiedAgentTurns,
    }: ProofreadConversationAgentTurnsParams): Promise<UseCaseGeneratorWizardConversation | null> => {
      if (modifiedAgentTurns.length === 0) {
        fail('Nessuna bubble agente modificata da correggere.');
        return null;
      }
      setProofreadConversationBusy(true);
      try {
        const { tag: outputLanguage } = resolveAiAgentOutputLanguage();
        const { updates } = await proofreadAIAgentConversationAgentTurnsApi({
          conversation,
          modifiedAgentTurns,
          provider,
          model,
          outputLanguage,
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
    [provider, model, fail]
  );

  return {
    assembleConversationBusy,
    proofreadConversationBusy,
    handleAssembleConversation,
    handleProofreadConversationAgentTurns,
  };
}
