import type { AssembledDDT, MainDataNode } from '../../../DialogueDataTemplateBuilder/DDTAssembler/currentDDT.types';
import type {
  DDTTemplateV2,
  DDTNode,
  StepMessages,
  StepAsk,
  StepConfirm,
  StepNotConfirmed,
  StepViolation,
  StepDisambiguation,
  StepSuccess,
} from '../ddt.v2.types';

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

function getGroup(node: MainDataNode, type: string) {
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

function mapNode(current: MainDataNode, asType: 'main' | 'sub'): DDTNode {
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
      try { console.log('[KindPersist][Adapter][correct explicit]', { label: current.label, from: explicitKind, to: 'phone' }); } catch {}
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

  try {
    // eslint-disable-next-line no-console
    console.log('[adaptCurrentToV2][mapNode]', {
      asType,
      label: current.label,
      explicitKind,
      detectedKind,
      typeStr,
      subLabels,
      required: (current as any)?.required,
    });
  } catch {}

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
  } as DDTNode;
}

export function adaptCurrentToV2(current: AssembledDDT): DDTTemplateV2 {
  const mains: any[] = Array.isArray((current as any).mainData)
    ? ((current as any).mainData as any[])
    : [ (current as any).mainData ];
  const nodes: DDTNode[] = [];
  for (const m of mains) {
    if (!m) continue;
    const mainNode = mapNode(m, 'main');
    nodes.push(mainNode);
    for (const s of (m.subData || [])) {
      nodes.push(mapNode(s, 'sub'));
    }
  }

  // Convert introduction StepGroup to StepMessages format for V2
  let introductionV2: any = undefined;
  if (current.introduction) {
    // Extract text keys from introduction actions
    const actions = current.introduction.escalations?.[0]?.actions || [];
    const textKeys = actions
      .map((a: any) => a?.parameters?.find((p: any) => p?.parameterId === 'text')?.value)
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


