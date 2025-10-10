import { describe, it, expect, vi, beforeEach } from 'vitest';
import { typeToMode } from '../../../utils/normalizers';

// Minimal function under test extracted idea: simulate ActFactory.createAndAttachAct behavior
async function simulateCreateAndAttach({ name, type, onImmediateRowUpdate, onInstanceCreated }: any) {
  const mode = typeToMode(type);
  // immediate row update
  onImmediateRowUpdate({ type, mode, baseActId: 'local_act', actId: 'local_act', factoryId: null });
  // async instance creation
  await Promise.resolve();
  onImmediateRowUpdate({ instanceId: 'inst_1', type, mode });
  onInstanceCreated?.('inst_1');
}

describe('pick type -> row update -> instance patch integration (simulated)', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it('updates row immediately with type/mode and repatches after instance', async () => {
    const patches: any[] = [];
    const onImmediateRowUpdate = (p: any) => patches.push(p);
    const onInstanceCreated = vi.fn();

    await simulateCreateAndAttach({ name: 'Hello', type: 'Confirmation', onImmediateRowUpdate, onInstanceCreated });

    // First patch immediate
    expect(patches[0]).toMatchObject({ type: 'Confirmation', mode: 'DataConfirmation' });
    // Second patch after instance with stable type/mode
    expect(patches[1]).toMatchObject({ instanceId: 'inst_1', type: 'Confirmation', mode: 'DataConfirmation' });
    expect(onInstanceCreated).toHaveBeenCalledWith('inst_1');
  });
});
