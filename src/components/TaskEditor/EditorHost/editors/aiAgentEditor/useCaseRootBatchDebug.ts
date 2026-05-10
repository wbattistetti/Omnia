/**
 * Dev-only tracing for the root textarea → batch create use case pipeline.
 * In Chrome DevTools filter console by: useCaseRootBatch
 */

export function logUseCaseRootBatch(stage: string, data?: Record<string, unknown>): void {
  if (!import.meta.env.DEV) return;
  if (data !== undefined) {
    console.info(`[useCaseRootBatch] ${stage}`, data);
  } else {
    console.info(`[useCaseRootBatch] ${stage}`);
  }
}
