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
import { isDDTEmpty, hasdataButNoStepPrompts } from '../../../../utils/ddt';
import { getdataList } from '../ddtSelectors';
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
  const stableDdtdataLength = ddt?.data?.length ?? 0;
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
    const currentMainList = getdataList(currentDDT);
    const firstMain = currentMainList[0];
    if (firstMain?.kind === 'intent') {
      setShowWizard(false);
      wizardOwnsDataRef.current = false;
      return;
    }

    const empty = isDDTEmpty(currentDDT);
    const hasStructureButNoMessages = hasdataButNoStepPrompts(currentDDT, task);

    // ✅ CRITICAL: Leggi da task.steps usando templateId come chiave (non id)
    // task.steps[node.templateId] = steps clonati
    if (!empty && currentDDT?.data && currentDDT.data.length > 0) {
      const firstMain = currentDDT.data[0];
      const firstMainId = firstMain?.id;
      const firstMainTemplateId = firstMain?.templateId || firstMain?.id; // ✅ Fallback a id se templateId non presente
      const hasSteps = !!(firstMainTemplateId && task?.steps && task.steps[firstMainTemplateId]);

      const allTaskStepsKeys = task?.steps ? Object.keys(task.steps) : [];
      // ✅ CRITICAL: Stampa chiavi come stringhe per debug
      console.log('[🔍 useWizardInference] 🔑 CHIAVI IN task.steps:', allTaskStepsKeys);
      console.log('[🔍 useWizardInference] 🔍 CERCHIAMO CHIAVE:', firstMainTemplateId);

      console.log('[🔍 useWizardInference] CRITICAL steps check', {
        dataCount: currentDDT.data.length,
        firstMainLabel: firstMain?.label,
        firstMainId: firstMainId,
        firstMainTemplateId: firstMainTemplateId,
        hasSteps,
        stepsType: typeof task?.steps,
        taskStepsKeys: allTaskStepsKeys,
        taskStepsKeysAsStrings: allTaskStepsKeys.join(', '), // ✅ Stringa per vedere tutte le chiavi
        taskStepsCount: allTaskStepsKeys.length,
        lookingForKey: firstMainTemplateId,
        keyExists: firstMainTemplateId ? !!(task?.steps?.[firstMainTemplateId]) : false,
        keyMatchDetails: firstMainTemplateId && task?.steps ? {
          exactMatch: task.steps[firstMainTemplateId] ? '✅ MATCH' : '❌ NO MATCH',
          allKeys: allTaskStepsKeys,
          keyComparison: allTaskStepsKeys.map(k => ({
            key: k,
            keyFull: k, // ✅ Mostra chiave completa
            matches: k === firstMainTemplateId,
            keyLength: k.length,
            templateIdLength: firstMainTemplateId.length,
            // ✅ Confronto carattere per carattere
            charByChar: k.length === firstMainTemplateId.length ? Array.from(k).map((char, idx) => ({
              pos: idx,
              keyChar: char,
              templateChar: firstMainTemplateId[idx],
              matches: char === firstMainTemplateId[idx],
              keyCode: char.charCodeAt(0),
              templateCode: firstMainTemplateId[idx]?.charCodeAt(0)
            })).filter(c => !c.matches).slice(0, 5) : 'LENGTH_MISMATCH'
          }))
        } : null,
        hasStructureButNoMessages
      });
    }

    // Se DDT non è vuoto e wizard aveva ownership → chiudi wizard
    // ✅ ECCEZIONE: Se ha struttura ma non ha messaggi, apri wizard per generare messaggi
    if (!empty && !hasStructureButNoMessages && wizardOwnsDataRef.current && showWizard) {
      setShowWizard(false);
      inferenceStartedRef.current = null;
      return;
    }

    // ✅ NUOVO: Se DDT ha struttura ma non ha messaggi → apri wizard al passo pipeline
    if (hasStructureButNoMessages) {
      console.log('[🔍 useWizardInference] ⚠️ DDT ha struttura ma non ha messaggi, aprendo wizard', {
        dataCount: currentDDT?.data?.length || 0,
        taskType: stableTaskType,
        taskId: task?.id,
        taskStepsCount: task?.steps ? Object.keys(task.steps).length : 0,
        taskStepsKeys: task?.steps ? Object.keys(task.steps) : [],
        firstMainTemplateId: currentDDT?.data?.[0]?.templateId || currentDDT?.data?.[0]?.id
      });

      // Apri wizard con initialDDT che contiene il data esistente
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
              data: currentDDT?.data || []
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
    // DDTHostAdapter gestisce tutto (caricamento + adattamento automatico)
    // ========================================================================
    if (isValidTemplateId(stableTemplateId)) {
      console.log('[useWizardInference] Template già trovato, DDTHostAdapter gestisce tutto', {
        templateId: stableTemplateId,
        taskType: stableTaskType
      });
      return; // ✅ Early exit - non serve wizard
    }

    // ✅ EARLY EXIT: Se task ha già steps, non serve wizard
    if (task?.steps && Object.keys(task.steps).length > 0) {
      console.log('[useWizardInference] Task con steps, non serve wizard', {
        taskId: task.id,
        stepsCount: Object.keys(task.steps).length
      });
      return; // ✅ Early exit - non serve wizard
    }

    // ========================================================================
    // VALIDATION: Solo DataRequest può usare wizard AI
    // ========================================================================
    const canUseWizard = stableTaskType === TaskType.UtteranceInterpretation;

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
          // Aggiorna task se era UNDEFINED
          if (task?.id && stableTaskType === TaskType.UNDEFINED) {
            try {
              taskRepository.updateTask(task.id, {
                type: TaskType.UtteranceInterpretation,
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
          const templateId = localMatch.ai.schema.data?.[0]?.templateId;
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
    stableDdtdataLength,
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
