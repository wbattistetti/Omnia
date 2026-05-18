import { describe, expect, it } from 'vitest';
import {
  ELEVENLABS_WORKFLOW_BACKGROUND_ID,
  ELEVENLABS_WORKFLOW_REACT_FLOW_ID,
  omniaFlowBackgroundPatternId,
  omniaFlowReactFlowId,
} from '../flowReactFlowInstanceIds';

describe('flowReactFlowInstanceIds', () => {
  it('derives distinct omnia ids per flow canvas', () => {
    expect(omniaFlowReactFlowId('main')).toBe('omnia-flow-main');
    expect(omniaFlowBackgroundPatternId('main')).toBe('omnia-flow-main-dots');
    expect(omniaFlowReactFlowId('subflow_abc')).not.toBe(omniaFlowReactFlowId('main'));
  });

  it('keeps elevenlabs ids stable and separate from omnia', () => {
    expect(ELEVENLABS_WORKFLOW_REACT_FLOW_ID).toContain('elevenlabs');
    expect(ELEVENLABS_WORKFLOW_BACKGROUND_ID).not.toBe(omniaFlowBackgroundPatternId('main'));
  });
});
