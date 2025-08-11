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

function mapNode(current: MainDataNode): DDTNode {
  const baseAsk: StepAsk = {
    base: 'ask.base',
    reaskNoInput: pad3(['ask.noInput.1', 'ask.noInput.2', 'ask.noInput.3']),
    reaskNoMatch: pad3(['ask.noMatch.1', 'ask.noMatch.2', 'ask.noMatch.3']),
  };

  const stepMessages: StepMessages = {
    ask: baseAsk,
    confirm: {
      base: 'confirm.base',
      paraphraseBefore: false,
      noInput: pad3(['confirm.noInput.1', 'confirm.noInput.2', 'confirm.noInput.3']),
      noMatch: pad3(['confirm.noMatch.1', 'confirm.noMatch.2', 'confirm.noMatch.3']),
    },
    success: { base: ['success.base.1'] },
  };

  return {
    id: current.id,
    label: current.label || current.name || current.id,
    type: 'main',
    required: Boolean(current.required),
    kind: (current.type as any) || 'generic',
    steps: stepMessages,
    subs: (current.subData || []).map((s) => s.id),
    condition: current.condition,
  };
}

export function adaptCurrentToV2(current: AssembledDDT): DDTTemplateV2 {
  const main = current.mainData;
  const nodes: DDTNode[] = [mapNode(main), ...(main.subData || []).map(mapNode)].map((n, idx) => ({
    ...n,
    type: idx === 0 ? 'main' : 'sub',
  }));

  return {
    schemaVersion: '2',
    metadata: {
      id: current.id,
      label: current.label,
    },
    nodes,
  };
}


