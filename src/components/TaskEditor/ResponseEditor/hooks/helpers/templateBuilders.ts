// templateBuilders.ts
// Pure functions per costruire strutture template (mainData, subData)
// Testabili in isolamento, senza side effects

import { DialogueTaskService } from '../../../../../services/DialogueTaskService';

export interface TemplateMatchResult {
  ai: {
    schema: {
      label: string;
      mainData: any[];
      stepPrompts?: any;
    };
    icon: string;
    translationGuids: string[];
  };
}

/**
 * Estrae i GUID delle traduzioni da mainData e subData
 * Cerca pattern UUID nei stepPrompts
 */
export function extractTranslationGuids(mainData: any[]): string[] {
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

  mainData.forEach((main) => {
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
 * ✅ Design-time: referenceId viene dal template.mainData[0].id
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

  // ✅ Get referenceId from the referenced template's mainData[0].id
  // This is the dataId that will be used in memory at runtime
  let referenceId: string | undefined;
  if (subTemplate.mainData && Array.isArray(subTemplate.mainData) && subTemplate.mainData.length > 0) {
    referenceId = subTemplate.mainData[0].id;
  } else {
    // Fallback: use template id if mainData structure not available
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
    referenceId: referenceId, // ✅ dataId del mainData[0] del template referenziato
    kind: subTemplate.name || subTemplate.type || 'generic'
  };
}

/**
 * Crea un'istanza mainData da un template semplice (senza subDataIds)
 */
export function createSimpleMainDataInstance(template: any): any {
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
 * Crea mainData da un template composito (con subDataIds)
 */
export function createCompositeMainData(template: any): any[] {
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
  const mainData = subDataIds.length > 0
    ? createCompositeMainData(template)
    : [createSimpleMainDataInstance(template)];

  const translationGuids = extractTranslationGuids(mainData);

  return {
    ai: {
      schema: {
        label: template.label || template.name || 'Data',
        mainData: mainData,
        stepPrompts: template.stepPrompts || undefined
      },
      icon: template.icon || 'Calendar',
      translationGuids: translationGuids
    }
  };
}


