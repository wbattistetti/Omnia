// useWizardInference.ts
// Hook custom per gestire la logica di inferenza e apertura del wizard TaskTree
//
// LOGICA:
// 1. Se task.templateId esiste → NON rifare euristica, usa template esistente
// 2. Se task.type === DataRequest E task.templateId NON esiste → chiama AI
// 3. Se task.type !== DataRequest → NON chiamare AI (wizard supporta solo TaskTree)

import React, { useEffect, useRef, useState } from 'react';
import { TaskType } from '../../../../types/taskTypes';
import { taskRepository } from '../../../../services/TaskRepository';
import { getTemplateId } from '../../../../utils/taskHelpers';
import { isTaskTreeEmpty, hasdataButNosteps } from '../../../../utils/ddt';
import { getdataList } from '../ddtSelectors';
import type { Task } from '../../../../types/taskTypes';
import { findLocalTemplate } from './helpers/templateMatcher';
import { callAIInference } from './helpers/aiInference';
import { preAssembleTaskTree } from './helpers/preAssembly';
import { normalizeTemplateId, isValidTemplateId } from './helpers/templateIdUtils';

interface UseWizardInferenceParams {
  taskTree: any; // ✅ Renamed from ddt to taskTree
  taskTreeRef: React.MutableRefObject<any>; // ✅ Renamed from ddtRef to taskTreeRef
  task: Task | null | undefined; // ✅ ARCHITETTURA ESPERTO: Task completo, non TaskMeta
  isTaskTreeLoading: boolean; // ✅ Renamed from isDdtLoading to isTaskTreeLoading
  currentProjectId: string | null;
  selectedProvider: string;
  selectedModel: string;
  preAssembledTaskTreeCache: React.MutableRefObject<Map<string, { taskTree: any; _templateTranslations: Record<string, { en: string; it: string; pt: string }> }>>;
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
 * Hook custom per gestire la logica di inferenza e apertura del wizard TaskTree
 *
 * ✅ ARCHITETTURA ESPERTO: Decision engine puro basato su input già coerenti
 *
 * LOGICA CORRETTA:
 * 1. Se isTaskTreeLoading === true → non decidere ancora (early return)
 * 2. Se task?.templateId esiste → early exit vero, non chiamare AI
 * 3. Se taskTree non è vuoto → non chiamare AI
 * 4. Solo se: !isTaskTreeLoading && !task?.templateId && taskTree vuoto → allora chiami AI
 */
export function useWizardInference({
  taskTree, // ✅ Renamed from ddt to taskTree
  taskTreeRef, // ✅ Renamed from ddtRef to taskTreeRef
  task, // ✅ ARCHITETTURA ESPERTO: Task completo
  isTaskTreeLoading, // ✅ Renamed from isDdtLoading to isTaskTreeLoading
  currentProjectId,
  selectedProvider,
  selectedModel,
  preAssembledTaskTreeCache,
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
  const stableTaskTreeLabel = taskTree?.label ?? '';
  const stableTaskTreeNodesLength = taskTree?.nodes?.length ?? 0;
  const stableTaskId = task?.id ?? '';
  const stableTaskType = task?.type ?? TaskType.UNDEFINED;
  const stableTaskLabel = task?.label ?? '';
  const stableProvider = selectedProvider ?? '';
  const stableModel = selectedModel ?? '';

  // ✅ ARCHITETTURA ESPERTO: Normalizza templateId dal Task completo
  const rawTemplateId = getTemplateId(task);
  const stableTemplateId = normalizeTemplateId(rawTemplateId);

  useEffect(() => {
    const currentTaskTree = taskTreeRef?.current || taskTree;

    // ========================================================================
    // ✅ ARCHITETTURA ESPERTO: EARLY EXIT se dati non sono ancora caricati
    // ========================================================================
    if (isTaskTreeLoading) {
      // Aspetta che i dati siano caricati prima di decidere
      return;
    }

    // ========================================================================
    // EARLY EXITS - Condizioni che impediscono l'apertura del wizard
    // ========================================================================

    // Se kind === "intent" non mostrare wizard
    const currentMainList = getdataList(currentTaskTree);
    const firstMain = currentMainList[0];
    if (firstMain?.kind === 'intent') {
      setShowWizard(false);
      wizardOwnsDataRef.current = false;
      return;
    }

    const empty = isTaskTreeEmpty(currentTaskTree);
    const hasStructureButNoMessages = hasdataButNosteps(currentTaskTree, task);

    // ✅ CRITICAL: Leggi da task.steps usando templateId come chiave (non id)
    // task.steps[node.templateId] = steps clonati
    if (!empty && currentTaskTree?.nodes && currentTaskTree.nodes.length > 0) {
      const firstMain = currentTaskTree.nodes[0];
      const firstMainId = firstMain?.id;
      const firstMainTemplateId = firstMain?.templateId || firstMain?.id; // ✅ Fallback a id se templateId non presente
      const hasSteps = !!(firstMainTemplateId && task?.steps && task.steps[firstMainTemplateId]);

      const allTaskStepsKeys = task?.steps ? Object.keys(task.steps) : [];
      // ✅ CRITICAL: Stampa chiavi come stringhe per debug
      console.log('[🔍 useWizardInference] 🔑 CHIAVI IN task.steps:', allTaskStepsKeys);
      console.log('[🔍 useWizardInference] 🔍 CERCHIAMO CHIAVE:', firstMainTemplateId);

      console.log('[🔍 useWizardInference] CRITICAL steps check', {
        nodesCount: currentTaskTree.nodes.length,
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

    // Se TaskTree non è vuoto e wizard aveva ownership → chiudi wizard
    // ✅ ECCEZIONE: Se ha struttura ma non ha messaggi, apri wizard per generare messaggi
    if (!empty && !hasStructureButNoMessages && wizardOwnsDataRef.current && showWizard) {
      setShowWizard(false);
      inferenceStartedRef.current = null;
      return;
    }

    // ✅ NUOVO: Se TaskTree ha struttura ma non ha messaggi → apri wizard al passo pipeline
    if (hasStructureButNoMessages) {
      console.log('[🔍 useWizardInference] ⚠️ TaskTree ha struttura ma non ha messaggi, aprendo wizard', {
        nodesCount: currentTaskTree?.nodes?.length || 0,
        taskType: stableTaskType,
        taskId: task?.id,
        taskStepsCount: task?.steps ? Object.keys(task.steps).length : 0,
        taskStepsKeys: task?.steps ? Object.keys(task.steps) : [],
        firstMainTemplateId: currentTaskTree?.nodes?.[0]?.templateId || currentTaskTree?.nodes?.[0]?.id
      });

      // Apri wizard con initialTaskTree che contiene i nodes esistenti
      // Il wizard dovrebbe saltare automaticamente al passo 'pipeline'
      const inferenceKey = `${stableTaskLabel || ''}_hasStructureButNoMessages`;
      if (inferenceStartedRef.current !== inferenceKey) {
        inferenceStartedRef.current = inferenceKey;
        setShowWizard(true);
        wizardOwnsDataRef.current = true;
        // ✅ Imposta inferenceResult con il TaskTree esistente per passarlo come initialTaskTree
        setInferenceResult({
          ai: {
            schema: {
              label: currentTaskTree?.label || stableTaskLabel || 'Data',
              nodes: currentTaskTree?.nodes || []
            }
          }
        });
      }
      return;
    }

    // Se TaskTree non è vuoto e ha messaggi → non aprire wizard
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
    // TaskTreeHostAdapter gestisce tutto (caricamento + adattamento automatico)
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
          const templateId = localMatch.ai.schema.nodes?.[0]?.templateId || localMatch.ai.schema.data?.[0]?.templateId;
          await preAssembleTaskTree(
            localMatch.ai.schema,
            localMatch.ai.translationGuids,
            templateId,
            preAssembledTaskTreeCache
          );

          // Aggiorna inferenceResult con traduzioni se in cache
          if (templateId && preAssembledTaskTreeCache.current.has(templateId)) {
            const cached = preAssembledTaskTreeCache.current.get(templateId)!;
            setInferenceResult((prev: any) => ({
              ...prev,
              ai: {
                ...prev?.ai,
                templateTranslations: cached._templateTranslations,
                preAssembledTaskTree: cached.taskTree
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
    stableTaskTreeLabel,
    stableTaskTreeNodesLength,
    stableTaskId,
    stableTaskType,
    stableTaskLabel,
    stableProvider,
    stableModel,
    stableTemplateId, // ✅ Aggiunto per early exit
    isTaskTreeLoading, // ✅ ARCHITETTURA ESPERTO: Dipendenza critica
    isInferring,
    inferenceResult?.ai?.schema?.label ?? '',
    showWizard,
    taskTreeRef,
    wizardOwnsDataRef,
    currentProjectId,
    preAssembledTaskTreeCache,
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
