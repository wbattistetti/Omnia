// useWizardInference.ts
// Hook custom per gestire la logica di inferenza e apertura del wizard DDT
//
// LOGICA:
// 1. Se task.templateId esiste → NON rifare euristica, usa template esistente
// 2. Se task.type === DataRequest E task.templateId NON esiste → chiama AI
// 3. Se task.type !== DataRequest → NON chiamare AI (wizard supporta solo DDT)

import React, { useEffect, useRef, useState } from 'react';
import { TaskType } from '../../../../types/taskTypes';
import { taskRepository } from '../../../../services/TaskRepository';
import { getTemplateId } from '../../../../utils/taskHelpers';
import { isDDTEmpty, hasMainDataButNoStepPrompts } from '../../../../utils/ddt';
import { getMainDataList } from '../ddtSelectors';
import type { Task } from '../../../../types/taskTypes';
import { findLocalTemplate } from './helpers/templateMatcher';
import { callAIInference } from './helpers/aiInference';
import { preAssembleDDT } from './helpers/preAssembly';
import { normalizeTemplateId, isValidTemplateId } from './helpers/templateIdUtils';

interface UseWizardInferenceParams {
  ddt: any;
  ddtRef: React.MutableRefObject<any>;
  task: Task | null | undefined; // ✅ ARCHITETTURA ESPERTO: Task completo, non TaskMeta
  isDdtLoading: boolean; // ✅ ARCHITETTURA ESPERTO: Stato di loading
  currentProjectId: string | null;
  selectedProvider: string;
  selectedModel: string;
  preAssembledDDTCache: React.MutableRefObject<Map<string, { ddt: any; _templateTranslations: Record<string, { en: string; it: string; pt: string }> }>>;
  wizardOwnsDataRef: React.MutableRefObject<boolean>;
}

interface UseWizardInferenceResult {
  showWizard: boolean;
  setShowWizard: (value: boolean) => void;
  isInferring: boolean;
  setIsInferring: (value: boolean) => void;
  inferenceResult: any;
  setInferenceResult: (value: any) => void;
}

/**
 * Hook custom per gestire la logica di inferenza e apertura del wizard DDT
 *
 * ✅ ARCHITETTURA ESPERTO: Decision engine puro basato su input già coerenti
 *
 * LOGICA CORRETTA:
 * 1. Se isDdtLoading === true → non decidere ancora (early return)
 * 2. Se task?.templateId esiste → early exit vero, non chiamare AI
 * 3. Se ddt non è vuoto → non chiamare AI
 * 4. Solo se: !isDdtLoading && !task?.templateId && ddt vuoto → allora chiami AI
 */
export function useWizardInference({
  ddt,
  ddtRef,
  task, // ✅ ARCHITETTURA ESPERTO: Task completo
  isDdtLoading, // ✅ ARCHITETTURA ESPERTO: Stato di loading
  currentProjectId,
  selectedProvider,
  selectedModel,
  preAssembledDDTCache,
  wizardOwnsDataRef,
}: UseWizardInferenceParams): UseWizardInferenceResult {
  const [showWizard, setShowWizard] = useState<boolean>(false);
  const [isInferring, setIsInferring] = useState(false);
  const [inferenceResult, setInferenceResult] = useState<any>(null);

  // Refs per prevenire esecuzioni multiple e race conditions
  const inferenceStartedRef = useRef<string | null>(null);
  const inferenceAttemptedRef = useRef<string | null>(null);
  const isProcessingRef = useRef<boolean>(false);

  // Stabilizza valori primitivi
  const stableDdtLabel = ddt?.label ?? '';
  const stableDdtMainDataLength = ddt?.mainData?.length ?? 0;
  const stableTaskId = task?.id ?? '';
  const stableTaskType = task?.type ?? TaskType.UNDEFINED;
  const stableTaskLabel = task?.label ?? '';
  const stableProvider = selectedProvider ?? '';
  const stableModel = selectedModel ?? '';

  // ✅ ARCHITETTURA ESPERTO: Normalizza templateId dal Task completo
  const rawTemplateId = getTemplateId(task);
  const stableTemplateId = normalizeTemplateId(rawTemplateId);

  useEffect(() => {
    const currentDDT = ddtRef.current || ddt;

    // ========================================================================
    // ✅ ARCHITETTURA ESPERTO: EARLY EXIT se dati non sono ancora caricati
    // ========================================================================
    if (isDdtLoading) {
      // Aspetta che i dati siano caricati prima di decidere
      return;
    }

    // ========================================================================
    // EARLY EXITS - Condizioni che impediscono l'apertura del wizard
    // ========================================================================

    // Se kind === "intent" non mostrare wizard
    const currentMainList = getMainDataList(currentDDT);
    const firstMain = currentMainList[0];
    if (firstMain?.kind === 'intent') {
      setShowWizard(false);
      wizardOwnsDataRef.current = false;
      return;
    }

    const empty = isDDTEmpty(currentDDT);
    const hasStructureButNoMessages = hasMainDataButNoStepPrompts(currentDDT);

    // Se DDT non è vuoto e wizard aveva ownership → chiudi wizard
    // ✅ ECCEZIONE: Se ha struttura ma non ha messaggi, apri wizard per generare messaggi
    if (!empty && !hasStructureButNoMessages && wizardOwnsDataRef.current && showWizard) {
      setShowWizard(false);
      inferenceStartedRef.current = null;
      return;
    }

    // ✅ NUOVO: Se DDT ha struttura ma non ha messaggi → apri wizard al passo pipeline
    if (hasStructureButNoMessages) {
      console.log('[useWizardInference] DDT ha struttura ma non ha messaggi, aprendo wizard al passo pipeline', {
        mainDataCount: currentDDT?.mainData?.length || 0,
        taskType: stableTaskType
      });

      // Apri wizard con initialDDT che contiene il mainData esistente
      // Il wizard dovrebbe saltare automaticamente al passo 'pipeline'
      const inferenceKey = `${stableTaskLabel || ''}_hasStructureButNoMessages`;
      if (inferenceStartedRef.current !== inferenceKey) {
        inferenceStartedRef.current = inferenceKey;
        setShowWizard(true);
        wizardOwnsDataRef.current = true;
        // ✅ Imposta inferenceResult con il DDT esistente per passarlo come initialDDT
        setInferenceResult({
          ai: {
            schema: {
              label: currentDDT?.label || stableTaskLabel || 'Data',
              mainData: currentDDT?.mainData || []
            }
          }
        });
      }
      return;
    }

    // Se DDT non è vuoto e ha messaggi → non aprire wizard
    if (!empty) {
      return;
    }

    // Se wizard è già aperto o inferenza in corso → non fare nulla
    if (showWizard || isInferring || wizardOwnsDataRef.current || isProcessingRef.current) {
      return;
    }

    // ========================================================================
    // ✅ ARCHITETTURA ESPERTO: EARLY EXIT se templateId esiste (dal Task completo)
    // NON rifare euristica se template già trovato
    // ========================================================================
    if (isValidTemplateId(stableTemplateId)) {
      console.log('[useWizardInference] Template già trovato, non chiamare AI', {
        templateId: stableTemplateId,
        taskType: stableTaskType
      });
      // DDTHostAdapter caricherà il DDT dal template automaticamente
      return;
    }

    // ========================================================================
    // VALIDATION: Solo DataRequest può usare wizard AI
    // ========================================================================
    const canUseWizard = stableTaskType === TaskType.DataRequest;

    if (!canUseWizard) {
      // Per altri tipi, apri wizard vuoto (senza AI)
      const taskLabel = stableTaskLabel.trim();
      if (taskLabel.length >= 3) {
        const inferenceKey = `${taskLabel}_${empty}`;
        inferenceStartedRef.current = inferenceKey;
        setShowWizard(true);
        wizardOwnsDataRef.current = true;
      }
      return;
    }

    // ========================================================================
    // CASE: DataRequest senza template → chiama AI
    // ========================================================================

    const taskLabel = stableTaskLabel.trim();

    // Prevenire esecuzioni multiple
    const inferenceKey = `${taskLabel || ''}_${empty}`;
    if (inferenceStartedRef.current === inferenceKey) {
      return;
    }

    // Label deve avere almeno 3 caratteri
    if (!taskLabel || taskLabel.length < 3) {
      // Label troppo corta → apri wizard vuoto
      inferenceStartedRef.current = inferenceKey;
      setShowWizard(true);
      wizardOwnsDataRef.current = true;
      return;
    }

    // Già tentato per questa label
    if (inferenceAttemptedRef.current === taskLabel) {
      return;
    }

    // ========================================================================
    // STEP 1: Prova euristica locale (ultimo tentativo prima di AI)
    // ========================================================================

    (async () => {
      // Blocca chiamate multiple
      if (isProcessingRef.current) return;
      isProcessingRef.current = true;

      inferenceStartedRef.current = inferenceKey;
      inferenceAttemptedRef.current = taskLabel;

      try {
        // Prova euristica locale (solo se templateId NON esiste)
        const localMatch = await findLocalTemplate(taskLabel, stableTaskType);

        if (localMatch) {
          // Euristica trovata → usa template
          console.log('[useWizardInference] Template trovato via euristica locale', {
            templateId: localMatch.ai.schema.mainData?.[0]?.templateId
          });

          // Aggiorna task se era UNDEFINED
          if (task?.id && stableTaskType === TaskType.UNDEFINED) {
            try {
              taskRepository.updateTask(task.id, {
                type: TaskType.DataRequest,
                templateId: null
              }, currentProjectId || undefined);
            } catch (err) {
              console.error('[useWizardInference] Errore aggiornamento task:', err);
            }
          }

          setInferenceResult(localMatch);
          setShowWizard(true);
          wizardOwnsDataRef.current = true;

          // Pre-assembly in background
          const templateId = localMatch.ai.schema.mainData?.[0]?.templateId;
          await preAssembleDDT(
            localMatch.ai.schema,
            localMatch.ai.translationGuids,
            templateId,
            preAssembledDDTCache
          );

          // Aggiorna inferenceResult con traduzioni se in cache
          if (templateId && preAssembledDDTCache.current.has(templateId)) {
            const cached = preAssembledDDTCache.current.get(templateId)!;
            setInferenceResult((prev: any) => ({
              ...prev,
              ai: {
                ...prev?.ai,
                templateTranslations: cached._templateTranslations,
                preAssembledDDT: cached.ddt
              }
            }));
          }

          isProcessingRef.current = false;
          return; // Template trovato, non chiamare AI
        }

        // ====================================================================
        // STEP 2: Euristica non trovata → chiama AI
        // ====================================================================

        console.log('[useWizardInference] Template non trovato, chiamando AI', {
          taskType: stableTaskType,
          label: taskLabel
        });

        setIsInferring(true);

        try {
          const aiResult = await callAIInference(taskLabel, stableProvider, stableModel);

          setInferenceResult(aiResult);
          setShowWizard(true);
          wizardOwnsDataRef.current = true;
        } catch (error) {
          console.error('[useWizardInference] Errore inferenza AI:', error);
          setInferenceResult(null);
          setShowWizard(true);
          wizardOwnsDataRef.current = true;
        } finally {
          setIsInferring(false);
          isProcessingRef.current = false;
        }
      } catch (error) {
        console.error('[useWizardInference] Errore nel flusso di inferenza:', error);
        isProcessingRef.current = false;
      }
    })();
  }, [
    stableDdtLabel,
    stableDdtMainDataLength,
    stableTaskId,
    stableTaskType,
    stableTaskLabel,
    stableProvider,
    stableModel,
    stableTemplateId, // ✅ Aggiunto per early exit
    isDdtLoading, // ✅ ARCHITETTURA ESPERTO: Dipendenza critica
    isInferring,
    inferenceResult?.ai?.schema?.label ?? '',
    showWizard,
    ddtRef,
    wizardOwnsDataRef,
    currentProjectId,
    preAssembledDDTCache,
    task?.id, // ✅ ARCHITETTURA ESPERTO: Usa task.id invece di task?.instanceId
  ]);

  return {
    showWizard,
    setShowWizard,
    isInferring,
    setIsInferring,
    inferenceResult,
    setInferenceResult,
  };
}
