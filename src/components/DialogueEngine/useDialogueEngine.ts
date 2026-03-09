// React hook for Dialogue Engine

import { useState, useCallback, useRef } from 'react';
import type { Node, Edge } from 'reactflow';
import type { FlowNode, EdgeData } from '../Flowchart/types/flowTypes';
import type { CompiledTask, CompilationResult, ExecutionState } from '../FlowCompiler/types';
// Frontend DialogueEngine removed - backend orchestrator is now default
import { taskRepository } from '../../services/TaskRepository';
import { getTemplateId } from '../../utils/taskHelpers';
import { DialogueTaskService } from '../../services/DialogueTaskService';
import { taskTemplateService } from '../../services/TaskTemplateService';
import { templateIdToTaskType, TaskType } from '../../types/taskTypes';
import { useProjectData } from '../../context/ProjectDataContext';

interface UseDialogueEngineOptions {
  nodes: Node<FlowNode>[];
  edges: Edge<EdgeData>[];
  getTask: (taskId: string) => any;
  getDDT?: (taskId: string) => any;
  onTaskExecute: (task: CompiledTask) => Promise<any>;
  onComplete?: () => void;
  onError?: (error: Error) => void;
  onMessage?: (message: { id: string; text: string; stepType?: string; escalationNumber?: number; taskId?: string }) => void;
  onDDTStart?: (data: { ddt: any; taskId: string }) => void;
  onWaitingForInput?: (data: { taskId: string; nodeId?: string }) => void;
  translations?: Record<string, string>; // Add translations support
}

export function useDialogueEngine(options: UseDialogueEngineOptions) {
  const [executionState, setExecutionState] = useState<ExecutionState | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [currentTask, setCurrentTask] = useState<CompiledTask | null>(null);
  const engineRef = useRef<DialogueEngine | null>(null);
  const sessionIdRef = useRef<string | null>(null); // Store sessionId in a ref for real-time access

  // ✅ NEW: Get projectData for conditions
  const { data: projectData } = useProjectData();

  // 🎨 [HIGHLIGHT] Ref to track previous state for logging
  const prevStateRef = useRef<{ currentNodeId?: string | null; executedCount?: number }>({});

  // Expose currentTask for useNewFlowOrchestrator
  const getCurrentTask = useCallback(() => currentTask, [currentTask]);

  // Start execution - compiles flow only when Start is clicked
  const start = useCallback(async () => {
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('🚀 [useDialogueEngine] start() CALLED');
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('[useDialogueEngine] 📊 State check:', {
      isRunning,
      hasOptions: !!options,
      nodesCount: options?.nodes?.length || 0,
      edgesCount: options?.edges?.length || 0,
      hasTranslations: !!options?.translations,
      translationsCount: options?.translations ? Object.keys(options.translations).length : 0,
    });

    if (isRunning) {
      console.warn('[useDialogueEngine] ⚠️ Already running - aborting');
      return;
    }

    setIsRunning(true);

    try {
      // Ensure all tasks exist in memory before compilation
      // Enrich all rows with taskId (creates tasks in memory if missing)
      const { enrichRowsWithTaskId } = await import('../../utils/taskHelpers');
      const enrichedNodes = options.nodes.map(node => {
        if (node.data?.rows) {
          // Enrich rows and update node.data.rows with enriched version
          const enrichedRows = enrichRowsWithTaskId(node.data.rows);
          return {
            ...node,
            data: {
              ...node.data,
              rows: enrichedRows
            }
          };
        }
        return node;
      });

      // Compile flow HERE, only when Start is clicked
      // ✅ DEBUG: Log edges passed to compiler
      const elseEdgesCount = options.edges.filter(e => e.data?.isElse === true).length;
      if (elseEdgesCount > 0) {
        console.log('[useDialogueEngine][start] ✅ Else edges found before compilation', {
          elseEdgesCount,
          totalEdgesCount: options.edges.length,
          elseEdges: options.edges.filter(e => e.data?.isElse === true).map(e => ({
            id: e.id,
            label: e.label,
            source: e.source,
            target: e.target,
            hasData: !!e.data,
            isElse: e.data?.isElse,
            dataKeys: e.data ? Object.keys(e.data) : []
          }))
        });
      }

      // ═══════════════════════════════════════════════════════════════════════════
      // 🚀 CALL BACKEND COMPILER API
      // ═══════════════════════════════════════════════════════════════════════════
      console.log('═══════════════════════════════════════════════════════════════════════════');
      console.log('🚀 [FRONTEND] Calling backend compiler API...');
      console.log('═══════════════════════════════════════════════════════════════════════════');

      // ✅ NUOVA LOGICA ARCHITETTURALE: Prendi solo istanze referenziate dalle righe, poi risolvi template ricorsivamente
      // ✅ PRINCIPIO: row.id === task.id (se esiste nel TaskRepository, è un'istanza referenziata)
      // ✅ Nessun duplicato possibile: ogni task viene preso da una sola fonte

      // ✅ STEP 1: Raccogli tutti i taskId referenziati dalle righe dei nodi
      const referencedTaskIds = new Set<string>();
      enrichedNodes.forEach(node => {
        const rows = node.data?.rows || [];
        rows.forEach(row => {
          const taskId = row.id;
          if (taskId) {
            referencedTaskIds.add(taskId);
          }
        });
      });

      console.log('[useDialogueEngine] 🔍 Referenced task IDs from rows:', {
        referencedCount: referencedTaskIds.size,
        taskIds: Array.from(referencedTaskIds)
      });

      // ✅ STEP 2: Prendi solo le istanze referenziate (row.id === task.id)
      const referencedInstances = Array.from(referencedTaskIds)
        .map(taskId => {
          const task = taskRepository.getTask(taskId);
          if (!task) {
            console.warn(`[useDialogueEngine] ⚠️ Task ${taskId} not found in TaskRepository`);
            return null;
          }
          if (task.type === undefined || task.type === null) {
            console.error(`[useDialogueEngine] Task ${task.id} has no type field - skipping.`);
            return null;
          }
          return task;
        })
        .filter((task): task is any => task !== null);

      console.log('[useDialogueEngine] ✅ Referenced instances found:', {
        instancesCount: referencedInstances.length,
        instanceIds: referencedInstances.map(t => t.id)
      });

      // ✅ STEP 3: Assicurati che DialogueTaskService sia inizializzato
      if (!DialogueTaskService.isCacheLoaded()) {
        console.warn('[useDialogueEngine] ⚠️ DialogueTaskService cache not loaded, loading now...');
        await DialogueTaskService.loadTemplates();
      }

      // ✅ STEP 4: Raccogli template referenziati ricorsivamente (solo ID, sincrono)
      const collectedTemplateIds = new Set<string>();

      const collectTemplateIdsRecursive = (task: any) => {
        if (!task) return;

        // ✅ Raccogli templateId diretto
        const templateId = getTemplateId(task);
        if (templateId && !collectedTemplateIds.has(templateId)) {
          collectedTemplateIds.add(templateId);

          // ✅ Ricorsivamente raccogli template del template (solo ID, non caricare ancora)
          // Prova prima in DialogueTaskService (sincrono)
          let template = DialogueTaskService.getTemplate(templateId);
          if (!template) {
            // ✅ Fallback: cerca in getAllTemplates se getTemplate non trova
            const allTemplates = DialogueTaskService.getAllTemplates();
            template = allTemplates.find(t => t.id === templateId) || null;
          }
          if (template) {
            // ✅ Template trovato, raccogli ricorsivamente i suoi sub-template
            collectTemplateIdsRecursive(template);
          }
          // ✅ Se non trovato in DialogueTaskService, sarà cercato dopo in factory templates
        }

        // ✅ Raccogli sub-template (per UtteranceTaskDefinition con subTasksIds)
        if ((task as any).subTasksIds && Array.isArray((task as any).subTasksIds)) {
          (task as any).subTasksIds.forEach((subTaskId: string) => {
            if (subTaskId && !collectedTemplateIds.has(subTaskId)) {
              collectedTemplateIds.add(subTaskId);

              // ✅ Ricorsivamente raccogli template del sub-template (solo ID)
              let subTemplate = DialogueTaskService.getTemplate(subTaskId);
              if (!subTemplate) {
                const allTemplates = DialogueTaskService.getAllTemplates();
                subTemplate = allTemplates.find(t => t.id === subTaskId) || null;
              }
              if (subTemplate) {
                collectTemplateIdsRecursive(subTemplate);
              }
              // ✅ Se non trovato, sarà cercato dopo in factory templates
            }
          });
        }
      };

      // ✅ Raccogli template IDs per tutte le istanze referenziate (sincrono)
      referencedInstances.forEach(instance => {
        collectTemplateIdsRecursive(instance);
      });

      console.log('[useDialogueEngine] ✅ Collected template IDs:', {
        templatesCount: collectedTemplateIds.size,
        templateIds: Array.from(collectedTemplateIds)
      });

      // ✅ STEP 5: Carica tutti i template referenziati
      const referencedTemplates: any[] = [];
      const loadedTemplateIds = new Set<string>();

      // ✅ Carica template di progetto (sincrono)
      const allDialogueTaskServiceTemplates = DialogueTaskService.getAllTemplates();
      Array.from(collectedTemplateIds).forEach(templateId => {
        // ✅ Prova prima da DialogueTaskService (template di progetto)
        let template = DialogueTaskService.getTemplate(templateId);
        if (!template) {
          // ✅ Fallback: cerca in getAllTemplates
          template = allDialogueTaskServiceTemplates.find(t => t.id === templateId) || null;
        }
        if (template) {
          // ✅ Filtra solo template di progetto (source !== 'Factory')
          const source = (template as any).source;
          if (source !== 'Factory') {
            referencedTemplates.push(template);
            loadedTemplateIds.add(templateId);
          }
        }
      });

      // ✅ Carica template di factory (async) - solo quelli non trovati in DialogueTaskService
      const factoryTemplateIds = Array.from(collectedTemplateIds).filter(id => !loadedTemplateIds.has(id));

      if (factoryTemplateIds.length > 0) {
        const allFactoryTemplatesRaw = await taskTemplateService.getAllTemplates();
        factoryTemplateIds.forEach(templateId => {
          const factoryTemplate = allFactoryTemplatesRaw.find(t => t.id === templateId);
          if (factoryTemplate) {
            const factoryTemplateAny = factoryTemplate as any;
            // ✅ Convert factory template to DialogueTask format
            referencedTemplates.push({
              id: factoryTemplate.id,
              label: factoryTemplate.label,
              type: factoryTemplate.type,
              name: factoryTemplateAny.name,
              // ✅ Map nlpContract → dataContract (factory templates use nlpContract)
              dataContract: factoryTemplateAny.nlpContract || factoryTemplateAny.dataContract || factoryTemplateAny.semanticContract || null,
              semanticContract: factoryTemplateAny.semanticContract,
              // ✅ Include all other fields from factory template
              ...factoryTemplateAny
            });
          }
        });
      }

      console.log('[useDialogueEngine] ✅ Referenced templates loaded:', {
        templatesCount: referencedTemplates.length,
        templateIds: referencedTemplates.map(t => t.id)
      });

      // ✅ STEP 6: Combina istanze + template (nessun duplicato possibile)
      const allTasksWithTemplates = [
        ...referencedInstances,
        ...referencedTemplates
      ];

      console.log('[useDialogueEngine] 📦 Final task list (instances + templates):', {
        instancesCount: referencedInstances.length,
        templatesCount: referencedTemplates.length,
        totalCount: allTasksWithTemplates.length,
        allTaskIds: allTasksWithTemplates.map(t => t.id)
      });

      // ✅ Extract DDTs only from referenced GetData tasks (keep existing logic for DDTs)
      // DDTs are still extracted only from referenced tasks, as they are flow-specific
      // ✅ referencedTaskIds è già stato dichiarato sopra (STEP 1), riutilizzalo
      // Non serve ridichiararlo - è già stato popolato con tutti i taskId dalle righe

      const allDDTs: any[] = [];
      Array.from(referencedTaskIds).forEach(taskId => {
        const task = taskRepository.getTask(taskId);
        if (task) {
          const templateId = getTemplateId(task);
          if (templateId && templateIdToTaskType(templateId) === TaskType.UtteranceInterpretation && task.data && task.data.length > 0) {
            allDDTs.push({
              label: task.label,
              data: task.data,
              steps: task.steps
            });
          }
        }
      });

      // ✅ DEBUG: Log complete graph payload
      if (allTasksWithTemplates.length > 0) {
        console.log('[FRONTEND] Complete graph being sent to backend:');
        allTasksWithTemplates.slice(0, 5).forEach((task, idx) => {
          console.log(`  Task[${idx}]:`, {
            id: task.id,
            type: task.type,
            typeName: task.type !== undefined && task.type !== null ? `TaskType[${task.type}]` : 'MISSING',
            templateId: task.templateId,
            hasDataContract: !!(task.dataContract),
            hasSemanticContract: !!(task.semanticContract),
            hasdata: !!(task.data && task.data.length > 0)
          });
        });
      }

      console.log('[FRONTEND] Preparing compilation request with complete graph:', {
        nodesCount: enrichedNodes.length,
        edgesCount: options.edges.length,
        totalTasksCount: allTasksWithTemplates.length,
        referencedInstancesCount: referencedInstances.length,
        referencedTemplatesCount: referencedTemplates.length,
        ddtsCount: allDDTs.length
      });

      // ✅ REMOVED RUBY: Frontend now calls VB.NET ApiServer directly (port 5000)
      // This eliminates the unnecessary proxy hop and ensures conditions are passed correctly
      const baseUrl = 'http://localhost:5000';

      // ❌ POSTEGGIATO: Logica switch backendType - non usata per ora
      // const backendType = (() => {
      //   try {
      //     const stored = localStorage.getItem('omnia_backend_type');
      //     return stored === 'vbnet' ? 'vbnet' : 'react';
      //   } catch {
      //     return 'react';
      //   }
      // })();
      // const baseUrl = backendType === 'vbnet' ? 'http://localhost:5000' : 'http://localhost:3100';

      // Transform nodes from ReactFlow structure (data.rows) to simplified structure (rows directly)
      // VB.NET backend expects: { id, label, rows: [...] } (no data wrapper)
      const { transformNodesToSimplified } = await import('../../flows/flowTransformers');

      // 🔍 DEBUG: Log all rows before transformation
      console.log('═══════════════════════════════════════════════════════════════════════════');
      console.log('🔍 [FRONTEND] Nodes BEFORE transformation:');
      enrichedNodes.forEach((node, idx) => {
        const rows = node.data?.rows || [];
        console.log(`  Node[${idx}]:`, {
          nodeId: node.id,
          label: node.data?.label || '',
          rowsCount: rows.length,
          rows: rows.map((r: any) => ({
            id: r.id,
            text: r.text,
            included: r.included,
            taskId: r.taskId,
            type: r.type,
            mode: r.mode
          }))
        });
      });
      console.log('═══════════════════════════════════════════════════════════════════════════');

      const simplifiedNodes = transformNodesToSimplified(enrichedNodes);

      // ✅ FIX: Ensure all rows have taskId field (backend VB.NET requires it)
      // task.id === row.id ALWAYS, so we set taskId = row.id
      const nodesWithTaskId = simplifiedNodes.map(node => ({
        ...node,
        rows: (node.rows || []).map((row: any) => ({
          ...row,
          // ✅ CRITICAL: Backend VB.NET requires explicit taskId field
          // task.id === row.id ALWAYS (when task exists)
          taskId: row.taskId || row.id
        }))
      }));

      // 🔍 DEBUG: Log all rows after transformation
      console.log('═══════════════════════════════════════════════════════════════════════════');
      console.log('🔍 [FRONTEND] Nodes AFTER transformation:');
      nodesWithTaskId.forEach((node, idx) => {
        console.log(`  Node[${idx}]:`, {
          nodeId: node.id,
          label: node.label || '',
          rowsCount: node.rows?.length || 0,
          rows: node.rows?.map((r: any) => ({
            id: r.id,
            text: r.text,
            included: r.included,
            taskId: r.taskId,
            type: r.type,
            mode: r.mode
          })) || []
        });
      });
      console.log('═══════════════════════════════════════════════════════════════════════════');

      // ✅ Get translations from options or global context (already in memory)
      let translations: Record<string, string> = {};
      if (options.translations && Object.keys(options.translations).length > 0) {
        translations = options.translations;
      } else {
        // Fallback: Try to get from window or context
        try {
          const globalTranslations = (window as any).__globalTranslations || {};
          translations = globalTranslations;
        } catch (e) {
          console.warn('[useDialogueEngine] ⚠️ Could not load translations for compilation', e);
        }
      }

      // ✅ NEW: Extract conditions from projectData (only referenced ones)
      // ✅ Read conditionId from top-level (not from data)
      const referencedConditionIds = new Set(
        (options.edges || [])
          .map((e: any) => e.conditionId)
          .filter(Boolean)
      );

      console.log('[useDialogueEngine] 🔍 Extracting conditions', {
        referencedConditionIds: Array.from(referencedConditionIds),
        edgesCount: (options.edges || []).length,
        edgesWithConditionId: (options.edges || []).filter((e: any) => e.conditionId).map((e: any) => ({
          id: e.id,
          label: e.label,
          conditionId: e.conditionId
        }))
      });

      // ✅ DEBUG: Log all project conditions before filtering
      const allProjectConditions = (projectData as any)?.conditions
        ? (projectData as any).conditions.flatMap((cat: any) => cat.items || [])
        : [];

      console.log('[useDialogueEngine] 🔍 DEBUG: All project conditions before filtering', {
        totalProjectConditions: allProjectConditions.length,
        allConditionIds: allProjectConditions.map((item: any) => ({
          id: item.id,
          _id: item._id,
          both: item.id || item._id,
          name: item.name || item.label,
          hasUiCode: !!item.data?.uiCode,
          hasScript: !!item.data?.script
        })),
        referencedConditionIds: Array.from(referencedConditionIds)
      });

      const conditions = (projectData as any)?.conditions
        ? (projectData as any).conditions
          .flatMap((cat: any) => cat.items || [])
          .filter((item: any) => {
            const itemId = item.id || item._id;
            const isInSet = itemId && referencedConditionIds.has(itemId);
            if (!isInSet && itemId) {
              console.log('[useDialogueEngine] ⚠️ Condition not in referenced set', {
                itemId,
                itemName: item.name || item.label,
                referencedConditionIds: Array.from(referencedConditionIds),
                match: referencedConditionIds.has(itemId)
              });
            }
            return isInSet;
          })
          .map((item: any) => ({
            id: item.id || item._id,
            name: item.name || item.label,
            label: item.label || item.name,
            data: {
              script: item.data?.script || item.data?.execCode || '',
              uiCode: item.data?.uiCode || '',
              uiCodeFormat: item.data?.uiCodeFormat || 'dsl',
              ast: item.data?.ast || ''
            }
          }))
        : [];

      console.log('[useDialogueEngine] ✅ Conditions extracted', {
        conditionsCount: conditions.length,
        conditionIds: conditions.map((c: any) => c.id),
        conditionsWithUiCode: conditions.filter((c: any) => c.data?.uiCode).length,
        matchedConditions: conditions.map((c: any) => ({
          id: c.id,
          name: c.name,
          hasUiCode: !!c.data?.uiCode,
          hasScript: !!c.data?.script
        }))
      });

      // ✅ Filter out orphan edges (edges pointing to non-existent or hidden nodes)
      const validNodeIds = new Set(nodesWithTaskId.map(n => n.id));
      const filteredEdges = (options.edges || []).filter((e: any) => {
        const targetExists = validNodeIds.has(e.target);
        const sourceExists = validNodeIds.has(e.source);

        if (!targetExists || !sourceExists) {
          console.warn('[useDialogueEngine] ⚠️ Filtering out orphan edge', {
            edgeId: e.id,
            label: e.label,
            source: e.source,
            target: e.target,
            sourceExists,
            targetExists
          });
          return false;
        }

        // Also filter out edges connected to hidden/temporary nodes
        const targetNode = nodesWithTaskId.find(n => n.id === e.target);
        const sourceNode = nodesWithTaskId.find(n => n.id === e.source);
        const isTargetHidden = targetNode?.data?.hidden === true || targetNode?.data?.isTemporary === true;
        const isSourceHidden = sourceNode?.data?.hidden === true || sourceNode?.data?.isTemporary === true;

        if (isTargetHidden || isSourceHidden) {
          console.warn('[useDialogueEngine] ⚠️ Filtering out edge connected to hidden/temporary node', {
            edgeId: e.id,
            label: e.label,
            isTargetHidden,
            isSourceHidden
          });
          return false;
        }

        return true;
      });

      // ✅ DEBUG: Log edge filtering
      if ((options.edges || []).length !== filteredEdges.length) {
        console.log('[useDialogueEngine] 🔍 Edge filtering', {
          originalEdgesCount: (options.edges || []).length,
          filteredEdgesCount: filteredEdges.length,
          removedEdgesCount: (options.edges || []).length - filteredEdges.length,
          removedEdges: (options.edges || []).filter((e: any) => {
            const targetExists = validNodeIds.has(e.target);
            const sourceExists = validNodeIds.has(e.source);
            const targetNode = nodesWithTaskId.find(n => n.id === e.target);
            const sourceNode = nodesWithTaskId.find(n => n.id === e.source);
            const isTargetHidden = targetNode?.data?.hidden === true || targetNode?.data?.isTemporary === true;
            const isSourceHidden = sourceNode?.data?.hidden === true || sourceNode?.data?.isTemporary === true;
            return !targetExists || !sourceExists || isTargetHidden || isSourceHidden;
          }).map((e: any) => ({
            id: e.id,
            label: e.label,
            source: e.source,
            target: e.target
          }))
        });
      }

      // ✅ DEBUG: Log tasks before serialization to verify type field
      const requestBody = {
        nodes: nodesWithTaskId,  // ✅ Use nodes with taskId field (backend VB.NET requires it)
        edges: filteredEdges,  // ✅ Use filtered edges (no orphans)
        tasks: allTasksWithTemplates,  // ✅ Include both instance tasks and referenced templates
        ddts: allDDTs,
        projectId: localStorage.getItem('currentProjectId') || undefined,
        translations: translations, // ✅ Pass translations table (already in memory) - runtime will do lookup at execution time
        conditions: conditions // ✅ NEW: Pass conditions for validation
      };

      // ✅ DEBUG: Verifica che tutti i task referenziati nei nodi siano presenti in requestBody.tasks
      // Nota: referencedTaskIds potrebbe essere già dichiarato sopra, usiamo un nome diverso per evitare conflitti
      const referencedTaskIdsInRequestBody = new Set<string>();
      options.nodes.forEach(node => {
        node.rows?.forEach((row: any) => {
          if (row.taskId) {
            referencedTaskIdsInRequestBody.add(row.taskId);
          }
        });
      });

      const missingReferencedTasks = Array.from(referencedTaskIdsInRequestBody).filter(taskId => {
        return !requestBody.tasks.find((t: any) => t.id === taskId);
      });

      if (missingReferencedTasks.length > 0) {
        console.error('[useDialogueEngine] ❌ MISSING REFERENCED TASKS:', {
          missingTaskIds: missingReferencedTasks,
          totalReferencedTasks: referencedTaskIdsInRequestBody.size,
          totalTasksInRequestBody: requestBody.tasks.length,
          referencedTaskIds: Array.from(referencedTaskIdsInRequestBody).slice(0, 10),
          taskIdsInRequestBody: requestBody.tasks.map((t: any) => t.id).slice(0, 10)
        });
      } else {
        console.log('[useDialogueEngine] ✅ All referenced tasks are present in requestBody:', {
          totalReferencedTasks: referencedTaskIdsInRequestBody.size,
          totalTasksInRequestBody: requestBody.tasks.length
        });
      }

      // Log first few tasks to verify type field is present
      if (allTasksWithTemplates.length > 0) {
        console.log('[FRONTEND] Complete graph in request body (before JSON.stringify):');
        allTasksWithTemplates.slice(0, 3).forEach((task, idx) => {
          console.log(`  Task[${idx}]:`, {
            id: task.id,
            type: task.type,
            typeName: task.type !== undefined && task.type !== null ? `TaskType[${task.type}]` : 'MISSING',
            templateId: task.templateId,
            hasDataContract: !!(task.dataContract),
            hasdata: !!(task.data && task.data.length > 0)
          });
        });

        // ✅ DEBUG: Log conditions in request body before serialization
        console.log('[FRONTEND] Request body conditions (before JSON.stringify):', {
          conditionsCount: requestBody.conditions?.length || 0,
          conditionIds: requestBody.conditions?.map((c: any) => c.id) || [],
          conditionsPreview: requestBody.conditions?.map((c: any) => ({
            id: c.id,
            name: c.name,
            hasUiCode: !!c.data?.uiCode,
            hasScript: !!c.data?.script
          })) || []
        });

        // Log serialized JSON preview to verify type is in JSON
        const jsonString = JSON.stringify(requestBody);
        const jsonPreview = jsonString.substring(0, 2000);
        console.log('[FRONTEND] Request body JSON preview (first 2000 chars):', jsonPreview);

        // ✅ DEBUG: Verify conditions are in JSON string
        const conditionsInJson = jsonString.includes('"conditions"');
        const conditionsArrayInJson = jsonString.includes('"conditions":[');
        console.log('[FRONTEND] Conditions in JSON string:', {
          hasConditionsKey: conditionsInJson,
          hasConditionsArray: conditionsArrayInJson,
          jsonLength: jsonString.length,
          conditionsJsonPreview: conditionsInJson ? jsonString.substring(jsonString.indexOf('"conditions"'), Math.min(jsonString.indexOf('"conditions"') + 500, jsonString.length)) : 'NOT FOUND'
        });

        // Check if type is in JSON string
        const hasTypeInJson = jsonPreview.includes('"type"');
        console.log(`[FRONTEND] Does JSON contain "type" field? ${hasTypeInJson}`);
      }

      // ✅ DEBUG: Verify conditions are in the JSON that will be sent
      const requestBodyJson = JSON.stringify(requestBody);
      const conditionsInRequestJson = requestBodyJson.includes('"conditions"');
      console.log('[FRONTEND] Conditions in request JSON (before fetch):', {
        hasConditionsKey: conditionsInRequestJson,
        requestJsonLength: requestBodyJson.length,
        conditionsJsonPreview: conditionsInRequestJson
          ? requestBodyJson.substring(
            requestBodyJson.indexOf('"conditions"'),
            Math.min(requestBodyJson.indexOf('"conditions"') + 500, requestBodyJson.length)
          )
          : 'NOT FOUND',
        requestBodyKeys: Object.keys(requestBody)
      });

      // Call backend API (NO FALLBACK - backend only)
      const compileResponse = await fetch(`${baseUrl}/api/runtime/compile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: requestBodyJson
      });

      console.log(`[FRONTEND] Response status: ${compileResponse.status} ${compileResponse.statusText}`);
      console.log(`[FRONTEND] Response headers:`, Object.fromEntries(compileResponse.headers.entries()));

      if (!compileResponse.ok) {
        const errorText = await compileResponse.text().catch(() => 'Unable to read error response');
        console.error(`[FRONTEND] ❌ Backend compilation failed (${compileResponse.status}):`, errorText);
        let errorData: any = { error: 'Unknown error' };
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText || 'Unknown error' };
        }
        throw new Error(`Backend compilation failed: ${errorData.message || errorData.error || errorData.detail || compileResponse.statusText}`);
      }

      const responseText = await compileResponse.text();
      console.log(`[FRONTEND] Response body length: ${responseText.length} characters`);
      console.log(`[FRONTEND] Response body preview:`, responseText.substring(0, 200));

      if (!responseText || responseText.trim().length === 0) {
        throw new Error('Backend returned empty response');
      }

      let compileData: any;
      try {
        compileData = JSON.parse(responseText);
      } catch (parseError) {
        console.error(`[FRONTEND] ❌ Failed to parse JSON response:`, parseError);
        console.error(`[FRONTEND] Response text:`, responseText);
        throw new Error(`Failed to parse backend response: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
      }

      // Log original JSON from compiler
      console.log('[FRONTEND] ✅ Compilation data received:', {
        hasTaskGroups: !!compileData.taskGroups,
        taskGroupsCount: compileData.taskGroups?.length || 0,
        entryTaskGroupId: compileData.entryTaskGroupId,
        tasksCount: compileData.tasks?.length || 0
      });

      // Convert taskMap from object back to Map (for frontend use only)
      const taskMap = new Map<string, CompiledTask>();
      if (compileData.taskMap) {
        Object.entries(compileData.taskMap).forEach(([key, value]) => {
          taskMap.set(key, value as CompiledTask);
        });
      }

      // Create CompilationResult for frontend use (if needed)
      const compilationResult: CompilationResult = {
        tasks: compileData.tasks || [],
        entryTaskId: compileData.entryTaskId || compileData.entryTaskGroupId || null, // Support both entryTaskId and entryTaskGroupId
        taskMap,
        // Preserve VB.NET backend fields
        taskGroups: compileData.taskGroups || undefined,
        entryTaskGroupId: compileData.entryTaskGroupId || null,
        // ✅ Error handling
        errors: compileData.errors || undefined,
        hasErrors: compileData.hasErrors || false
      };

      // ✅ Check for blocking errors BEFORE starting orchestrator
      if (compilationResult.errors && compilationResult.errors.length > 0) {
        // ✅ Store errors in context IMMEDIATELY (reactive React state)
        // Use global setter that can be called from async callbacks
        try {
          const { setCompilationErrorsGlobal } = await import('../../context/CompilationErrorsContext');
          setCompilationErrorsGlobal(compilationResult.errors);
          console.log('[useDialogueEngine] ✅ Errors set in context (reactive):', compilationResult.errors.length);
        } catch (e) {
          console.error('[useDialogueEngine] ❌ Failed to store errors in context:', e);
          // Note: No fallback to window - context should always be available
        }

        // ✅ Normalize severity: backend sends "Error"/"Warning" (PascalCase), frontend expects 'error'/'warning'
        const { normalizeSeverity } = await import('../../utils/severityUtils');
        const blockingErrors = compilationResult.errors.filter(
          e => normalizeSeverity(e.severity) === 'error'
        );

        if (blockingErrors.length > 0) {
          // ✅ Open Error Report Panel automatically
          try {
            const { openErrorReportPanelService } = await import('../../services/ErrorReportPanelService');
            openErrorReportPanelService();
          } catch (e) {
            console.error('[useDialogueEngine] ❌ Failed to open Error Report Panel:', e);
          }

          // ✅ Show user-friendly message in chat
          const { formatCompilationErrorMessage } = await import('../../utils/errorMessageFormatter');
          const errorMessage = formatCompilationErrorMessage(blockingErrors);

          if (options.onMessage) {
            options.onMessage({
              id: `error-${Date.now()}`,
              text: errorMessage + '\n\n💡 Apri il pannello Error Report per vedere i dettagli e selezionare i nodi con problemi.',
              stepType: 'error',
              taskId: 'SYSTEM'
            });
          }

          // Don't start orchestrator
          setIsRunning(false);
          setCurrentTask(null);
          options.onError?.(new Error(`Compilation has ${blockingErrors.length} blocking errors. Fix errors before execution.`));
          return;
        }

        // Only warnings - show info but allow execution
        const { formatCompilationWarningMessage } = await import('../../utils/errorMessageFormatter');
        const warningMessage = formatCompilationWarningMessage(compilationResult.errors);
        if (warningMessage && options.onMessage) {
          options.onMessage({
            id: `warning-${Date.now()}`,
            text: warningMessage,
            stepType: 'warning',
            taskId: 'SYSTEM'
          });
        }
      }

      // ═══════════════════════════════════════════════════════════════════════════
      // 🚀 FLOW ORCHESTRATOR - EXECUTION LOCATION TRACKING
      // ═══════════════════════════════════════════════════════════════════════════
      console.log('═══════════════════════════════════════════════════════════════════════════');
      console.log('🚀 [FLOW ORCHESTRATOR] Starting Execution');
      console.log('═══════════════════════════════════════════════════════════════════════════');
      console.log('');
      console.log('📊 [ARCHITECTURE SUMMARY]');
      console.log('');
      console.log('✅ [COMPILATION] Location: BACKEND');
      console.log('   └─ Endpoint: POST /api/runtime/compile');
      console.log('   └─ Compiler: backend/runtime/compiler/compiler.ts');
      console.log('   └─ Status: COMPLETED');
      console.log('   └─ CompiledBy:', compileData.compiledBy || 'BACKEND_RUNTIME');
      console.log('   └─ TaskGroups:', compileData.taskGroups?.length || 0);
      console.log('   └─ EntryTaskGroupId:', compileData.entryTaskGroupId);
      console.log('');

      // Check if we should use backend orchestrator
      const useBackendOrchestrator = (() => {
        try {
          // Default to backend - only use frontend if explicitly disabled
          const flag = localStorage.getItem('orchestrator.useBackend');
          return flag !== 'false'; // Default to true if not set
        } catch {
          return true; // Default to backend on error
        }
      })();

      if (useBackendOrchestrator) {
        console.log('✅ [ORCHESTRATOR] Location: BACKEND');
        console.log('   └─ Endpoint: POST /api/runtime/orchestrator/session/start');
        console.log('   └─ Engine: backend/runtime/orchestrator/engine.ts');
        console.log('   └─ Communication: SSE (Server-Sent Events)');
        console.log('   └─ Status: USING BACKEND ✅');
        console.log('');
        console.log('✅ [DDT ENGINE] Location: BACKEND');
        console.log('   └─ Endpoint: POST /api/runtime/ddt/session/start');
        console.log('   └─ Engine: backend/runtime/ddt/ddtEngine.ts');
        console.log('   └─ Called: When GetData task executes');
        console.log('');
        console.log('📝 [CURRENT STATE]');
        console.log('   • Compilation: BACKEND ✅');
        console.log('   • Orchestrator: BACKEND ✅');
        console.log('   • DDT Engine: BACKEND ✅');
        console.log('═══════════════════════════════════════════════════════════════════════════');

        // Use backend orchestrator via SSE
        const { executeOrchestratorBackend } = await import('./orchestratorAdapter');

        // Get translations - prefer from options, fallback to global context
        let translations: Record<string, string> = {};

        // 1. Try from options (most reliable, passed from useNewFlowOrchestrator)
        if (options.translations && Object.keys(options.translations).length > 0) {
          translations = options.translations;
          console.log('[useDialogueEngine] ✅ Using translations from options', {
            translationsCount: Object.keys(translations).length,
            sampleKeys: Object.keys(translations).slice(0, 5)
          });
        } else {
          // 2. Fallback: Try to get from window or context
          try {
            const globalTranslations = (window as any).__globalTranslations || {};
            Object.assign(translations, globalTranslations);
            console.log('[useDialogueEngine] ⚠️ Using translations from window (fallback)', {
              translationsCount: Object.keys(translations).length
            });
          } catch (e) {
            console.warn('[useDialogueEngine] ⚠️ Could not load translations from any source', e);
          }
        }

        // Pass original JSON from compiler directly to orchestrator (no transformation!)
        const orchestratorControl = await executeOrchestratorBackend(
          compileData, // ✅ Pass original JSON - preserves taskGroups, entryTaskGroupId, etc.
          allTasksWithTemplates, // ✅ Use allTasksWithTemplates (contains instances + templates)
          allDDTs,
          translations,
          {
            onMessage: (message) => {
              // Messages from backend orchestrator - forward to onMessage callback
              console.log('[useDialogueEngine] Message from backend orchestrator', {
                messageId: message.id,
                text: message.text?.substring(0, 50),
                stepType: message.stepType,
                taskId: message.taskId
              });
              if (options.onMessage) {
                options.onMessage(message);
              }
            },
            onDDTStart: (data) => {
              // DDT start from backend orchestrator
              const ddt = data.ddt || data;
              console.log('[useDialogueEngine] DDT start from backend orchestrator', {
                ddtId: ddt?.id,
                ddtLabel: ddt?.label,
                taskId: data.taskId
              });
              // Forward to options.onDDTStart if provided
              if (options.onDDTStart && ddt) {
                options.onDDTStart({ ddt, taskId: data.taskId });
              }
            },
            onStateUpdate: (state) => {
              setExecutionState(state);
            },
            onComplete: () => {
              setIsRunning(false);
              setCurrentTask(null);
              options.onComplete?.();
            },
            onError: (error) => {
              setIsRunning(false);
              setCurrentTask(null);
              options.onError?.(error);
            },
            onWaitingForInput: (data) => {
              // Store waiting state for input handling
              console.log('[useDialogueEngine] onWaitingForInput called from backend orchestrator', {
                hasDDT: !!data.ddt,
                ddtId: data.ddt?.id,
                taskId: data.taskId,
                nodeId: data.nodeId
              });
              (engineRef.current as any).waitingForInput = data;

              // Update sessionId in engineRef to keep it fresh
              if (orchestratorControl && orchestratorControl.sessionId) {
                sessionIdRef.current = orchestratorControl.sessionId;
                if (engineRef.current) {
                  (engineRef.current as any).sessionId = orchestratorControl.sessionId;
                }
                console.log('[useDialogueEngine] ✅ Refreshed sessionId in onWaitingForInput', {
                  sessionId: orchestratorControl.sessionId
                });
              }

              // Forward to options.onWaitingForInput if provided
              if (options.onWaitingForInput) {
                console.log('[useDialogueEngine] Forwarding onWaitingForInput to options callback');
                options.onWaitingForInput(data);
              } else {
                console.warn('[useDialogueEngine] ⚠️ options.onWaitingForInput not provided!');
              }
            }
          }
        );

        // Store orchestrator control for stop/cleanup
        if (!engineRef.current) {
          engineRef.current = {} as any;
        }
        (engineRef.current as any).orchestratorControl = orchestratorControl;
        (engineRef.current as any).sessionId = orchestratorControl.sessionId;
        sessionIdRef.current = orchestratorControl.sessionId; // Store in ref for real-time access
        console.log('[useDialogueEngine] ✅ Backend orchestrator session ID stored', {
          sessionId: orchestratorControl.sessionId,
          hasOrchestratorControl: !!(engineRef.current as any).orchestratorControl,
          engineRefKeys: Object.keys(engineRef.current || {})
        });

        return; // Backend orchestrator handles execution
      } else {
        // Frontend DialogueEngine removed - backend orchestrator is now default
        // To use frontend, restore from git history
        console.error('❌ [ORCHESTRATOR] Frontend DialogueEngine has been removed. Backend orchestrator is now default.');
        console.error('   Set localStorage.setItem("orchestrator.useBackend", "false") is no longer supported.');
        setIsRunning(false);
        setCurrentTask(null);
        options.onError?.(new Error('Frontend DialogueEngine has been removed. Backend orchestrator is required.'));
      }
    } catch (error) {
      setIsRunning(false);
      setCurrentTask(null);
      options.onError?.(error as Error);
    }
  }, [isRunning, options]);

  // Stop execution
  const stop = useCallback(() => {
    // Check if using backend orchestrator
    const orchestratorControl = (engineRef.current as any)?.orchestratorControl;
    if (orchestratorControl && orchestratorControl.stop) {
      orchestratorControl.stop();
    } else if (engineRef.current && typeof engineRef.current.stop === 'function') {
      engineRef.current.stop();
    }
    setIsRunning(false);
    setCurrentTask(null);
  }, []);

  // Reset engine state
  const reset = useCallback(() => {
    // Check if using backend orchestrator
    const orchestratorControl = (engineRef.current as any)?.orchestratorControl;
    if (orchestratorControl && orchestratorControl.stop) {
      orchestratorControl.stop();
    } else if (engineRef.current && typeof engineRef.current.reset === 'function') {
      engineRef.current.reset();
    }
    setIsRunning(false);
    setCurrentTask(null);
    setExecutionState(null);
  }, []);

  // Update retrieval state (for DDT)
  const updateRetrievalState = useCallback((state: any) => {
    engineRef.current?.updateRetrievalState(state);
  }, []);

  // Complete waiting task (e.g., after DDT completion)
  const completeWaitingTask = useCallback((taskId: string, retrievalState?: any) => {
    if (!engineRef.current) {
      console.warn('[useDialogueEngine] No engine instance available');
      return;
    }
    engineRef.current.completeWaitingTask(taskId, retrievalState);
    setIsRunning(true); // Loop will resume automatically
  }, []);

  // Expose sessionId getter for backend orchestrator (uses ref for real-time access)
  const getSessionId = useCallback(() => {
    return sessionIdRef.current || (engineRef.current as any)?.sessionId || null;
  }, []);

  return {
    executionState,
    isRunning,
    currentTask,
    getCurrentTask,
    start,
    stop,
    reset,
    completeWaitingTask,
    updateRetrievalState,
    getSessionId, // Expose getter for sessionId
    sessionId: sessionIdRef.current || (engineRef.current as any)?.sessionId || null // Also expose directly for easier access
  };
}

