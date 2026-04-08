import { describe, expect, it } from 'vitest';
import { resolveStructuralProjectId } from '../resolveStructuralProjectId';

describe('resolveStructuralProjectId', () => {
  it('prefers explicit id', () => {
    expect(resolveStructuralProjectId('explicit', { id: 'pd' })).toBe('explicit');
  });

  it('uses projectData id when explicit empty', () => {
    expect(resolveStructuralProjectId(undefined, { id: 'pd_id' })).toBe('pd_id');
  });

  it('uses projectData projectId when id missing', () => {
    expect(resolveStructuralProjectId(undefined, { projectId: 'pd_pid' })).toBe('pd_pid');
  });
});
