/**
 * IA actions for the review portal — same APIs as {@link useAIAgentEditorController}, wired to review store.
 */

import React from 'react';
import { useAIProvider } from '@context/AIProviderContext';
import type { AIAgentEditorDockContextValue } from '@components/TaskEditor/EditorHost/editors/aiAgentEditor/AIAgentEditorDockContext';
import type { UseStructuredAgentSectionsRevisionResult } from '@components/TaskEditor/EditorHost/editors/aiAgentEditor/useStructuredAgentSectionsRevision';
import { buildRefineUserDescFromSections } from '@components/TaskEditor/EditorHost/editors/aiAgentEditor/composeRuntimePromptMarkdown';
import { hasSignificantDesignDescriptionEdit } from '@components/TaskEditor/EditorHost/editors/aiAgentEditor/designDescriptionPolish';
import {
  mergeUseCaseGlobalStyleContract,
} from '@components/TaskEditor/EditorHost/editors/aiAgentEditor/mergeUseCaseGlobalStyleContract';
import {
  AI_AGENT_GLOBAL_USE_CASE_STYLES,
  AI_AGENT_MIN_INPUT_CHARS,
  DEFAULT_AI_AGENT_GLOBAL_USE_CASE_STYLE_ID,
} from '@components/TaskEditor/EditorHost/editors/aiAgentEditor/constants';
import { buildUserDescWithKnowledgeBaseContext } from '@domain/knowledgeBase/buildUserDescWithKnowledgeBaseContext';
import {
  generateAIAgentUseCases,
  generalizeAIAgentUseCaseMetaApi,
  polishDesignDescriptionApi,
  polishUseCaseScenarioApi,
  regenerateAIAgentUseCaseApi,
} from '@services/aiAgentDesignApi';
import { AI_CALL_PURPOSE } from '@domain/aiCalls/purposes';
import { resolveAiAgentOutputLanguage } from '@components/TaskEditor/EditorHost/editors/aiAgentEditor/resolveAiAgentOutputLanguage';
import { getScenarioText, withScenarioText } from '@domain/aiAgentUseCase/scenarioText';
import { normalizeUseCaseSiblingOrder } from '@components/TaskEditor/EditorHost/editors/aiAgentEditor/useCaseHierarchy';
import { remapExtendUseCaseIds } from '@domain/aiAgentUseCase/remapExtendUseCaseIds';
import type { AIAgentUseCase } from '@types/aiAgentUseCases';
import type { StagedKbDocument } from '@domain/knowledgeBase/kbDocumentTypes';
import { DESIGNER_LLM_MISSING_MODEL_MESSAGE } from '@components/settings/designerLlm/designerLlmMessages';

export type ReviewAgentIaDockSlice = Pick<
  AIAgentEditorDockContextValue,
  | 'designDescriptionPolishBaseline'
  | 'showDesignDescriptionPolishOffer'
  | 'designDescriptionPolishBusy'
  | 'onPolishDesignDescription'
  | 'onDismissDesignDescriptionPolishOffer'
  | 'useCaseComposerBusy'
  | 'useCaseBundleGenerationBusy'
  | 'useCaseBundleGenerationCount'
  | 'useCaseBundleGenerationOrdering'
  | 'useCaseBundleGenerationCategorizing'
  | 'onGenerateUseCaseBundle'
  | 'onRegenerateUseCase'
  | 'onGeneralizeUseCaseMeta'
  | 'onPolishUseCaseScenario'
  | 'buildUseCasePropagatorCallMeta'
>;

export interface UseReviewAgentIaDockSliceParams {
  projectId: string;
  taskInstanceId: string;
  taskLabel: string;
  designDescription: string;
  setDesignDescription: (value: string) => void;
  useCases: readonly AIAgentUseCase[];
  setUseCases: React.Dispatch<React.SetStateAction<AIAgentUseCase[]>>;
  structuredRevision: UseStructuredAgentSectionsRevisionResult;
  knowledgeBaseDocuments: readonly StagedKbDocument[];
  useCaseGlobalStyleId: string;
  agentUseCaseStyleLearningNotes: string;
  channelLoaded: boolean;
  useCaseComposerError: string | null;
  onClearUseCaseComposerError: () => void;
  onComposerIaError: (message: string) => void;
}

export function useReviewAgentIaDockSlice(
  params: UseReviewAgentIaDockSliceParams
): ReviewAgentIaDockSlice {
  const { provider, model } = useAIProvider();

  const [designDescriptionPolishBaseline, setDesignDescriptionPolishBaseline] =
    React.useState('');
  const [designDescriptionPolishBusy, setDesignDescriptionPolishBusy] = React.useState(false);
  const [designDescriptionPolishOfferDismissed, setDesignDescriptionPolishOfferDismissed] =
    React.useState(false);
  const designDescriptionWasSignificantRef = React.useRef(false);

  const [useCaseComposerBusy, setUseCaseComposerBusy] = React.useState(false);
  const [useCaseBundleGenerationBusy, setUseCaseBundleGenerationBusy] = React.useState(false);
  const [useCaseBundleGenerationCount, setUseCaseBundleGenerationCount] = React.useState<
    number | null
  >(null);
  const [useCaseBundleGenerationOrdering, setUseCaseBundleGenerationOrdering] =
    React.useState(false);
  const [useCaseBundleGenerationCategorizing, setUseCaseBundleGenerationCategorizing] =
    React.useState(false);

  const loadedBaselineKeyRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (!params.channelLoaded) {
      loadedBaselineKeyRef.current = null;
      return;
    }
    const key = `${params.projectId}:${params.taskInstanceId}`;
    if (loadedBaselineKeyRef.current === key) return;
    loadedBaselineKeyRef.current = key;
    setDesignDescriptionPolishBaseline(params.designDescription);
    setDesignDescriptionPolishOfferDismissed(false);
  }, [
    params.channelLoaded,
    params.projectId,
    params.taskInstanceId,
    params.designDescription,
  ]);

  const buildCallMeta = React.useCallback(
    (purpose: string) => ({
      purpose,
      taskId: params.taskInstanceId,
      taskLabel: params.taskLabel,
    }),
    [params.taskInstanceId, params.taskLabel]
  );

  const globalStyleContract = React.useMemo(() => {
    const base =
      AI_AGENT_GLOBAL_USE_CASE_STYLES.find((s) => s.id === params.useCaseGlobalStyleId)
        ?.contract ?? '';
    return mergeUseCaseGlobalStyleContract(base, params.agentUseCaseStyleLearningNotes);
  }, [params.useCaseGlobalStyleId, params.agentUseCaseStyleLearningNotes]);

  const onPolishDesignDescription = React.useCallback(async () => {
    const raw = params.designDescription.trim();
    if (raw.length < 40) {
      params.onComposerIaError(
        'Scrivi almeno qualche riga nella descrizione prima di riformattare.'
      );
      return;
    }
    if (!model) {
      params.onComposerIaError(DESIGNER_LLM_MISSING_MODEL_MESSAGE);
      return;
    }
    params.onClearUseCaseComposerError();
    setDesignDescriptionPolishBusy(true);
    try {
      const { tag: outputLanguage } = resolveAiAgentOutputLanguage();
      const { design_description } = await polishDesignDescriptionApi({
        descriptionText: raw,
        provider,
        model,
        outputLanguage,
        callMeta: buildCallMeta(AI_CALL_PURPOSE.AGENT_POLISH_DESIGN_DESCRIPTION),
      });
      params.setDesignDescription(design_description);
      setDesignDescriptionPolishBaseline(design_description);
      setDesignDescriptionPolishOfferDismissed(false);
    } catch (e) {
      params.onComposerIaError(e instanceof Error ? e.message : String(e));
    } finally {
      setDesignDescriptionPolishBusy(false);
    }
  }, [
    params.designDescription,
    params.setDesignDescription,
    params.onClearUseCaseComposerError,
    params.onComposerIaError,
    provider,
    model,
    buildCallMeta,
  ]);

  const onDismissDesignDescriptionPolishOffer = React.useCallback(() => {
    setDesignDescriptionPolishOfferDismissed(true);
  }, []);

  const designDescriptionEditSignificant = React.useMemo(
    () =>
      hasSignificantDesignDescriptionEdit(
        params.designDescription,
        designDescriptionPolishBaseline
      ),
    [params.designDescription, designDescriptionPolishBaseline]
  );

  React.useEffect(() => {
    if (designDescriptionEditSignificant && !designDescriptionWasSignificantRef.current) {
      setDesignDescriptionPolishOfferDismissed(false);
    }
    designDescriptionWasSignificantRef.current = designDescriptionEditSignificant;
  }, [designDescriptionEditSignificant]);

  const showDesignDescriptionPolishOffer =
    !useCaseBundleGenerationBusy &&
    !designDescriptionPolishOfferDismissed &&
    (designDescriptionPolishBusy || designDescriptionEditSignificant);

  const onPolishUseCaseScenario = React.useCallback(
    async (useCaseId: string, scenarioText: string): Promise<AIAgentUseCase | null> => {
      const uc = params.useCases.find((u) => u.id === useCaseId);
      if (!uc) {
        params.onComposerIaError('Use case non trovato.');
        return null;
      }
      const raw = scenarioText.trim();
      if (raw.length < 8) return null;
      if (!model) {
        params.onComposerIaError(DESIGNER_LLM_MISSING_MODEL_MESSAGE);
        return null;
      }
      params.onClearUseCaseComposerError();
      setUseCaseComposerBusy(true);
      try {
        const { tag: outputLanguage } = resolveAiAgentOutputLanguage();
        const { scenario_llm } = await polishUseCaseScenarioApi({
          scenarioText: raw,
          provider,
          model,
          outputLanguage,
          callMeta: buildCallMeta(AI_CALL_PURPOSE.USE_CASE_POLISH_SCENARIO),
        });
        const merged = withScenarioText(uc, scenario_llm);
        const withVotes: AIAgentUseCase = {
          ...merged,
          designer_edit_confirmed: true,
          designer_payoff_vote: 'up',
        };
        params.setUseCases((prev) =>
          normalizeUseCaseSiblingOrder(
            prev.map((u) => (u.id === useCaseId ? withVotes : u)),
            'dialogue'
          )
        );
        return withVotes;
      } catch (e) {
        params.onComposerIaError(e instanceof Error ? e.message : String(e));
        return null;
      } finally {
        setUseCaseComposerBusy(false);
      }
    },
    [params.useCases, params.setUseCases, params.onClearUseCaseComposerError, params.onComposerIaError, provider, model, buildCallMeta]
  );

  const onRegenerateUseCase = React.useCallback(
    async (useCaseId: string): Promise<AIAgentUseCase | null> => {
      const uc = params.useCases.find((u) => u.id === useCaseId);
      if (!uc) {
        params.onComposerIaError('Use case non trovato.');
        return null;
      }
      if (!model) {
        params.onComposerIaError(DESIGNER_LLM_MISSING_MODEL_MESSAGE);
        return null;
      }
      params.onClearUseCaseComposerError();
      setUseCaseComposerBusy(true);
      try {
        const { tag: outputLanguage } = resolveAiAgentOutputLanguage();
        const next = await regenerateAIAgentUseCaseApi({
          useCase: uc,
          allUseCases: params.useCases,
          logicalSteps: [],
          provider,
          model,
          outputLanguage,
          globalStyleContract,
          globalStyleId: params.useCaseGlobalStyleId || DEFAULT_AI_AGENT_GLOBAL_USE_CASE_STYLE_ID,
          callMeta: buildCallMeta('USE_CASE_REGENERATE'),
        });
        const merged: AIAgentUseCase = {
          ...next,
          id: useCaseId,
          parent_id: uc.parent_id,
          sort_order: uc.sort_order,
          dialogue: next.dialogue.map((t) =>
            t.role === 'assistant' ? { ...t, motor_snapshot: undefined } : t
          ),
        };
        params.setUseCases((prev) =>
          normalizeUseCaseSiblingOrder(
            prev.map((u) => (u.id === useCaseId ? merged : u)),
            'dialogue'
          )
        );
        return merged;
      } catch (e) {
        params.onComposerIaError(e instanceof Error ? e.message : String(e));
        return null;
      } finally {
        setUseCaseComposerBusy(false);
      }
    },
    [
      params.useCases,
      params.setUseCases,
      params.useCaseGlobalStyleId,
      params.onClearUseCaseComposerError,
      params.onComposerIaError,
      provider,
      model,
      globalStyleContract,
      buildCallMeta,
    ]
  );

  const onGeneralizeUseCaseMeta = React.useCallback(
    async (useCaseId: string): Promise<AIAgentUseCase | null> => {
      const uc = params.useCases.find((u) => u.id === useCaseId);
      if (!uc) {
        params.onComposerIaError('Use case non trovato.');
        return null;
      }
      if (!model) {
        params.onComposerIaError(DESIGNER_LLM_MISSING_MODEL_MESSAGE);
        return null;
      }
      params.onClearUseCaseComposerError();
      setUseCaseComposerBusy(true);
      try {
        const { tag: outputLanguage } = resolveAiAgentOutputLanguage();
        const { label: nextLabel, payoff: nextPayoff } = await generalizeAIAgentUseCaseMetaApi({
          label: uc.label ?? '',
          payoff: typeof uc.payoff === 'string' ? uc.payoff : '',
          provider,
          model,
          outputLanguage,
          globalStyleContract,
          globalStyleId: params.useCaseGlobalStyleId || DEFAULT_AI_AGENT_GLOBAL_USE_CASE_STYLE_ID,
          callMeta: buildCallMeta(AI_CALL_PURPOSE.USE_CASE_GENERALIZE_META),
        });
        const merged: AIAgentUseCase = {
          ...uc,
          label: nextLabel,
          payoff: nextPayoff,
          designer_edit_confirmed: true,
          designer_label_vote: 'up',
          designer_payoff_vote: 'up',
        };
        params.setUseCases((prev) =>
          normalizeUseCaseSiblingOrder(
            prev.map((u) => (u.id === useCaseId ? merged : u)),
            'dialogue'
          )
        );
        return merged;
      } catch (e) {
        params.onComposerIaError(e instanceof Error ? e.message : String(e));
        return null;
      } finally {
        setUseCaseComposerBusy(false);
      }
    },
    [
      params.useCases,
      params.setUseCases,
      params.useCaseGlobalStyleId,
      params.onClearUseCaseComposerError,
      params.onComposerIaError,
      provider,
      model,
      globalStyleContract,
      buildCallMeta,
    ]
  );

  const onGenerateUseCaseBundle = React.useCallback(async () => {
    const baseUserDesc = `${params.designDescription.trim()}\n\n---\n\n${buildRefineUserDescFromSections(params.structuredRevision.effectiveBySection).trim()}`.trim();

    let userDesc = baseUserDesc;
    try {
      const kbCtx = await buildUserDescWithKnowledgeBaseContext({
        projectId: params.projectId,
        baseUserDesc,
        documents: params.knowledgeBaseDocuments,
      });
      userDesc = kbCtx.userDesc;
      if (kbCtx.kbWarnings.length > 0) {
        params.onComposerIaError(`Avvisi knowledge base: ${kbCtx.kbWarnings.join(' ')}`);
      } else {
        params.onClearUseCaseComposerError();
      }
    } catch (err) {
      params.onComposerIaError(
        err instanceof Error ? err.message : 'Lettura knowledge base non riuscita.'
      );
      return;
    }

    if (userDesc.length < AI_AGENT_MIN_INPUT_CHARS) {
      params.onComposerIaError(
        `Inserisci almeno ${AI_AGENT_MIN_INPUT_CHARS} caratteri nella descrizione (o documenti KB leggibili).`
      );
      return;
    }
    if (!model) {
      params.onComposerIaError(DESIGNER_LLM_MISSING_MODEL_MESSAGE);
      return;
    }

    setUseCaseBundleGenerationBusy(true);
    setUseCaseBundleGenerationCount(null);
    setUseCaseBundleGenerationOrdering(false);
    setUseCaseBundleGenerationCategorizing(false);
    try {
      const { tag: outputLanguage } = resolveAiAgentOutputLanguage();
      const extendMode = params.useCases.length > 0;
      const runtimeContext = params.structuredRevision.composedRuntimeMarkdown.trim();

      if (extendMode) {
        const { useCases: ucsNew } = await generateAIAgentUseCases({
          userDesc,
          provider,
          model,
          runtimeContext,
          outputLanguage,
          globalStyleContract,
          globalStyleId: params.useCaseGlobalStyleId || DEFAULT_AI_AGENT_GLOBAL_USE_CASE_STYLE_ID,
          extendFrom: { logicalSteps: [], useCases: params.useCases },
          callMeta: buildCallMeta(AI_CALL_PURPOSE.USE_CASE_GENERATE_MORE),
        });
        const newOnes = remapExtendUseCaseIds(
          normalizeUseCaseSiblingOrder(ucsNew, 'dialogue')
        );
        params.setUseCases((prev) =>
          normalizeUseCaseSiblingOrder([...prev, ...newOnes], 'dialogue')
        );
      } else {
        const initial = await generateAIAgentUseCases({
          userDesc,
          provider,
          model,
          runtimeContext,
          outputLanguage,
          globalStyleContract,
          globalStyleId: params.useCaseGlobalStyleId || DEFAULT_AI_AGENT_GLOBAL_USE_CASE_STYLE_ID,
          callMeta: buildCallMeta(AI_CALL_PURPOSE.USE_CASE_BUNDLE_INITIAL),
        });
        params.setUseCases(normalizeUseCaseSiblingOrder(initial.useCases, 'dialogue'));
      }
      params.onClearUseCaseComposerError();
    } catch (e) {
      params.onComposerIaError(e instanceof Error ? e.message : String(e));
    } finally {
      setUseCaseBundleGenerationBusy(false);
      setUseCaseBundleGenerationCount(null);
      setUseCaseBundleGenerationOrdering(false);
      setUseCaseBundleGenerationCategorizing(false);
    }
  }, [
    params.designDescription,
    params.structuredRevision,
    params.projectId,
    params.knowledgeBaseDocuments,
    params.useCases,
    params.setUseCases,
    params.useCaseGlobalStyleId,
    params.onClearUseCaseComposerError,
    params.onComposerIaError,
    provider,
    model,
    globalStyleContract,
    buildCallMeta,
  ]);

  return {
    designDescriptionPolishBaseline,
    showDesignDescriptionPolishOffer,
    designDescriptionPolishBusy,
    onPolishDesignDescription,
    onDismissDesignDescriptionPolishOffer,
    useCaseComposerBusy,
    useCaseBundleGenerationBusy,
    useCaseBundleGenerationCount,
    useCaseBundleGenerationOrdering,
    useCaseBundleGenerationCategorizing,
    onGenerateUseCaseBundle,
    onRegenerateUseCase,
    onGeneralizeUseCaseMeta,
    onPolishUseCaseScenario,
    buildUseCasePropagatorCallMeta: buildCallMeta,
  };
}
