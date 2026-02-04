import type { AssembledTaskTree, dataNode } from '../../../TaskTreeBuilder/DDTAssembler/currentDDT.types';
import type {
  DDTTemplateV2,
  DDTNode,
  StepMessages,
  StepAsk,
  StepConfirm,
  StepSuccess,
} from '../ddt.v2.types';
import { taskTemplateService } from '../../../../services/TaskTemplateService';
import { cloneAndAdaptContract, createSubIdMapping } from '../../../../utils/contractUtils';

// Helper to ensure arrays length 3
function pad3(arr?: string[]): string[] {
  const a = Array.isArray(arr) ? arr.slice(0, 3) : [];
  while (a.length < 3) a.push('');
  return a;
}

function getStepsArrayLocal(node: any): any[] {
  if (!node || !node.steps) return [];
  if (Array.isArray(node.steps)) return node.steps;
  const map = node.steps as Record<string, any>;
  return Object.keys(map).map((k) => {
    const v = map[k];
    if (Array.isArray(v?.escalations)) return { type: k, escalations: v.escalations };
    if (Array.isArray(v)) return { type: k, escalations: [{ actions: v }] };
    return { type: k, escalations: [] };
  });
}

function getGroup(node: dataNode, type: string) {
  const groups = getStepsArrayLocal(node);
  return groups.find((g: any) => g?.type === type);
}

function extractEscalationKeys(group: any): string[] {
  const list: string[] = [];
  if (!group || !Array.isArray(group.escalations)) return list;
  for (const esc of group.escalations) {
    const actions = Array.isArray(esc?.actions) ? esc.actions : [];
    const first = actions[0];
    const params = Array.isArray(first?.parameters) ? first.parameters : [];
    const textParam = params.find((p: any) => (p?.parameterId || p?.key) === 'text') || params[0];
    const key = (textParam && typeof textParam.value === 'string') ? textParam.value : '';
    list.push(key);
  }
  return list;
}

function extractSingleKey(group: any): string {
  const keys = extractEscalationKeys(group);
  return keys[0] || '';
}

async function mapNode(current: dataNode, asType: 'main' | 'sub', projectLanguage: string): Promise<DDTNode> {
  const startG = getGroup(current, 'start');
  const noInputG = getGroup(current, 'noInput');
  const noMatchG = getGroup(current, 'noMatch');
  const confirmG = getGroup(current, 'confirmation');
  const successG = getGroup(current, 'success');

  const ask: StepAsk = {
    base: extractSingleKey(startG) || 'ask.base',
    reaskNoInput: pad3(extractEscalationKeys(noInputG)),
    reaskNoMatch: pad3(extractEscalationKeys(noMatchG)),
  };

  const steps: StepMessages = {
    ask,
  };

  if (asType === 'main') {
    (steps as StepMessages).confirm = {
      base: extractSingleKey(confirmG) || 'confirm.base',
      paraphraseBefore: false,
      // For now reuse ask re-ask sequences if dedicated ones are not available
      noInput: pad3(extractEscalationKeys(noInputG)),
      noMatch: pad3(extractEscalationKeys(noMatchG)),
    } as StepConfirm;
    (steps as StepMessages).success = { base: pad3(extractEscalationKeys(successG)).filter(Boolean) } as StepSuccess;
  } else {
    (steps as StepMessages).success = { base: pad3(extractEscalationKeys(successG)).filter(Boolean) } as StepSuccess;
  }

  // Respect explicit kind/type from editor if present; fallback to heuristics
  const explicitKind = String(((current as any)?._kindManual || (current as any)?.kind) || '').toLowerCase();
  const typeStr = String(current.type || '').toLowerCase();
  const labelStr = String(current.label || current.name || '').toLowerCase();
  const subLabels = (current.subData || []).map((s) => String(s.label || '').toLowerCase());
  const looksLikeDate = typeStr === 'date' || subLabels.some(l => /\b(day|month|year)\b/.test(l)) || /birth|date/.test(labelStr);
  const looksLikeName = subLabels.some(l => /first|last/.test(l)) || /name/.test(labelStr);
  const looksLikePhone = typeStr === 'phone' || /phone|telephone|tel|cellulare|mobile/.test(labelStr);
  const looksLikeAddress = typeStr === 'address' || subLabels.some(l => /street|city|postal|zip|country|state|region/.test(l)) || /address/.test(labelStr);

  // Extra heuristics for SUB nodes: infer kind from label when parent type isn't available here
  if (asType === 'sub') {
    const lbl = labelStr;
    if (/\b(day|month|year)\b/.test(lbl)) {
      return {
        id: current.id,
        label: (current.label || current.name || current.id) as string,
        type: asType,
        required: (current as any)?.required !== false,
        kind: 'date' as any,
        steps,
        condition: current.condition,
        synonyms: (current as any).synonyms || undefined,
      } as DDTNode;
    }
    if (/street|city|postal|zip|country|state|region|house\s*number/i.test(lbl)) {
      return {
        id: current.id,
        label: (current.label || current.name || current.id) as string,
        type: asType,
        required: (current as any)?.required !== false,
        kind: 'address' as any,
        steps,
        condition: current.condition,
        synonyms: (current as any).synonyms || undefined,
      } as DDTNode;
    }
    if (/first\s*name|last\s*name|surname|cognome|nome/i.test(lbl)) {
      return {
        id: current.id,
        label: (current.label || current.name || current.id) as string,
        type: asType,
        required: (current as any)?.required !== false,
        kind: 'name' as any,
        steps,
        condition: current.condition,
        synonyms: (current as any).synonyms || undefined,
      } as DDTNode;
    }
    if (/email|e-?mail/i.test(lbl)) {
      return {
        id: current.id,
        label: (current.label || current.name || current.id) as string,
        type: asType,
        required: (current as any)?.required !== false,
        kind: 'email' as any,
        steps,
        condition: current.condition,
        synonyms: (current as any).synonyms || undefined,
      } as DDTNode;
    }
    if (/phone|telefono|cellulare|cell/i.test(lbl)) {
      return {
        id: current.id,
        label: (current.label || current.name || current.id) as string,
        type: asType,
        required: (current as any)?.required !== false,
        kind: 'phone' as any,
        steps,
        condition: current.condition,
        synonyms: (current as any).synonyms || undefined,
      } as DDTNode;
    }
  }
  // Guard: log and correct explicit kind if label clearly indicates phone
  const explicitOrCorrected = ((): string | undefined => {
    if (!explicitKind || explicitKind === 'generic' || explicitKind === 'auto') return undefined;
    if (explicitKind === 'address' && looksLikePhone && !looksLikeAddress) {
      try { console.log('[KindPersist][Adapter][correct explicit]', { label: current.label, from: explicitKind, to: 'phone' }); } catch { }
      return 'phone';
    }
    return explicitKind;
  })();

  const detectedKind = explicitOrCorrected ? explicitOrCorrected
    : looksLikeDate ? 'date'
      : looksLikeName ? 'name'
        : looksLikePhone ? 'phone'
          : looksLikeAddress ? 'address'
            : (typeStr as any) || 'generic';

  // Load source template and contract for cloning
  let sourceTemplate = null;
  let sourceContract = (current as any).nlpContract;

  console.log('🔍 [adaptCurrentToV2] Checking contract on current node', {
    nodeId: current.id,
    nodeLabel: current.label,
    detectedKind,
    hasContractOnNode: !!sourceContract,
    contractKeys: sourceContract ? Object.keys(sourceContract).slice(0, 5) : [],
    currentKeys: Object.keys(current).slice(0, 15)
  });

  // Check if contract is already an instance (has sourceTemplateId) - if so, keep it as is
  const isAlreadyInstance = sourceContract && sourceContract.sourceTemplateId;

  if (!sourceContract && (current as any).templateId) {
    // ✅ CERCO PER GUID dal nodo (NO kind/name!)
    const templateGuid = (current as any).templateId;
    const template = taskTemplateService.getTemplateSync(templateGuid);

    if (template) {
      sourceTemplate = template;
      if ((template as any).nlpContract) {
        sourceContract = (template as any).nlpContract;
        console.log('✅ [adaptCurrentToV2] Contract trovato per GUID (FALLBACK)', {
          templateGuid,
          templateId: template.id,
          templateName: (template as any).name || 'N/A',
          nodeId: current.id,
          nodeLabel: current.label,
          contractTemplateName: sourceContract.templateName
        });
      } else {
        console.warn('❌ [adaptCurrentToV2] Template trovato per GUID ma SENZA contract', {
          templateGuid,
          templateId: template.id,
          templateName: (template as any).name,
          nodeLabel: current.label
        });
      }
    } else {
      console.warn('❌ [adaptCurrentToV2] Template NON trovato per GUID', {
        templateGuid,
        nodeId: current.id,
        nodeLabel: current.label
      });
    }
  }

  // ✅ Clone and adapt contract if needed (not already an instance OR if instance has placeholder)
  let instanceContract = sourceContract;
  if (sourceContract) {
    // ✅ Verifica se è un'istanza ma ha ancora il placeholder (istanza vecchia)
    // Nel template il placeholder è \${MONTHS_PLACEHOLDER} (con escape)
    const placeholderPattern = '\\${MONTHS_PLACEHOLDER}';
    const isOldInstance = isAlreadyInstance && sourceContract.regex?.patterns?.some((p: string) => p.includes(placeholderPattern));

    if (!isAlreadyInstance || isOldInstance) {
      // Get source template ID
      const sourceTemplateId = isOldInstance
        ? (sourceContract.sourceTemplateId || sourceContract.templateId || '')
        : (sourceTemplate?.id || sourceContract.templateId || '');

      // Create mapping: sub-template IDs → sub-instance IDs
      // Extract sub-template IDs from original contract's subDataMapping
      const subTemplateIds = Object.keys(sourceContract.subDataMapping || {});
      // Get sub-instance IDs from current.subData (if main node)
      const subInstanceIds = asType === 'main' && current.subData
        ? current.subData.map((s: any) => s.id)
        : [];

      // Create mapping
      const subIdMapping = createSubIdMapping(subTemplateIds, subInstanceIds);

      // Clone and adapt contract (async - compiles regex if needed)
      // ✅ projectLanguage è OBBLIGATORIO - nessun fallback
      if (!projectLanguage) {
        throw new Error(`[adaptCurrentToV2] projectLanguage is REQUIRED for contract cloning. Node: ${current.id}, label: ${current.label}`);
      }
      const language = projectLanguage.toUpperCase();
      instanceContract = await cloneAndAdaptContract(
        sourceContract,
        current.id,  // Instance GUID (use existing node ID)
        sourceTemplateId,  // Source template GUID
        subIdMapping,
        language
      );

      console.log('✅ [adaptCurrentToV2] Contract clonato e adattato per istanza', {
        instanceId: current.id,
        instanceLabel: current.label,
        sourceTemplateId: sourceTemplateId,
        templateName: instanceContract.templateName,
        contractTemplateId: instanceContract.templateId,
        contractSourceTemplateId: instanceContract.sourceTemplateId,
        subMappings: Object.keys(instanceContract.subDataMapping).length,
        wasAlreadyInstance: isAlreadyInstance,
        wasOldInstance: isOldInstance,
        regexCompiled: !instanceContract.regex?.patterns?.some((p: string) => p.includes('\\${MONTHS_PLACEHOLDER}'))
      });
    } else {
      // ✅ Istanza già compilata correttamente
      console.log('✅ [adaptCurrentToV2] Contract già istanza compilata, mantenuto', {
        instanceId: current.id,
        sourceTemplateId: sourceContract.sourceTemplateId,
        contractTemplateId: sourceContract.templateId,
        regexCompiled: !sourceContract.regex?.patterns?.some((p: string) => p.includes('\\${MONTHS_PLACEHOLDER}'))
      });
    }
  } else if (!sourceContract) {
    console.warn('❌ [adaptCurrentToV2] Nessun contract disponibile (PROBLEMA!)', {
      instanceId: current.id,
      instanceLabel: current.label,
      detectedKind
    });
  }

  return {
    id: current.id,
    label: (current.label || current.name || current.id) as string,
    type: asType,
    // Default required=true unless explicitly marked false in the source
    required: (current as any)?.required !== false,
    kind: detectedKind as any,
    steps,
    subs: asType === 'main' ? (current.subData || []).map((s) => s.id) : undefined,
    condition: current.condition,
    synonyms: (current as any).synonyms || undefined,
    // Use cloned contract if available
    nlpContract: instanceContract || undefined,
  } as DDTNode;
}

export async function adaptCurrentToV2(current: AssembledTaskTree, projectLanguage: string): Promise<DDTTemplateV2> {
  // ✅ projectLanguage è OBBLIGATORIO - nessun fallback
  if (!projectLanguage) {
    throw new Error('[adaptCurrentToV2] projectLanguage is REQUIRED. Cannot adapt DDT without project language.');
  }
  const language = projectLanguage.toUpperCase();

  const mains: any[] = Array.isArray((current as any).data)
    ? ((current as any).data as any[])
    : [(current as any).data];
  const nodes: DDTNode[] = [];
  for (const m of mains) {
    if (!m) continue;
    const mainNode = await mapNode(m, 'main', language);
    nodes.push(mainNode);
    for (const s of (m.subData || [])) {
      nodes.push(await mapNode(s, 'sub', language));
    }
  }

  // Convert introduction StepGroup to StepMessages format for V2
  let introductionV2: any = undefined;
  if (current.introduction) {
    // Extract text keys from introduction tasks
    const tasks = current.introduction.escalations?.[0]?.tasks || [];
    const textKeys = tasks
      .map((t: any) => t?.parameters?.find((p: any) => p?.parameterId === 'text')?.value)
      .filter(Boolean);
    if (textKeys.length > 0) {
      // Create a simple StepMessages structure for introduction
      // Use 'ask' structure but it's actually just messages to display
      introductionV2 = {
        ask: {
          base: textKeys[0] || '',
          reaskNoInput: [],
          reaskNoMatch: []
        },
        // Store all action keys for reference
        _introductionActions: textKeys
      };
    }
  }

  return {
    schemaVersion: '2',
    metadata: {
      id: current.id,
      label: current.label,
      ...(introductionV2 ? { introduction: introductionV2 } : {})
    },
    nodes,
  };
}



