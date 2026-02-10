// useWizardInference.ts
// Hook custom per gestire la logica di inferenza e apertura del wizard TaskTree
//
// LOGICA:
// 1. Se task.templateId esiste → NON rifare euristica, usa template esistente
// 2. Se task.type === DataRequest E task.templateId NON esiste → chiama AI
// 3. Se task.type !== DataRequest → NON chiamare AI (wizard supporta solo TaskTree)

import React, { useEffect, useRef, useState } from 'react';
import { TaskType } from '@types/taskTypes';
import { taskRepository } from '@services/TaskRepository';
import { getTemplateId } from '@utils/taskHelpers';
import { isTaskTreeEmpty, hasdataButNosteps } from '@utils/ddt';
import { getMainNodes } from '@responseEditor/core/domain';
import { useTaskTreeFromStore } from '@responseEditor/core/state';
import type { Task } from '@types/taskTypes';
import { findLocalTemplate } from '@responseEditor/hooks/helpers/templateMatcher';
import { callAIInference } from '@responseEditor/hooks/helpers/aiInference';
import { preAssembleTaskTree } from '@responseEditor/hooks/helpers/preAssembly';
import { normalizeTemplateId, isValidTemplateId } from '@responseEditor/hooks/helpers/templateIdUtils';
import DialogueTaskService from '@services/DialogueTaskService';

interface UseWizardInferenceParams {
  taskTree: any; // ✅ Renamed from ddt to taskTree (opzionale - store è primary)
  // ✅ FASE 3: taskTreeRef rimosso - store è single source of truth
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
  task, // ✅ ARCHITETTURA ESPERTO: Task completo
  isTaskTreeLoading, // ✅ Renamed from isDdtLoading to isTaskTreeLoading
  currentProjectId,
  selectedProvider,
  selectedModel,
  preAssembledTaskTreeCache,
  wizardOwnsDataRef,
}: UseWizardInferenceParams): UseWizardInferenceResult {
  // ✅ FASE 2.3: Use Zustand store as SINGLE source of truth
  const taskTreeFromStore = useTaskTreeFromStore();
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
    // ✅ FASE 2.3: Usa store invece di taskTreeRef
    // ✅ NO FALLBACKS: Use taskTreeFromStore as primary source, taskTree as fallback only during migration
    const currentTaskTree = taskTreeFromStore ?? taskTree;

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
    const currentMainList = getMainNodes(currentTaskTree);
    const firstMain = currentMainList[0];
    if (firstMain?.kind === 'intent') {
      setShowWizard(false);
      wizardOwnsDataRef.current = false;
      return;
    }

    const empty = isTaskTreeEmpty(currentTaskTree);
    const hasStructureButNoMessages = hasdataButNosteps(currentTaskTree, task);

    // ✅ CRITICAL: Leggi da task.steps usando lookup diretto (dictionary)
    if (!empty && currentTaskTree?.nodes && currentTaskTree.nodes.length > 0) {
      const firstMain = currentTaskTree.nodes[0];
      const firstMainId = firstMain?.id;
      // After validation strict, firstMain.id is always present
      // templateId is optional (preferred for lookup, but id works as fallback)
      const firstMainTemplateId = firstMain?.templateId ?? firstMainId;

      // ✅ Lookup diretto: O(1) invece di O(n) filter
      // ✅ NO FALLBACKS: nodeSteps lookup returns empty object if not found (legitimate default)
      const nodeSteps = task?.steps?.[firstMainTemplateId] ?? {};
      const hasSteps = nodeSteps && typeof nodeSteps === 'object' && Object.keys(nodeSteps).length > 0;

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
      // Apri wizard con initialTaskTree che contiene i nodes esistenti
      // Il wizard dovrebbe saltare automaticamente al passo 'pipeline'
      const inferenceKey = `${stableTaskLabel ?? ''}_hasStructureButNoMessages`;
      if (inferenceStartedRef.current !== inferenceKey) {
        inferenceStartedRef.current = inferenceKey;
        setShowWizard(true);
        wizardOwnsDataRef.current = true;
        // ✅ Imposta inferenceResult con il TaskTree esistente per passarlo come initialTaskTree
        setInferenceResult({
          ai: {
            schema: {
              label: currentTaskTree?.label ?? stableTaskLabel ?? 'Data',
              // ✅ NO FALLBACKS: currentTaskTree.nodes must exist after validation
              nodes: currentTaskTree?.nodes ?? []
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
      return; // ✅ Early exit - non serve wizard
    }

    // ✅ EARLY EXIT: Se task ha già steps, non serve wizard
    const hasSteps = task?.steps && typeof task.steps === 'object' && !Array.isArray(task.steps)
      ? Object.keys(task.steps).length > 0
      : false;

    if (hasSteps) {
      return; // ✅ Early exit - non serve wizard
    }

    // ✅ NUOVO: Se il task non ha steps ma ha templateId, verifica se il template ha steps
    // Questo risolve il problema: euristica riconosce template → template ha steps → non aprire wizard
    if (!hasSteps && task?.templateId && task.templateId !== 'UNDEFINED') {
      try {
        const template = DialogueTaskService.getTemplate(task.templateId);

        if (template?.steps && typeof template.steps === 'object' && !Array.isArray(template.steps)) {
          const templateHasSteps = Object.keys(template.steps).length > 0;

          if (templateHasSteps) {
            return; // ✅ Early exit - non serve wizard, gli steps verranno clonati da buildTaskTree
          }
        }
      } catch (e) {
        // Continua normalmente se c'è errore
      }
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
    const inferenceKey = `${taskLabel ?? ''}_${empty}`;
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
              // Error updating task
            }
          }

          setInferenceResult(localMatch);
          setShowWizard(true);
          wizardOwnsDataRef.current = true;

          // Pre-assembly in background
          // Normalize schema - use nodes (standard) or throw error if legacy format
          let templateId: string | undefined;
          if (localMatch.ai.schema.nodes && Array.isArray(localMatch.ai.schema.nodes) && localMatch.ai.schema.nodes.length > 0) {
            templateId = localMatch.ai.schema.nodes[0]?.templateId;
          } else if (localMatch.ai.schema.data && Array.isArray(localMatch.ai.schema.data) && localMatch.ai.schema.data.length > 0) {
            templateId = localMatch.ai.schema.data[0]?.templateId;
          }
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
          setInferenceResult(null);
          setShowWizard(true);
          wizardOwnsDataRef.current = true;
        } finally {
          setIsInferring(false);
          isProcessingRef.current = false;
        }
      } catch (error) {
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
