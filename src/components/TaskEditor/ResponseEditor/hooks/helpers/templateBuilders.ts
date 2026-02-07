// templateBuilders.ts
// Pure functions per costruire strutture template (data, subData)
// Testabili in isolamento, senza side effects

import { DialogueTaskService } from '@services/DialogueTaskService';

export interface TemplateMatchResult {
  ai: {
    schema: {
      label: string;
      data: any[];
      // ❌ RIMOSSO: steps - usa steps nei nodi invece
    };
    icon: string;
    translationGuids: string[];
  };
}

/**
 * Estrae i GUID delle traduzioni da data e subData
 * Cerca pattern UUID negli steps
 */
export function extractTranslationGuids(data: any[]): string[] {
  const guids: string[] = [];
  const guidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  const extractFromSteps = (steps: any, nodeId: string) => {
    if (!steps || !nodeId) return;
    const nodeSteps = steps[nodeId];
    if (!nodeSteps || typeof nodeSteps !== 'object') return;

    Object.values(nodeSteps).forEach((step: any) => {
      if (step && step.escalations && Array.isArray(step.escalations)) {
        step.escalations.forEach((escalation: any) => {
          if (escalation.tasks && Array.isArray(escalation.tasks)) {
            escalation.tasks.forEach((task: any) => {
              if (task.id && typeof task.id === 'string' && guidRegex.test(task.id)) {
                guids.push(task.id);
              }
            });
          }
        });
      }
    });
  };

  data.forEach((main) => {
    const mainNodeId = main.templateId || main.id;
    if (main.steps && mainNodeId) {
      extractFromSteps(main.steps, String(mainNodeId));
    }
    if (main.subData) {
      main.subData.forEach((sub: any) => {
        const subNodeId = sub.templateId || sub.id;
        if (sub.steps && subNodeId) {
          extractFromSteps(sub.steps, String(subNodeId));
        }
      });
    }
  });

  return [...new Set(guids)];
}

/**
 * Crea un'istanza subData da un template
 * Filtra steps: solo start, noInput, noMatch per sottodati
 *
 * ✅ Design-time: referenceId viene dal template.data[0].id
 * Questo referenceId sarà scritto nell'istanza e usato a runtime
 */
export function createSubDataInstance(subTemplate: any): any {
  const subTemplateId = subTemplate.id || subTemplate._id;
  let filteredSteps = undefined;

  if (subTemplate.steps && subTemplateId) {
    const nodeSteps = subTemplate.steps[String(subTemplateId)];
    if (nodeSteps && typeof nodeSteps === 'object') {
      const filtered = {};
      const allowedStepTypes = ['start', 'noInput', 'noMatch'];
      for (const stepType of allowedStepTypes) {
        if (nodeSteps[stepType]) {
          filtered[stepType] = nodeSteps[stepType];
        }
      }
      if (Object.keys(filtered).length > 0) {
        filteredSteps = { [String(subTemplateId)]: filtered };
      }
    }
  }

  // ✅ NUOVO MODELLO: referenceId è sempre il templateId del subTemplate
  // Non serve più cercare in .data[0].id - il templateId è sufficiente
  const referenceId = subTemplate.id || subTemplate._id;

  return {
    label: subTemplate.label || subTemplate.name || 'Sub',
    type: subTemplate.type,
    icon: subTemplate.icon || 'FileText',
    steps: filteredSteps, // ✅ Usa steps invece di steps
    constraints: subTemplate.dataContracts || subTemplate.constraints || [],
    examples: subTemplate.examples || [],
    subData: [],
    nlpContract: subTemplate.nlpContract || undefined,
    templateId: subTemplate.id || subTemplate._id, // ✅ GUID del task referenziato
    referenceId: referenceId, // ✅ dataId del data[0] del template referenziato
    kind: subTemplate.name || subTemplate.type || 'generic'
  };
}

/**
 * Crea un'istanza data da un template semplice (senza subDataIds)
 */
export function createSimpledataInstance(template: any): any {
  const templateId = template.id || template._id;
  return {
    label: template.label || template.name || 'Data',
    type: template.type,
    icon: template.icon || 'Calendar',
    steps: templateId && template.steps ? { [String(templateId)]: template.steps[String(templateId)] } : undefined, // ✅ Usa steps invece di steps
    constraints: template.dataContracts || template.constraints || [],
    examples: template.examples || [],
    subData: [],
    nlpContract: template.nlpContract || undefined,
    templateId: template.id || template._id,
    kind: template.name || template.type || 'generic'
  };
}

/**
 * Crea data da un template composito (con subDataIds)
 */
export function createCompositedata(template: any): any[] {
  const subDataIds = template.subDataIds || [];
  const subDataInstances: any[] = [];

  for (const subId of subDataIds) {
    const subTemplate = DialogueTaskService.getTemplate(subId);
    if (subTemplate) {
      subDataInstances.push(createSubDataInstance(subTemplate));
    }
  }

  const mainTemplateId = template.id || template._id;
  const mainInstance = {
    label: template.label || template.name || 'Data',
    type: template.type,
    icon: template.icon || 'Calendar',
    steps: mainTemplateId && template.steps ? { [String(mainTemplateId)]: template.steps[String(mainTemplateId)] } : undefined, // ✅ Usa steps invece di steps
    constraints: template.dataContracts || template.constraints || [],
    examples: template.examples || [],
    subData: subDataInstances,
    nlpContract: template.nlpContract || undefined,
    templateId: template.id || template._id,
    kind: template.name || template.type || 'generic'
  };

  return [mainInstance];
}

/**
 * Costruisce un TemplateMatchResult da un template trovato
 * Gestisce sia template semplici che compositi
 */
export async function buildTemplateMatchResult(template: any): Promise<TemplateMatchResult> {
  const subDataIds = template.subDataIds || [];
  const data = subDataIds.length > 0
    ? createCompositedata(template)
    : [createSimpledataInstance(template)];

  const translationGuids = extractTranslationGuids(data);

  return {
    ai: {
      schema: {
        label: template.label || template.name || 'Data',
        data: data
        // ❌ RIMOSSO: steps - usa steps nei nodi invece
      },
      icon: template.icon || 'Calendar',
      translationGuids: translationGuids
    }
  };
}


