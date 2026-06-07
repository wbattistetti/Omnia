import { describe, expect, it } from 'vitest';
import { buildKbDialogAgentTaskSnapshotForRuntime } from '../buildKbDialogAgentTaskSnapshot';
import { TaskType, type Task } from '@types/taskTypes';
import { generateKbDialogUseCases } from '@domain/knowledgeBase/kbDialog/kbDialogUseCaseGeneration';
import { inferSelectorSpecFromGrid } from '@domain/knowledgeBase/kbSelectorSpec';

const grid = {
  headers: ['specialita', 'tipo_visita'],
  rows: [
    ['cardiologia', 'prima_visita'],
    ['radiologia', 'prima_visita'],
  ],
};

describe('buildKbDialogAgentTaskSnapshotForRuntime', () => {
  it('refreshes acquisition say from UC dialogue in snapshot', () => {
    const selectorSpec = inferSelectorSpecFromGrid(grid);
    const gen = generateKbDialogUseCases({ grid, selectorSpec });
    const specUc = gen.useCases.find(
      (uc) =>
        uc.kb_dialog_meta?.kind === 'acquisition' && uc.kb_dialog_meta.selectorColumnId === 'specialita'
    )!;
    const designerSay = 'Che visita desidera prenotare?';
    const editedDialogue = specUc.dialogue.map((t) =>
      t.role === 'assistant' ? { ...t, content: designerSay } : t
    );

    const task = {
      id: 'agent-1',
      type: TaskType.AIAgent,
      agentConvaiDeployMode: 'kb_deterministic',
      agentUseCasesJson: JSON.stringify(
        gen.useCases.map((uc) =>
          uc.id === specUc.id ? { ...uc, dialogue: editedDialogue } : uc
        )
      ),
      agentKbDialogIndexJson: JSON.stringify(gen.runtimeIndex),
      agentKnowledgeBaseDocumentsJson: '[]',
    } as Task;

    const snap = buildKbDialogAgentTaskSnapshotForRuntime(task);
    expect(snap).not.toBeNull();
    const index = JSON.parse(snap!.agentKbDialogIndexJson) as {
      acquisition: Record<string, { rows: { say: string }[] }>;
    };
    expect(index.acquisition.specialita.rows[0]?.say).toBe(designerSay);
  });
});
