/**
 * Stable, batched patches for `useCase.response.tasks` (palette drops, reorder, delete).
 */

import React from 'react';
import type { AIAgentUseCase } from '@types/aiAgentUseCases';
import type { TaskSequenceRow } from '@responseEditor/taskSequence';
import { mapUseCasesWithResponseTasksUpdaters } from '@domain/aiAgentUseCase/useCaseResponseTasks';

export type PatchUseCaseResponseTasksFn = (
  useCaseId: string,
  updater: (prev: readonly TaskSequenceRow[]) => readonly TaskSequenceRow[]
) => void;

/**
 * Queues functional task updaters per use case and flushes in one `setUseCases` pass
 * so rapid palette drops never read a stale tasks array.
 */
export function usePatchUseCaseResponseTasks(
  setUseCases: React.Dispatch<React.SetStateAction<AIAgentUseCase[]>>
): PatchUseCaseResponseTasksFn {
  const setUseCasesRef = React.useRef(setUseCases);
  setUseCasesRef.current = setUseCases;

  const pendingRef = React.useRef(
    new Map<string, Array<(prev: readonly TaskSequenceRow[]) => readonly TaskSequenceRow[]>>()
  );
  const flushScheduledRef = React.useRef(false);

  const flush = React.useCallback(() => {
    flushScheduledRef.current = false;
    const batch = pendingRef.current;
    if (batch.size === 0) return;
    pendingRef.current = new Map();

    setUseCasesRef.current((prev) => {
      let next = prev;
      for (const [useCaseId, updaters] of batch) {
        next = mapUseCasesWithResponseTasksUpdaters(next, useCaseId, updaters);
      }
      return next;
    });
  }, []);

  const scheduleFlush = React.useCallback(() => {
    if (flushScheduledRef.current) return;
    flushScheduledRef.current = true;
    queueMicrotask(flush);
  }, [flush]);

  return React.useCallback(
    (useCaseId, updater) => {
      const queue = pendingRef.current.get(useCaseId) ?? [];
      queue.push(updater);
      pendingRef.current.set(useCaseId, queue);
      scheduleFlush();
    },
    [scheduleFlush]
  );
}
