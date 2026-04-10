/**
 * FLOW.SAVE-BULK REFACTOR — Unit tests for global vs flow-slice translation key routing.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@flows/activeFlowCanvas', () => ({
  getActiveFlowCanvasId: vi.fn(() => 'main'),
}));

import { getActiveFlowCanvasId } from '@flows/activeFlowCanvas';
import { getFlowIdForFlowScopedWrite, shouldPersistTranslationToGlobalApi } from '../flowScopedTranslation';

const TASK_KEY = 'task:550e8400-e29b-41d4-a716-446655440001';
const FLOW_KEY = 'flow:660e8400-e29b-41d4-a716-446655440002';

describe('getFlowIdForFlowScopedWrite', () => {
  beforeEach(() => {
    vi.mocked(getActiveFlowCanvasId).mockReturnValue('main');
  });

  it('returns null for runtime keys', () => {
    expect(getFlowIdForFlowScopedWrite('runtime.foo.bar')).toBeNull();
  });

  it('routes task: keys to active flow canvas', () => {
    expect(getFlowIdForFlowScopedWrite(TASK_KEY)).toBe('main');
  });

  it('routes flow: keys to the guid flow id', () => {
    expect(getFlowIdForFlowScopedWrite(FLOW_KEY)).toBe('660e8400-e29b-41d4-a716-446655440002');
  });

  it('routes bare UUID to active flow canvas', () => {
    expect(getFlowIdForFlowScopedWrite('550e8400-e29b-41d4-a716-446655440003')).toBe('main');
  });
});

describe('shouldPersistTranslationToGlobalApi', () => {
  it('allows runtime.* for global API', () => {
    expect(shouldPersistTranslationToGlobalApi('runtime.x')).toBe(true);
  });

  it('excludes task:, flow:, and bare UUID from global API', () => {
    expect(shouldPersistTranslationToGlobalApi(TASK_KEY)).toBe(false);
    expect(shouldPersistTranslationToGlobalApi(FLOW_KEY)).toBe(false);
    expect(shouldPersistTranslationToGlobalApi('550e8400-e29b-41d4-a716-446655440004')).toBe(false);
  });

  it('excludes variable:, interface:, and slot: from global API', () => {
    expect(shouldPersistTranslationToGlobalApi('variable:550e8400-e29b-41d4-a716-446655440010')).toBe(false);
    expect(shouldPersistTranslationToGlobalApi('interface:550e8400-e29b-41d4-a716-446655440011')).toBe(false);
    expect(shouldPersistTranslationToGlobalApi('slot:550e8400-e29b-41d4-a716-446655440012')).toBe(false);
  });
});

describe('getFlowIdForFlowScopedWrite (kinds)', () => {
  beforeEach(() => {
    vi.mocked(getActiveFlowCanvasId).mockReturnValue('subflow_a');
  });

  it('routes variable: and interface: to active canvas', () => {
    expect(getFlowIdForFlowScopedWrite('variable:550e8400-e29b-41d4-a716-446655440020')).toBe('subflow_a');
    expect(getFlowIdForFlowScopedWrite('interface:550e8400-e29b-41d4-a716-446655440021')).toBe('subflow_a');
    expect(getFlowIdForFlowScopedWrite('slot:550e8400-e29b-41d4-a716-446655440022')).toBe('subflow_a');
  });
});
