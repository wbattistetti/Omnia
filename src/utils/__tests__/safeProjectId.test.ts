import { describe, expect, it, afterEach } from 'vitest';
import {
  DEFAULT_PROJECT_BUCKET,
  getSafeProjectId,
  isFallbackProjectBucket,
  resolveVariableStoreProjectId,
} from '../safeProjectId';
import { setCurrentProjectId } from '../../state/runtime';

describe('safeProjectId', () => {
  afterEach(() => {
    setCurrentProjectId(null);
  });

  it('getSafeProjectId returns runtime id when set', () => {
    setCurrentProjectId('proj-real');
    expect(getSafeProjectId()).toBe('proj-real');
  });

  it('getSafeProjectId returns default bucket when runtime is empty', () => {
    expect(getSafeProjectId()).toBe(DEFAULT_PROJECT_BUCKET);
  });

  it('isFallbackProjectBucket matches default bucket only', () => {
    expect(isFallbackProjectBucket(DEFAULT_PROJECT_BUCKET)).toBe(true);
    expect(isFallbackProjectBucket('real-id')).toBe(false);
  });

  it('resolveVariableStoreProjectId prefers explicit id', () => {
    setCurrentProjectId(null);
    expect(resolveVariableStoreProjectId('explicit')).toBe('explicit');
  });

  it('resolveVariableStoreProjectId falls back when explicit is empty', () => {
    setCurrentProjectId(null);
    expect(resolveVariableStoreProjectId('')).toBe(DEFAULT_PROJECT_BUCKET);
    expect(resolveVariableStoreProjectId(undefined)).toBe(DEFAULT_PROJECT_BUCKET);
  });
});
