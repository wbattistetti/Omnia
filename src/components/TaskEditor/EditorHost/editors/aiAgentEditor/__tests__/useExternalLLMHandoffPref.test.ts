/**
 * Unit test per la preferenza «LLM manual handoff» (localStorage-backed).
 *
 * Copre:
 * - lettura iniziale (default OFF in storage vuoto, ON quando chiave presente)
 * - persistenza su `setEnabled(true)` (chiave `omnia.aiAgent.externalLLMHandoff = '1'`)
 * - `setEnabled(false)` rimuove la chiave (no `'0'` per evitare ambiguità in lettura)
 * - `toggle()` alterna correttamente
 *
 * Nota implementativa: il setup globale (`tests/setup.ts`) installa uno stub no-op su
 * `window.localStorage`. Qui sostituiamo l'oggetto con uno *in-memory funzionale* per
 * verificare la semantica del hook (lettura/scrittura/rimozione effettive).
 */
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useExternalLLMHandoffPref } from '../useExternalLLMHandoffPref';

const STORAGE_KEY = 'omnia.aiAgent.externalLLMHandoff';

interface FakeStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
  clear: () => void;
  data: Map<string, string>;
}

function createFakeStorage(): FakeStorage {
  const data = new Map<string, string>();
  return {
    data,
    getItem(key) {
      return data.has(key) ? (data.get(key) as string) : null;
    },
    setItem(key, value) {
      data.set(key, String(value));
    },
    removeItem(key) {
      data.delete(key);
    },
    clear() {
      data.clear();
    },
  };
}

describe('useExternalLLMHandoffPref', () => {
  let fakeStorage: FakeStorage;
  let originalStorage: Storage | undefined;

  beforeEach(() => {
    fakeStorage = createFakeStorage();
    const descriptor = Object.getOwnPropertyDescriptor(window, 'localStorage');
    originalStorage = descriptor?.value as Storage | undefined;
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      writable: true,
      value: fakeStorage,
    });
  });

  afterEach(() => {
    if (originalStorage !== undefined) {
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        writable: true,
        value: originalStorage,
      });
    }
  });

  it('default OFF quando localStorage è vuoto', () => {
    const { result } = renderHook(() => useExternalLLMHandoffPref());
    expect(result.current.enabled).toBe(false);
  });

  it('legge ON quando chiave presente al valore "1"', () => {
    fakeStorage.setItem(STORAGE_KEY, '1');
    const { result } = renderHook(() => useExternalLLMHandoffPref());
    expect(result.current.enabled).toBe(true);
  });

  it('setEnabled(true) persiste su localStorage', () => {
    const { result } = renderHook(() => useExternalLLMHandoffPref());
    act(() => result.current.setEnabled(true));
    expect(result.current.enabled).toBe(true);
    expect(fakeStorage.getItem(STORAGE_KEY)).toBe('1');
  });

  it('setEnabled(false) rimuove la chiave (no ambiguità su valori falsy)', () => {
    fakeStorage.setItem(STORAGE_KEY, '1');
    const { result } = renderHook(() => useExternalLLMHandoffPref());
    act(() => result.current.setEnabled(false));
    expect(result.current.enabled).toBe(false);
    expect(fakeStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('toggle() alterna ON/OFF e persiste', () => {
    const { result } = renderHook(() => useExternalLLMHandoffPref());
    expect(result.current.enabled).toBe(false);
    act(() => result.current.toggle());
    expect(result.current.enabled).toBe(true);
    expect(fakeStorage.getItem(STORAGE_KEY)).toBe('1');
    act(() => result.current.toggle());
    expect(result.current.enabled).toBe(false);
    expect(fakeStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('valori spuri in storage diversi da "1" sono trattati come OFF', () => {
    fakeStorage.setItem(STORAGE_KEY, 'true');
    const { result } = renderHook(() => useExternalLLMHandoffPref());
    expect(result.current.enabled).toBe(false);
  });
});
