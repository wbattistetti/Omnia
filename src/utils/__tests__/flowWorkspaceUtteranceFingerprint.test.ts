import { describe, expect, it } from 'vitest';
import { buildFlowCanvasRowFingerprint } from '../flowWorkspaceUtteranceFingerprint';

describe('buildFlowCanvasRowFingerprint', () => {
  it('changes when the same row id moves to another graph node on the same flow', () => {
    const row = { id: 'task-row-1', included: true };
    const before = {
      main: {
        nodes: [
          { id: 'node-a', data: { rows: [row] } },
          { id: 'node-b', data: { rows: [] } },
        ],
      },
    };
    const after = {
      main: {
        nodes: [
          { id: 'node-a', data: { rows: [] } },
          { id: 'node-b', data: { rows: [row] } },
        ],
      },
    };
    expect(buildFlowCanvasRowFingerprint(before as any)).not.toBe(
      buildFlowCanvasRowFingerprint(after as any)
    );
  });
});
