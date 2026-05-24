/**
 * Unit tests — circuit breaker Express backend.
 */

import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import {
  isExpressBackendPaused,
  markExpressBackendAvailable,
  markExpressBackendUnavailable,
  parseExpressApiErrorBody,
} from '../expressBackendReachability';

describe('expressBackendReachability', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    markExpressBackendAvailable();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('pauses after unavailable mark', () => {
    expect(isExpressBackendPaused()).toBe(false);
    markExpressBackendUnavailable(503);
    expect(isExpressBackendPaused()).toBe(true);
  });

  it('resumes after pause window', () => {
    markExpressBackendUnavailable(500);
    vi.advanceTimersByTime(61_000);
    expect(isExpressBackendPaused()).toBe(false);
  });

  it('parses backend_unavailable JSON', () => {
    const msg = parseExpressApiErrorBody(
      503,
      JSON.stringify({ error: 'backend_unavailable', message: 'down' })
    );
    expect(msg).toBe('down');
  });
});
