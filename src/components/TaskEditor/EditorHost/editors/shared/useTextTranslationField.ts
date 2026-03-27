import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { taskRepository } from '../../../../../services/TaskRepository';
import { TaskType } from '../../../../../types/taskTypes';

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
 * - **Storage** (`translations[key]`): canonical encoded string (e.g. bracket tokens with GUIDs).
 * - **Display** (textarea): decoded string for humans; always `decode(storage)` when in sync.
 * - **Dirty**: user is editing; we never overwrite from storage until flush saves.
 *
 * `flushNow` identity is stable (does not depend on decodeContextKey) so debounce timers are not
 * reset when only the variable mapping fingerprint changes.
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

  const encodeRef = useRef(encode);
  const decodeRef = useRef(decode);
  const decodeContextKeyRef = useRef(decodeContextKey);
  encodeRef.current = encode;
  decodeRef.current = decode;
  decodeContextKeyRef.current = decodeContextKey;

  const getTextKey = useCallback((): string | null => {
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
    if (key) return key;

    const newKey = uuidv4();
    taskRepository.updateTask(
      instanceId,
      { parameters: [{ parameterId: 'text', value: newKey }] },
      getCurrentProjectId()
    );
    return newKey;
  }, [instanceId, fallbackTaskType, getCurrentProjectId]);

  /** Persists draft and snaps UI to decode(encode(draft)) so labels stay visible. */
  const flushNow = useCallback(() => {
    const textKey = getTextKey();
    if (!textKey) return;
    const encoded = encodeRef.current(textRef.current);
    addTranslation(textKey, encoded);
    const digest = decodeContextKeyRef.current;
    lastSyncedRawRef.current = encoded;
    lastSyncedDecodeContextRef.current = digest;
    dirtyRef.current = false;
    const decoded = decodeRef.current(encoded);
    textRef.current = decoded;
    setTextState(decoded);
  }, [getTextKey, addTranslation]);

  const setText = useCallback((v: string) => {
    dirtyRef.current = true;
    textRef.current = v;
    setTextState(v);
  }, []);

  /** Pull from translation store into textarea when not dirty; uses live ref via getTranslation. */
  const applySnapshotFromStore = useCallback(() => {
    if (dirtyRef.current) return;
    const textKey = getTextKey();
    if (!textKey) return;
    const raw = getTranslation(textKey) ?? '';
    const digest = decodeContextKeyRef.current;
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
