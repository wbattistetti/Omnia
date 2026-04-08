import { describe, expect, it } from 'vitest';
import { TaskType } from '@types/taskTypes';
import { shouldBlockPortalRoutingForSubflowTaskRow } from '../subflowPortalDragPolicy';

describe('shouldBlockPortalRoutingForSubflowTaskRow', () => {
  it('blocks Subflow (flow) tasks', () => {
    expect(shouldBlockPortalRoutingForSubflowTaskRow(TaskType.Subflow)).toBe(true);
  });

  it('allows other task types', () => {
    expect(shouldBlockPortalRoutingForSubflowTaskRow(TaskType.SayMessage)).toBe(false);
    expect(shouldBlockPortalRoutingForSubflowTaskRow(TaskType.BackendCall)).toBe(false);
  });

  it('allows when task type is unknown (no task loaded)', () => {
    expect(shouldBlockPortalRoutingForSubflowTaskRow(undefined)).toBe(false);
  });
});
