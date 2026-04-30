import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { generateSafeGuid } from '@utils/idGenerator';
import { taskRepository } from '../../../../../services/TaskRepository';
import { TaskType } from '../../../../../types/taskTypes';
import { makeTranslationKey } from '../../../../../utils/translationKeys';

type Args = {
  instanceId: string;
  fallbackTaskType: TaskType;
  getCurrentProjectId: () => string | undefined;
  getTranslation: (key: string) => string;
  addTranslation: (key: string, value: string) => void;
  encode: (text: string) => string;
  decode: (text: string) => string;
  reloadToken?: unknown;
  /**
   * Fingerprint of anything that affects decode() (e.g. variable id→label map).
   * When it changes, we re-decode the same persisted raw if the field is not dirty.
   */
  decodeContextKey?: string;
  debounceMs?: number;
};

type Result = {
  text: string;
  setText: (v: string) => void;
  flushNow: () => void;
};

/**
 * Text field backed by ProjectTranslations + task.parameters text key.
 *
 * Model:
 * - **Storage** (`translations[key]`): canonical encoded string (bracket tokens with variable GUIDs).
 * - **Display** (textarea): human-readable while editing; `flushNow` does not rewrite the textarea — only
 *   persists the encoded form. Reload / mapping change still applies `decode(storage)` when not dirty.
 * - **Dirty**: user is editing; we never overwrite from storage until flush saves.
 *
 * `flushNow` identity is stable (does not depend on decodeContextKey) so debounce timers are not
 * reset when only the variable mapping fingerprint changes.
 *
 * ### Key stability guarantee
 * `textKeyRef` caches the translation key for the lifetime of an `instanceId`.
 * This prevents mid-session task reloads (`tasks:loaded`) from generating a new GUID and
 * silently discarding in-flight user input.
 *
 * ### Store-rewind guard
 * After a flush, if an external event (e.g. `loadAllTranslations`) resets the store to a
 * server snapshot that does not yet contain the user's text, `applySnapshotFromStore` skips the
 * update rather than wiping the textarea.
 */
export function useTextTranslationField({
  instanceId,
  fallbackTaskType,
  getCurrentProjectId,
  getTranslation,
  addTranslation,
  encode,
  decode,
  reloadToken,
  decodeContextKey = '',
  debounceMs = 500,
}: Args): Result {
  const [text, setTextState] = useState('');
  const textRef = useRef('');
  const dirtyRef = useRef(false);
  const lastSyncedRawRef = useRef<string | null>(null);
  const lastSyncedDecodeContextRef = useRef<string | null>(null);

  /**
   * Stable translation key for the current instanceId.
   * Set once on first derivation; reset only when instanceId changes (render-time guard below).
   * Prevents task-repository reloads from generating a new GUID and erasing the textarea.
   */
  const textKeyRef = useRef<string | null>(null);

  // Render-time reset: runs synchronously before any effect, so getTextKey always
  // sees a null cache when instanceId first changes.
  const prevInstanceIdRef = useRef<string>(instanceId);
  if (prevInstanceIdRef.current !== instanceId) {
    prevInstanceIdRef.current = instanceId;
    textKeyRef.current = null;
    dirtyRef.current = false;
    lastSyncedRawRef.current = null;
    lastSyncedDecodeContextRef.current = null;
  }

  const encodeRef = useRef(encode);
  const decodeRef = useRef(decode);
  const decodeContextKeyRef = useRef(decodeContextKey);
  encodeRef.current = encode;
  decodeRef.current = decode;
  decodeContextKeyRef.current = decodeContextKey;

  /**
   * Returns (and caches) the translation key for this task instance.
   * If the key was already resolved for this instanceId, it is returned from the ref
   * without consulting TaskRepository — this is the stability guarantee.
   */
  const getTextKey = useCallback((): string | null => {
    if (textKeyRef.current) return textKeyRef.current;
    if (!instanceId) return null;

    let task = taskRepository.getTask(instanceId);
    if (!task) {
      task = taskRepository.createTask(
        fallbackTaskType,
        null,
        undefined,
        instanceId,
        getCurrentProjectId()
      );
    }
    const param = task.parameters?.find((p: any) => p?.parameterId === 'text');
    const key = typeof param?.value === 'string' ? param.value.trim() : '';
    if (key) {
      textKeyRef.current = key;
      return key;
    }

    const newKey = makeTranslationKey('task', generateSafeGuid());
    taskRepository.updateTask(
      instanceId,
      { parameters: [{ parameterId: 'text', value: newKey }] },
      getCurrentProjectId()
    );
    textKeyRef.current = newKey;
    return newKey;
  }, [instanceId, fallbackTaskType, getCurrentProjectId]);

  /** Persists encoded (GUID) form to translations; leaves the visible textarea content unchanged. */
  const flushNow = useCallback(() => {
    const textKey = getTextKey();
    if (!textKey) return;
    const encoded = encodeRef.current(textRef.current);
    addTranslation(textKey, encoded);
    const digest = decodeContextKeyRef.current;
    lastSyncedRawRef.current = encoded;
    lastSyncedDecodeContextRef.current = digest;
    dirtyRef.current = false;
  }, [getTextKey, addTranslation]);

  const setText = useCallback((v: string) => {
    dirtyRef.current = true;
    textRef.current = v;
    setTextState(v);
  }, []);

  /**
   * Pull from translation store into textarea when not dirty.
   *
   * Store-rewind guard: if we already flushed a non-empty value but the store currently returns
   * empty (meaning an external reset — e.g. loadAllTranslations — happened before the server
   * confirmed the write), we skip the update to avoid silently wiping user input.
   */
  const applySnapshotFromStore = useCallback(() => {
    if (dirtyRef.current) return;
    const textKey = getTextKey();
    if (!textKey) return;
    const raw = getTranslation(textKey) ?? '';
    const digest = decodeContextKeyRef.current;

    // Guard: we have a flushed non-empty value that the store has lost (rewind) — skip.
    const lastSynced = lastSyncedRawRef.current;
    if (lastSynced !== null && lastSynced !== '' && raw === '') return;

    if (raw === lastSyncedRawRef.current && digest === lastSyncedDecodeContextRef.current) {
      return;
    }
    const decoded = decodeRef.current(raw);
    textRef.current = decoded;
    setTextState(decoded);
    lastSyncedRawRef.current = raw;
    lastSyncedDecodeContextRef.current = digest;
  }, [getTextKey, getTranslation]);

  useLayoutEffect(() => {
    applySnapshotFromStore();
  }, [applySnapshotFromStore, reloadToken, decodeContextKey]);

  useEffect(() => {
    if (!dirtyRef.current) return;
    const id = window.setTimeout(() => flushNow(), debounceMs);
    return () => window.clearTimeout(id);
  }, [text, flushNow, debounceMs]);

  useEffect(() => {
    return () => {
      if (!dirtyRef.current) return;
      flushNow();
    };
  }, [flushNow]);

  return useMemo(
    () => ({
      text,
      setText,
      flushNow,
    }),
    [text, setText, flushNow]
  );
}
