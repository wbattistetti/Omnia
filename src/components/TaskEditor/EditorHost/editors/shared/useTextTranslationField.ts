import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  debounceMs?: number;
};

type Result = {
  text: string;
  setText: (v: string) => void;
  flushNow: () => void;
};

/**
 * Shared text persistence protocol for task editors:
 * - text key in task.parameters (parameterId='text')
 * - translation value in ProjectTranslations
 * - debounced save + flush on dispose
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
  debounceMs = 500,
}: Args): Result {
  const [text, setTextState] = useState('');
  const textRef = useRef('');
  const dirtyRef = useRef(false);
  const lastLoadedRef = useRef<string | null>(null);

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

  const flushNow = useCallback(() => {
    const textKey = getTextKey();
    if (!textKey) return;
    const encoded = encode(textRef.current);
    addTranslation(textKey, encoded);
    lastLoadedRef.current = encoded;
    dirtyRef.current = false;
  }, [getTextKey, encode, addTranslation]);

  const setText = useCallback((v: string) => {
    dirtyRef.current = true;
    textRef.current = v;
    setTextState(v);
  }, []);

  useEffect(() => {
    const textKey = getTextKey();
    if (!textKey) return;
    if (dirtyRef.current) return;
    const raw = getTranslation(textKey) || '';
    if (raw === lastLoadedRef.current) return;
    const decoded = decode(raw);
    textRef.current = decoded;
    setTextState(decoded);
    lastLoadedRef.current = raw;
  }, [getTextKey, getTranslation, decode, reloadToken]);

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
