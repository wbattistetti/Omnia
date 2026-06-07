/**
 * Compila un singolo task AI Agent per esecuzione atomica (TaskExecutor, no flow).
 */

import { TaskType, type Task } from '@types/taskTypes';
import { buildTaskTreeFromRepository } from '@utils/taskUtils';
import DialogueTaskService from '@services/DialogueTaskService';
import { buildMinimalAiAgentCompileTask } from '@components/TaskEditor/EditorHost/editors/aiAgentEditor/composeRuntimeRulesFromCompact';

const VB_BASE_URL = 'http://localhost:5000';

export type CompiledAiAgentPayload = {
  compiledTask: Record<string, unknown>;
  taskId: string;
  locale: string;
};

async function loadProjectLocale(projectId: string): Promise<string> {
  const projectResponse = await fetch(`/api/projects/${projectId}`);
  if (!projectResponse.ok) {
    const errorText = await projectResponse.text();
    throw new Error(`Impossibile caricare il progetto: ${projectResponse.statusText} — ${errorText}`);
  }
  const project = await projectResponse.json();
  if (!project.language) {
    throw new Error('Lingua progetto mancante.');
  }
  const langMap: Record<string, string> = {
    it: 'it-IT',
    en: 'en-US',
    pt: 'pt-BR',
    es: 'es-ES',
    fr: 'fr-FR',
  };
  return langMap[project.language] || `${project.language}-${String(project.language).toUpperCase()}`;
}

/** Compila il task AI Agent via POST /api/runtime/compile/task. */
export async function compileSingleAiAgentTask(
  task: Task,
  projectId: string
): Promise<CompiledAiAgentPayload> {
  const taskId = String(task?.id ?? '').trim();
  if (!taskId) {
    throw new Error('TaskId mancante.');
  }
  if (task.type !== TaskType.AIAgent) {
    throw new Error('compileSingleAiAgentTask supporta solo task AI Agent.');
  }

  const materialized = await buildTaskTreeFromRepository(taskId, projectId);
  if (!materialized) {
    throw new Error(`Impossibile materializzare il task ${taskId}.`);
  }
  const { instance: taskInstance } = materialized;

  const taskForCompilation: Record<string, unknown> = {
    id: taskInstance.id,
    templateId: taskInstance.templateId || taskInstance.id,
    type: taskInstance.type,
    label: taskInstance.label || '',
    value: taskInstance.value || {},
    parameters: taskInstance.parameters || [],
    subTasksIds: taskInstance.subTasksIds || [],
    constraints: taskInstance.constraints || [],
    dataContract: taskInstance.dataContract ?? null,
    steps: taskInstance.steps || {},
  };

  Object.assign(
    taskForCompilation,
    buildMinimalAiAgentCompileTask({
      id: taskInstance.id,
      type: taskInstance.type,
      templateId: taskInstance.templateId ?? null,
      llmEndpoint: typeof taskInstance.llmEndpoint === 'string' ? taskInstance.llmEndpoint : undefined,
      agentStructuredSectionsJson: taskInstance.agentStructuredSectionsJson,
      agentPrompt: taskInstance.agentPrompt,
      agentPromptTargetPlatform: taskInstance.agentPromptTargetPlatform,
      agentIaRuntimeOverrideJson: taskInstance.agentIaRuntimeOverrideJson,
      agentElevenLabsConvaiLinkJson: taskInstance.agentElevenLabsConvaiLinkJson,
      agentConvaiDeployMode: taskInstance.agentConvaiDeployMode,
      agentImmediateStart: taskInstance.agentImmediateStart,
      agentUseCasesJson: taskInstance.agentUseCasesJson,
      agentStartPromptJson: taskInstance.agentStartPromptJson,
      agentStartUseCaseId: taskInstance.agentStartUseCaseId,
    })
  );

  const referencedTemplateIds = new Set<string>();
  if (taskForCompilation.templateId) {
    referencedTemplateIds.add(String(taskForCompilation.templateId));
  }
  for (const id of taskInstance.subTasksIds ?? []) {
    if (id) referencedTemplateIds.add(id);
  }

  const referencedTemplates: Record<string, unknown>[] = [];
  for (const templateId of referencedTemplateIds) {
    if (templateId === taskInstance.id) continue;
    const tpl = DialogueTaskService.getTemplate(templateId);
    if (tpl) referencedTemplates.push({ ...tpl });
  }

  const compileResponse = await fetch(`${VB_BASE_URL}/api/runtime/compile/task`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      taskInstance: taskForCompilation,
      allTemplates: [taskForCompilation, ...referencedTemplates],
    }),
  });

  const responseText = await compileResponse.text();
  if (!compileResponse.ok) {
    let errMsg = responseText;
    try {
      const parsed = JSON.parse(responseText) as { error?: string; message?: string };
      errMsg = parsed.error || parsed.message || responseText;
    } catch {
      /* raw text */
    }
    throw new Error(`Compilazione task fallita: ${errMsg}`);
  }

  const compileResult = JSON.parse(responseText) as {
    compiledTask?: Record<string, unknown>;
    error?: string;
  };
  if (compileResult.error || !compileResult.compiledTask) {
    throw new Error(compileResult.error || 'compiledTask mancante nella risposta.');
  }
  if (String(compileResult.compiledTask.id) !== taskId) {
    throw new Error(`ID compilato mismatch: atteso ${taskId}, ricevuto ${String(compileResult.compiledTask.id)}`);
  }

  const locale = await loadProjectLocale(projectId);
  return { compiledTask: compileResult.compiledTask, taskId, locale };
}
