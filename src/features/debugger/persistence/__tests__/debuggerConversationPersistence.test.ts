/**
 * Debugger timeline persistence: debounced { steps } JSON only; no other module touches localStorage for this key.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cancelPendingDebuggerSave,
  flushPendingDebuggerSave,
  loadDebuggerConversation,
  removeDebuggerSnapshot,
  scheduleSaveDebuggerConversation,
} from '../debuggerConversationPersistence';
import type { DebuggerStep } from '../../core/DebuggerStep';

/** Root tests/setup mocks localStorage; use an in-memory store for real read/write behavior. */
function installMemoryLocalStorage(): void {
  const store: Record<string, string> = {};
  const ls = {
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => {
      store[k] = v;
    },
    removeItem: (k: string) => {
      delete store[k];
    },
    clear: () => {
      for (const k of Object.keys(store)) delete store[k];
    },
    key: (i: number) => Object.keys(store)[i] ?? null,
    get length() {
      return Object.keys(store).length;
    },
  };
  vi.stubGlobal('localStorage', ls);
}

function minimalStep(id: string): DebuggerStep {
  return {
    id,
    utterance: '',
    semanticValue: '',
    linguisticValue: '',
    grammar: { type: 't', contract: 'c', elapsedMs: 0 },
    activeNodeId: '',
    passedNodeIds: [],
    noMatchNodeIds: [],
    activeEdgeId: '',
  };
}

describe('debuggerConversationPersistence', () => {
  beforeEach(() => {
    installMemoryLocalStorage();
    vi.useFakeTimers();
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('scheduleSaveDebuggerConversation does not write immediately', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem');
    scheduleSaveDebuggerConversation([minimalStep('a')], 'p1', 'f1');
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('debounce coalesces to latest steps', () => {
    scheduleSaveDebuggerConversation([minimalStep('a')], 'p1', 'f1');
    scheduleSaveDebuggerConversation([minimalStep('b')], 'p1', 'f1');
    vi.advanceTimersByTime(450);
    const raw = localStorage.getItem('omnia.debugger.conversation.v1:p1:f1');
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!);
    expect(parsed.steps).toHaveLength(1);
    expect(parsed.steps[0].id).toBe('b');
    expect(Object.keys(parsed)).toEqual(['steps']);
  });

  it('cancelPendingDebuggerSave prevents write', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem');
    scheduleSaveDebuggerConversation([minimalStep('a')], 'p1', 'f1');
    cancelPendingDebuggerSave();
    vi.advanceTimersByTime(450);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('flushPendingDebuggerSave writes immediately', () => {
    scheduleSaveDebuggerConversation([minimalStep('x')], 'p1', 'f1');
    flushPendingDebuggerSave();
    const raw = localStorage.getItem('omnia.debugger.conversation.v1:p1:f1');
    expect(raw).toBeTruthy();
  });

  it('loadDebuggerConversation returns [] when missing', () => {
    expect(loadDebuggerConversation('p1', 'f1')).toEqual([]);
  });

  it('hydration round-trips steps', () => {
    scheduleSaveDebuggerConversation([minimalStep('hydr')], 'p1', 'f1');
    flushPendingDebuggerSave();
    const loaded = loadDebuggerConversation('p1', 'f1');
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe('hydr');
  });

  it('removeDebuggerSnapshot clears key', () => {
    scheduleSaveDebuggerConversation([minimalStep('z')], 'p1', 'f1');
    flushPendingDebuggerSave();
    expect(loadDebuggerConversation('p1', 'f1').length).toBe(1);
    removeDebuggerSnapshot('p1', 'f1');
    expect(loadDebuggerConversation('p1', 'f1')).toEqual([]);
  });
});
