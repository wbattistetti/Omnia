import { describe, expect, it } from 'vitest';
import {
  buildBackendCallDebugPromptSection,
  formatBackendInvocationDebugLine,
} from '../backendCallDebugPrompt';
import type { FlowBackendCallInvocation } from '@features/debugger/types/flowBackendCallDiagnostic';

function inv(partial: Partial<FlowBackendCallInvocation>): FlowBackendCallInvocation {
  return {
    taskId: 'bk1',
    displayName: 'next_window',
    endpoint: 'https://api.example.com/next-window',
    method: 'POST',
    outcome: 'http_success',
    inputParameters: [],
    outputParameters: [
      { name: 'slots[0].date', value: '3 giugno' },
      { name: 'slots[0].time', value: '09:00' },
      { name: 'slots[1].date', value: '4 giugno' },
      { name: 'slots[1].time', value: '11:00' },
    ],
    ...partial,
  };
}

describe('backendCallDebugPrompt', () => {
  it('buildBackendCallDebugPromptSection is empty when disabled', () => {
    expect(buildBackendCallDebugPromptSection(false)).toBe('');
  });

  it('buildBackendCallDebugPromptSection includes DEBUG instruction when enabled', () => {
    const section = buildBackendCallDebugPromptSection(true);
    expect(section).toContain('DEBUG: chiamata backend');
    expect(section).toContain('/next-window');
  });

  it('formatBackendInvocationDebugLine summarizes endpoint and slots', () => {
    const line = formatBackendInvocationDebugLine(inv({}));
    expect(line).toMatch(/DEBUG: chiamata backend `\/next-window` eseguita/);
    expect(line).toContain('3 giugno');
  });

  it('formatBackendInvocationDebugLine reports failure', () => {
    const line = formatBackendInvocationDebugLine(
      inv({ outcome: 'http_error', httpStatus: 400, errorMessage: 'Bad request', outputParameters: [] })
    );
    expect(line).toContain('fallita');
    expect(line).toContain('Bad request');
  });
});
