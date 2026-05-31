import { describe, expect, it } from 'vitest';
import {
  mergeSlotContractsFromProposal,
  subsetSlotBackendContractForSlotIds,
} from '../slotBackendContract';
describe('slotBackendContract', () => {
  it('subsetSlotBackendContractForSlotIds keeps only used slots', () => {
    const map = subsetSlotBackendContractForSlotIds(
      [
        {
          slotId: 'data',
          toolName: 'tool_a',
          backendTaskId: 'bk1',
          receive: 'slots[].date',
        },
        {
          slotId: 'orario',
          toolName: 'tool_a',
          backendTaskId: 'bk1',
          receive: 'slots[].time',
        },
      ],
      ['data']
    );
    expect(map).toEqual({
      data: { tool: 'tool_a', receive: 'slots[].date' },
    });
  });

  it('mergeSlotContractsFromProposal merges without overwriting approved', () => {
    const merged = mergeSlotContractsFromProposal(
      [
        {
          slotId: 'data',
          toolName: 'old_tool',
          backendTaskId: 'bk1',
          receive: 'old.path',
          approved: true,
        },
      ],
      [{ slotId: 'data', toolName: 'new_tool', receive: 'new.path' }],
      'bk1'
    );
    expect(merged[0].toolName).toBe('old_tool');
    expect(merged[0].receive).toBe('old.path');
  });

  it('mergeSlotContractsFromProposal adds new slot', () => {
    const merged = mergeSlotContractsFromProposal(
      [],
      [{ slotId: 'orario', toolName: 't1', receive: 'slots[].time', send: ['x'] }],
      'bk1'
    );
    expect(merged).toHaveLength(1);
    expect(merged[0].slotId).toBe('orario');
    expect(merged[0].send).toEqual(['x']);
    expect(merged[0].backendTaskId).toBe('bk1');
  });
});
