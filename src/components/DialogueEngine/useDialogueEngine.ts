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

      // ✅ OPZIONE B: Invia TUTTO il grafo al backend
      // Il frontend NON decide quali template servono - invia tutto ciò che ha
      // Il backend materializer è l'unico che ricostruisce il grafo e decide cosa serve davvero

      // ✅ A. Tutte le TaskInstances del progetto (SOLO istanze, templateId !== null)
      // Il backend potrebbe aver bisogno di qualsiasi TaskInstance per dereferenziare SubTasksIds
      const allProjectTaskInstances = taskRepository.getAllTasks().filter(task => {
        if (!task) return false;
        // ✅ CRITICAL: type is required - skip tasks without type
        if (task.type === undefined || task.type === null) {
          console.error(`[useDialogueEngine] Task ${task.id} has no type field - skipping from compilation. This task is invalid.`);
          return false;
        }
        // ✅ CRITICAL: Only include instances (templateId !== null), exclude templates (templateId === null)
        // Templates are included separately in allProjectTemplates
        if (task.templateId === null || task.templateId === undefined) {
          return false; // This is a template, not an instance
        }
        return true;
      });

      // ✅ B. Tutti i template del progetto (da DialogueTaskService, fonte unica normalizzata)
      // ✅ ARCHITECTURAL: DialogueTaskService è il punto di normalizzazione
      // ProjectManager carica i template da TaskRepository e li registra in DialogueTaskService
      // DialogueTaskService preserva i template completi (incluso dataContract)
      // Nessuna mappatura distruttiva necessaria - i template sono già normalizzati
      // ✅ FILTER: DialogueTaskService contiene sia template di progetto che di factory
      // Filtriamo per source !== 'Factory' per ottenere solo template di progetto
      // ✅ CRITICAL: Assicurati che DialogueTaskService sia inizializzato
      if (!DialogueTaskService.isCacheLoaded()) {
        console.warn('[useDialogueEngine] ⚠️ DialogueTaskService cache not loaded, loading now...');
        await DialogueTaskService.loadTemplates();
      }
      const allDialogueTaskServiceTemplates = DialogueTaskService.getAllTemplates();
      const allProjectTemplatesFiltered = allDialogueTaskServiceTemplates.filter(template => {
        if (!template) return false;
        // ✅ CRITICAL: type is required
        if (template.type === undefined || template.type === null) {
          return false;
        }
        // ✅ FILTER: Solo template di progetto (source !== 'Factory')
        // Template di factory hanno source === 'Factory', template di progetto hanno source === 'Project' o undefined
        const source = (template as any).source;
        return source !== 'Factory';
      });

      // ✅ FALLBACK: Se un template non ha dataContract in DialogueTaskService, provare a prenderlo da TaskRepository
      // Questo può succedere se il template è stato registrato prima che dataContract fosse disponibile
      const allProjectTemplatesWithFallback = allProjectTemplatesFiltered.map(template => {
        // ✅ Se il template è UtteranceInterpretation (type === 3) e non ha dataContract, provare fallback
        if (template.type === TaskType.UtteranceInterpretation && !(template as any).dataContract) {
          const templateFromRepository = taskRepository.getTask(template.id);
          if (templateFromRepository && (templateFromRepository as any).dataContract) {
            console.warn(`[useDialogueEngine] ⚠️ Template ${template.id} missing dataContract in DialogueTaskService, using fallback from TaskRepository`);
            return {
              ...template,
              dataContract: (templateFromRepository as any).dataContract || (templateFromRepository as any).semanticContract
            };
          }
        }
        return template;
      });

      // ✅ Usa allProjectTemplatesWithFallback come fonte finale
      const allProjectTemplates = allProjectTemplatesWithFallback;

      // ✅ DEBUG: Verifica che il template problematico sia presente con dataContract
      const problematicTemplateId = '1fa9cc7c-755d-40c9-9041-3bdfe4fe29b3';
      const problematicTemplate = allProjectTemplates.find(t => t.id === problematicTemplateId);
      if (problematicTemplate) {
        console.log('[useDialogueEngine] 🔍 DEBUG: Template problematico trovato in allProjectTemplates', {
          id: problematicTemplate.id,
          type: problematicTemplate.type,
          hasDataContract: !!(problematicTemplate as any).dataContract,
          hasSemanticContract: !!(problematicTemplate as any).semanticContract,
          source: (problematicTemplate as any).source,
          dataContractKeys: (problematicTemplate as any).dataContract ? Object.keys((problematicTemplate as any).dataContract) : [],
          allKeys: Object.keys(problematicTemplate)
        });
      } else {
        console.warn('[useDialogueEngine] ⚠️ DEBUG: Template problematico NON trovato in allProjectTemplates', {
          searchedId: problematicTemplateId,
          totalTemplates: allProjectTemplates.length,
          templateIds: allProjectTemplates.map(t => t.id).slice(0, 10)
        });
        // ✅ Verifica se è in DialogueTaskService ma escluso dal filtro
        const inDialogueTaskService = allDialogueTaskServiceTemplates.find(t => t.id === problematicTemplateId);
        if (inDialogueTaskService) {
          console.warn('[useDialogueEngine] ⚠️ DEBUG: Template trovato in DialogueTaskService ma escluso dal filtro', {
            id: inDialogueTaskService.id,
            source: (inDialogueTaskService as any).source,
            hasDataContract: !!(inDialogueTaskService as any).dataContract
          });
        }
      }

      // ✅ C. Tutti i template di factory
      // Molti template del progetto derivano da template di factory
      // I sub-template potrebbero essere definiti lì
      const allFactoryTemplatesRaw = await taskTemplateService.getAllTemplates();

      // ✅ Convert factory templates (TaskCatalog) to DialogueTask format
      // Factory templates have nlpContract (not dataContract or semanticContract)
      const allFactoryTemplates = allFactoryTemplatesRaw.map(factoryTemplate => {
        const factoryTemplateAny = factoryTemplate as any;
        // ✅ Map factory template to DialogueTask format expected by backend
        return {
          id: factoryTemplate.id,
          label: factoryTemplate.label,
          type: factoryTemplate.type,
          name: factoryTemplateAny.name,
          // ✅ Map nlpContract → dataContract (factory templates use nlpContract)
          dataContract: factoryTemplateAny.nlpContract || factoryTemplateAny.dataContract || factoryTemplateAny.semanticContract || null,
          semanticContract: factoryTemplateAny.semanticContract,
          // ✅ Include all other fields from factory template
          ...factoryTemplateAny
        };
      });

      // ✅ COMBINA: Unisci tutte le fonti
      // ✅ ARCHITECTURAL: No deduplication needed - sources are disjoint:
      // - TaskInstances: templateId !== null (from TaskRepository)
      // - Project Templates: templateId === null (from TaskRepository)
      // - Factory Templates: from TaskTemplateService (different IDs)
      const allTasksWithTemplates = [
        ...allProjectTaskInstances,
        ...allProjectTemplates,
        ...allFactoryTemplates
      ];

      // ✅ DEBUG: Verifica che il template problematico sia presente in allTasksWithTemplates con dataContract
      // ✅ Usa problematicTemplateId già dichiarato sopra
      const problematicTemplateInAllTasks = allTasksWithTemplates.find(t => t.id === problematicTemplateId);
      if (problematicTemplateInAllTasks) {
        console.log('[useDialogueEngine] 🔍 DEBUG: Template problematico trovato in allTasksWithTemplates', {
          id: problematicTemplateInAllTasks.id,
          type: problematicTemplateInAllTasks.type,
          hasDataContract: !!(problematicTemplateInAllTasks as any).dataContract,
          hasSemanticContract: !!(problematicTemplateInAllTasks as any).semanticContract,
          source: (problematicTemplateInAllTasks as any).source,
          templateId: (problematicTemplateInAllTasks as any).templateId,
          dataContractType: typeof (problematicTemplateInAllTasks as any).dataContract,
          dataContractKeys: (problematicTemplateInAllTasks as any).dataContract ? Object.keys((problematicTemplateInAllTasks as any).dataContract) : [],
          allKeys: Object.keys(problematicTemplateInAllTasks).slice(0, 20)
        });
      } else {
        console.error('[useDialogueEngine] ❌ DEBUG: Template problematico NON trovato in allTasksWithTemplates!', {
          searchedId: problematicTemplateId,
          totalTasks: allTasksWithTemplates.length,
          projectTemplatesCount: allProjectTemplates.length,
          templateIds: allProjectTemplates.map(t => t.id).slice(0, 10)
        });
      }

      console.log('[useDialogueEngine] 📦 Complete graph payload for backend materialization:', {
        projectTaskInstancesCount: allProjectTaskInstances.length,
        projectTemplatesCount: allProjectTemplates.length,
        factoryTemplatesCount: allFactoryTemplates.length,
        totalTasksCount: allTasksWithTemplates.length,
        sampleTaskIds: allTasksWithTemplates.slice(0, 5).map(t => t.id)
      });

      // ✅ Extract DDTs only from referenced GetData tasks (keep existing logic for DDTs)
      // DDTs are still extracted only from referenced tasks, as they are flow-specific
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
        projectTaskInstancesCount: allProjectTaskInstances.length,
        projectTemplatesCount: allProjectTemplates.length,
        factoryTemplatesCount: allFactoryTemplates.length,
        ddtsCount: allDDTs.length
      });

      // ⭐ SEMPRE RUBY (porta 3101) - Unica fonte di verità per interpretare dialoghi
      // ❌ POSTEGGIATO: Node.js (3100) e VB.NET diretto (5000) - non usati per ora
      const baseUrl = 'http://localhost:3101';

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

      // ✅ DEBUG: Log tasks before serialization to verify type field
      const requestBody = {
        nodes: nodesWithTaskId,  // ✅ Use nodes with taskId field (backend VB.NET requires it)
        edges: options.edges,
        tasks: allTasksWithTemplates,  // ✅ Include both instance tasks and referenced templates
        ddts: allDDTs,
        projectId: localStorage.getItem('currentProjectId') || undefined,
        translations: translations // ✅ Pass translations table (already in memory) - runtime will do lookup at execution time
      };

      // ✅ DEBUG: Verifica che il template problematico sia presente nel requestBody con dataContract
      const problematicTemplateInRequestBody = requestBody.tasks.find((t: any) => t.id === problematicTemplateId && !t.templateId);
      if (problematicTemplateInRequestBody) {
        console.log('[useDialogueEngine] 🔍 DEBUG: Template problematico trovato nel requestBody (prima di JSON.stringify)', {
          id: problematicTemplateInRequestBody.id,
          type: problematicTemplateInRequestBody.type,
          templateId: problematicTemplateInRequestBody.templateId,
          hasDataContract: !!(problematicTemplateInRequestBody.dataContract),
          hasSemanticContract: !!(problematicTemplateInRequestBody.semanticContract),
          dataContractType: typeof problematicTemplateInRequestBody.dataContract,
          dataContractKeys: problematicTemplateInRequestBody.dataContract ? Object.keys(problematicTemplateInRequestBody.dataContract) : [],
          dataContractValue: problematicTemplateInRequestBody.dataContract ? JSON.stringify(problematicTemplateInRequestBody.dataContract).substring(0, 200) : null
        });
      } else {
        console.error('[useDialogueEngine] ❌ DEBUG: Template problematico NON trovato nel requestBody!', {
          searchedId: problematicTemplateId,
          totalTasksInRequestBody: requestBody.tasks.length,
          allTemplateIds: requestBody.tasks.filter((t: any) => !t.templateId).map((t: any) => t.id).slice(0, 10)
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

        // Log serialized JSON preview to verify type is in JSON
        const jsonPreview = JSON.stringify(requestBody).substring(0, 2000);
        console.log('[FRONTEND] Request body JSON preview (first 2000 chars):', jsonPreview);

        // ✅ DEBUG: Verifica se il template problematico è presente nel JSON serializzato
        const jsonString = JSON.stringify(requestBody);
        const templateInJson = jsonString.includes(`"id":"${problematicTemplateId}"`);
        if (templateInJson) {
          // ✅ DEBUG: Cerca il template nell'array tasks del requestBody (non nel JSON string)
          const templateInTasksArray = requestBody.tasks.find((t: any) => t.id === problematicTemplateId && !t.templateId);
          if (templateInTasksArray) {
            console.log('[useDialogueEngine] 🔍 DEBUG: Template problematico trovato nell\'array tasks del requestBody', {
              id: templateInTasksArray.id,
              type: templateInTasksArray.type,
              templateId: templateInTasksArray.templateId,
              hasDataContract: !!(templateInTasksArray.dataContract),
              hasSemanticContract: !!(templateInTasksArray.semanticContract),
              dataContractType: typeof templateInTasksArray.dataContract,
              dataContractKeys: templateInTasksArray.dataContract ? Object.keys(templateInTasksArray.dataContract) : [],
              dataContractValue: templateInTasksArray.dataContract ? JSON.stringify(templateInTasksArray.dataContract).substring(0, 200) : null,
              allKeys: Object.keys(templateInTasksArray).slice(0, 30)
            });

            // ✅ DEBUG: Verifica se il template ha type nel JSON serializzato
            const templateJson = JSON.stringify(templateInTasksArray);
            const hasTypeInTemplateJson = templateJson.includes(`"type":${templateInTasksArray.type}`);
            const hasDataContractInTemplateJson = templateJson.includes(`"dataContract"`);
            console.log('[useDialogueEngine] 🔍 DEBUG: Template problematico nel JSON serializzato (singolo template)', {
              hasType: hasTypeInTemplateJson,
              typeValue: templateInTasksArray.type,
              hasDataContract: hasDataContractInTemplateJson,
              jsonLength: templateJson.length,
              jsonPreview: templateJson.substring(0, 500)
            });
          } else {
            console.error('[useDialogueEngine] ❌ DEBUG: Template problematico NON trovato nell\'array tasks del requestBody come template (templateId === null)!', {
              searchedId: problematicTemplateId,
              allTasksWithTemplateIdNull: requestBody.tasks.filter((t: any) => !t.templateId).map((t: any) => ({ id: t.id, type: t.type })).slice(0, 10)
            });
          }

          // Estrai il template dal JSON per verificare se ha dataContract
          const templateMatch = jsonString.match(new RegExp(`"id":"${problematicTemplateId}"[^}]*"dataContract"[^}]*}`));
          console.log('[useDialogueEngine] 🔍 DEBUG: Template problematico trovato nel JSON serializzato', {
            found: true,
            hasDataContractInJson: jsonString.includes(`"id":"${problematicTemplateId}"`) && jsonString.includes(`"dataContract"`),
            templateMatch: templateMatch ? templateMatch[0].substring(0, 300) : null
          });
        } else {
          console.error('[useDialogueEngine] ❌ DEBUG: Template problematico NON trovato nel JSON serializzato!');
        }

        // Check if type is in JSON string
        const hasTypeInJson = jsonPreview.includes('"type"');
        console.log(`[FRONTEND] Does JSON contain "type" field? ${hasTypeInJson}`);
      }

      // Call backend API (NO FALLBACK - backend only)
      const compileResponse = await fetch(`${baseUrl}/api/runtime/compile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
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
        entryTaskGroupId: compileData.entryTaskGroupId || null
      };

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

