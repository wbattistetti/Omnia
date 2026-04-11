/**
 * Ensures semantic preset categories only tint row visuals for compatible task types.
 */

import { describe, it, expect } from 'vitest';
import { getTaskVisuals } from '../taskVisuals';
import { TaskType } from '@types/taskTypes';
import { getFlowchartTaskTypeLabelColor } from '../flowchartTaskTypeColors';

describe('getTaskVisuals preset category applicability', () => {
  it('does not apply SayMessage preset colors to Subflow rows', () => {
    const v = getTaskVisuals(TaskType.Subflow, 'info-short', undefined, true);
    expect(v.labelColor).toBe(getFlowchartTaskTypeLabelColor(TaskType.Subflow));
    expect(v.iconColor).toBe(getFlowchartTaskTypeLabelColor(TaskType.Subflow));
  });

  it('applies SayMessage preset when type matches', () => {
    const v = getTaskVisuals(TaskType.SayMessage, 'info-short', undefined, true);
    expect(v.labelColor).toBe('#10b981');
  });
});
