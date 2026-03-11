// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * Template Cloning Service
 *
 * Shared service for cloning templates to task instances.
 * Used by both FULL and ADAPTATION wizard modes.
 *
 * This eliminates code duplication between:
 * - executeSequentialPhases (full mode)
 * - confirmStructureForAdaptation (adaptation mode)
 */

import type { WizardTaskTreeNode } from '../types';

export interface CloneTemplateOptions {
  templateId: string;
  rowId: string;
  projectId: string;
  taskLabel: string;
  locale: string;
  dataSchema?: WizardTaskTreeNode[]; // Optional: if not provided, loads from template
}

export interface CloneTemplateResult {
  taskInstance: any; // TaskInstance type
  guidMapping: Map<string, string>;
  templates: Map<string, any>; // Return templates for reuse
}

/**
 * Clones a template (and sub-templates) to a task instance.
 *
 * Steps:
 * 1. Load template + sub-templates
 * 2. Build nodes from templates (for cloneTemplateSteps)
 * 3. Clone steps
 * 4. Clone and contextualize translations
 * 5. Create and save taskInstance to repository
 *
 * @param options - Cloning options
 * @returns Task instance, GUID mapping, and templates map
 */
export async function cloneTemplateToInstance(
  options: CloneTemplateOptions
): Promise<CloneTemplateResult> {
  const { templateId, rowId, projectId, taskLabel, locale, dataSchema } = options;

  // ✅ Validation
  if (!templateId || !rowId || !projectId) {
    throw new Error('[TemplateCloningService] templateId, rowId, and projectId are required');
  }

  console.log('[TemplateCloningService] 🚀 Starting template cloning', {
    templateId,
    rowId,
    projectId,
    taskLabel,
    hasDataSchema: !!dataSchema
  });

  // ✅ STEP 1: Load template
  const { DialogueTaskService } = await import('@services/DialogueTaskService');
  const template = DialogueTaskService.getTemplate(templateId);

  if (!template) {
    throw new Error(`[TemplateCloningService] Template not found: ${templateId}`);
  }

  // ✅ STEP 2: Build templates map (for cloneTemplateSteps)
  const templates = new Map<string, any>();
  templates.set(template.id, template);

  // Load sub-templates if needed
  if (template.subTasksIds && template.subTasksIds.length > 0) {
    for (const subTaskId of template.subTasksIds) {
      const subTemplate = DialogueTaskService.getTemplate(subTaskId);
      if (subTemplate) {
        templates.set(subTemplate.id, subTemplate);
      }
    }
  }

  console.log('[TemplateCloningService] ✅ Templates loaded', {
    rootTemplateId: template.id,
    subTemplatesCount: templates.size - 1,
    totalTemplates: templates.size
  });

  // ✅ STEP 3: Get dataSchema (from options or load from template)
  let effectiveDataSchema = dataSchema;
  if (!effectiveDataSchema) {
    // Load dataSchema from template structure
    const { buildDataSchemaFromTemplate } = await import('../utils/templateToDataSchema');
    effectiveDataSchema = await buildDataSchemaFromTemplate(template, projectId);
  }

  if (!effectiveDataSchema || effectiveDataSchema.length === 0) {
    throw new Error('[TemplateCloningService] dataSchema is required (either provided or loadable from template)');
  }

  const rootNode = effectiveDataSchema[0];
  const rootTemplate = templates.get(rootNode.id);

  if (!rootTemplate) {
    throw new Error(`[TemplateCloningService] Root template not found for node: ${rootNode.id}`);
  }

  // ✅ STEP 4: Build nodes from templates (per cloneTemplateSteps)
  const { buildNodesFromTemplates } = await import('./TemplateCreationService');
  const nodes = buildNodesFromTemplates(rootTemplate, templates);

  // ✅ STEP 5: Clone steps
  const { cloneTemplateSteps } = await import('@utils/taskUtils');
  const { steps: clonedSteps, guidMapping } = cloneTemplateSteps(rootTemplate, nodes);

  console.log('[TemplateCloningService] ✅ Steps cloned', {
    guidMappingSize: guidMapping.size,
    clonedStepsCount: clonedSteps.length
  });

  // ✅ STEP 6: Clone and contextualize translations
  try {
    const { cloneAndContextualizeTranslations } = await import('@utils/cloneAndContextualizeTranslations');
    await cloneAndContextualizeTranslations(
      clonedSteps,
      guidMapping,
      rootTemplate.id,
      taskLabel,
      locale
    );
    console.log('[TemplateCloningService] ✅ Translations cloned and contextualized', {
      guidMappingSize: guidMapping.size
    });
  } catch (contextError) {
    console.error('[TemplateCloningService] ❌ Error in translation contextualization (non-blocking):', contextError);
    // Continue even if contextualization fails - translations are already cloned
  }

  // ✅ STEP 7: Create taskInstance with cloned steps
  const taskInstance: any = {
    id: rowId,
    type: rootTemplate.type || 3,
    templateId: rootTemplate.id,
    label: taskLabel,
    steps: clonedSteps,
  };

  // ✅ STEP 8: Save taskInstance to repository
  const { taskRepository } = await import('@services/TaskRepository');
  taskRepository.createTask(
    taskInstance.type || 3,
    taskInstance.templateId,
    taskInstance,
    taskInstance.id,
    projectId
  );

  console.log('[TemplateCloningService] ✅ Task instance saved to repository', {
    taskInstanceId: taskInstance.id,
    templateId: taskInstance.templateId
  });

  // ✅ STEP 9: Create variables in memory (no DB call — persisted on project save)
  // This is the single, authoritative creation point for variables (both FULL and ADAPTATION modes).
  try {
    const { variableCreationService } = await import('@services/VariableCreationService');
    variableCreationService.createVariablesForInstance({
      taskInstance,
      template,
      taskLabel,
      projectId,
      dataSchema: effectiveDataSchema, // Pass the full tree structure from wizard
    });
    console.log('[TemplateCloningService] ✅ Variables created in memory', {
      taskInstanceId: taskInstance.id,
      templateId: template.id,
    });
  } catch (varError) {
    // Non-blocking: variables can be re-created later
    console.warn('[TemplateCloningService] ⚠️ Error creating variables (non-blocking)', varError);
  }

  return {
    taskInstance,
    guidMapping,
    templates
  };
}
