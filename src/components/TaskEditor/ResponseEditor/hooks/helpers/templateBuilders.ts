// templateBuilders.ts
// Pure functions per costruire strutture template (data, subData)
// Testabili in isolamento, senza side effects

import { DialogueTaskService } from '../../../../../services/DialogueTaskService';

export interface TemplateMatchResult {
  ai: {
    schema: {
      label: string;
      data: any[];
      stepPrompts?: any;
    };
    icon: string;
    translationGuids: string[];
  };
}

/**
 * Estrae i GUID delle traduzioni da data e subData
 * Cerca pattern UUID nei stepPrompts
 */
export function extractTranslationGuids(data: any[]): string[] {
  const guids: string[] = [];
  const guidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  const extractFromStepPrompts = (stepPrompts: any) => {
    if (!stepPrompts) return;
    Object.values(stepPrompts).forEach((guidsArray: any) => {
      if (Array.isArray(guidsArray)) {
        guidsArray.forEach((guid: string) => {
          if (typeof guid === 'string' && guidRegex.test(guid)) {
            guids.push(guid);
          }
        });
      }
    });
  };

  data.forEach((main) => {
    if (main.stepPrompts) {
      extractFromStepPrompts(main.stepPrompts);
    }
    if (main.subData) {
      main.subData.forEach((sub: any) => {
        if (sub.stepPrompts) {
          extractFromStepPrompts(sub.stepPrompts);
        }
      });
    }
  });

  return [...new Set(guids)];
}

/**
 * Crea un'istanza subData da un template
 * Filtra stepPrompts: solo start, noInput, noMatch per sottodati
 *
 * ✅ Design-time: referenceId viene dal template.data[0].id
 * Questo referenceId sarà scritto nell'istanza e usato a runtime
 */
export function createSubDataInstance(subTemplate: any): any {
  const filteredStepPrompts: any = {};
  if (subTemplate.stepPrompts) {
    if (subTemplate.stepPrompts.start) {
      filteredStepPrompts.start = subTemplate.stepPrompts.start;
    }
    if (subTemplate.stepPrompts.noInput) {
      filteredStepPrompts.noInput = subTemplate.stepPrompts.noInput;
    }
    if (subTemplate.stepPrompts.noMatch) {
      filteredStepPrompts.noMatch = subTemplate.stepPrompts.noMatch;
    }
  }

  // ✅ Get referenceId from the referenced template's data[0].id
  // This is the dataId that will be used in memory at runtime
  let referenceId: string | undefined;
  if (subTemplate.data && Array.isArray(subTemplate.data) && subTemplate.data.length > 0) {
    referenceId = subTemplate.data[0].id;
  } else {
    // Fallback: use template id if data structure not available
    referenceId = subTemplate.id || subTemplate._id;
  }

  return {
    label: subTemplate.label || subTemplate.name || 'Sub',
    type: subTemplate.type,
    icon: subTemplate.icon || 'FileText',
    stepPrompts: Object.keys(filteredStepPrompts).length > 0 ? filteredStepPrompts : undefined,
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
  return {
    label: template.label || template.name || 'Data',
    type: template.type,
    icon: template.icon || 'Calendar',
    stepPrompts: template.stepPrompts || undefined,
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

  const mainInstance = {
    label: template.label || template.name || 'Data',
    type: template.type,
    icon: template.icon || 'Calendar',
    stepPrompts: template.stepPrompts || undefined,
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
        data: data,
        stepPrompts: template.stepPrompts || undefined
      },
      icon: template.icon || 'Calendar',
      translationGuids: translationGuids
    }
  };
}


