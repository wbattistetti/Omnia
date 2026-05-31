import { describe, expect, it } from 'vitest';
import { inferFormatForSlotId, inferSlotIdFromApiPath } from '../inferSlotIdFromApiPath';

describe('inferSlotIdFromApiPath', () => {
  it('maps slots[].date to data', () => {
    expect(inferSlotIdFromApiPath('slots[].date')).toBe('data');
  });

  it('maps startTime to orario', () => {
    expect(inferSlotIdFromApiPath('slots[].startTime')).toBe('orario');
  });

  it('skips container-only paths', () => {
    expect(inferSlotIdFromApiPath('slots')).toBeUndefined();
    expect(inferSlotIdFromApiPath('summary')).toBeUndefined();
  });

  it('suggests format for data', () => {
    expect(inferFormatForSlotId('data')).toBe('YYYY-MM-DD');
  });
});
