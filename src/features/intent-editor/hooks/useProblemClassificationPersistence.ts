/**
 * Subscribes intent/test stores → debounced persist; flushes on unmount.
 * Optional bootstrapPayload extends merged task+localStorage (e.g. closed-domain row seed).
 */
import { useEffect, useRef } from 'react';
import { useIntentStore } from '../state/intentStore';
import { useTestStore } from '../state/testStore';
import type { ProblemPayload } from '../../../types/project';
import { problemPayloadToIntentAndTests, buildProblemPayloadFromStores } from '../services/problemClassificationEditorState';
import {
  loadMergedProblemPayload,
  persistProblemClassificationPayload,
} from '../services/problemClassificationPersistence';

export function useProblemClassificationPersistence(options: {
  instanceId: string;
  projectId: string;
  debounceMs?: number;
  /** Passed to ProjectDataService.setTaskTemplateProblemById when persisting (often task.id). */
  templateTaskId?: string;
  bootstrapPayload?: (merged: ProblemPayload) => ProblemPayload;
  enabled?: boolean;
}): void {
  const {
    instanceId,
    projectId,
    debounceMs = 700,
    templateTaskId,
    bootstrapPayload,
    enabled = true,
  } = options;

  const bootstrapRef = useRef(bootstrapPayload);
  bootstrapRef.current = bootstrapPayload;

  useEffect(() => {
    if (!enabled || !instanceId) return;

    let merged = loadMergedProblemPayload(instanceId, projectId);
    const boot = bootstrapRef.current;
    if (boot) {
      merged = boot(merged);
    }
    const { intents, tests } = problemPayloadToIntentAndTests(merged);
    useIntentStore.setState({ intents });
    useTestStore.setState({ items: tests });

    persistProblemClassificationPayload(instanceId, projectId, buildProblemPayloadFromStores(instanceId), {
      templateTaskId,
    });

    let t: ReturnType<typeof setTimeout>;
    const flush = () => {
      persistProblemClassificationPayload(instanceId, projectId, buildProblemPayloadFromStores(instanceId), {
        templateTaskId,
      });
    };

    const schedule = () => {
      clearTimeout(t);
      t = setTimeout(flush, debounceMs);
    };

    const unsubA = useIntentStore.subscribe(schedule);
    const unsubB = useTestStore.subscribe(schedule);

    return () => {
      clearTimeout(t);
      unsubA();
      unsubB();
      flush();
    };
  }, [instanceId, projectId, debounceMs, templateTaskId, enabled]);
}
