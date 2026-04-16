import { diffUseCaseStep } from '../diff/UseCaseDiffEngine';
import type { UseCase, UseCaseRunResult, UseCaseRuntimePort } from '../model';

/**
 * Executes one use case against a runtime port.
 */
export async function runUseCase(useCase: UseCase, runtimePort: UseCaseRuntimePort): Promise<UseCaseRunResult[]> {
  if (!useCase) {
    throw new Error('runUseCase: useCase is required.');
  }
  if (!runtimePort) {
    throw new Error('runUseCase: runtimePort is required.');
  }
  await runtimePort.restart();

  const out: UseCaseRunResult[] = [];
  for (let i = 0; i < useCase.steps.length; i += 1) {
    const expected = useCase.steps[i];
    const actual = await runtimePort.executeUtterance(expected.userUtterance);
    const diff = diffUseCaseStep(expected, actual);
    out.push({
      stepIndex: i,
      utterance: expected.userUtterance,
      expected,
      actual,
      diff,
      ok: !diff.changed,
    });
  }
  return out;
}

