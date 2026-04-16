import type { UseCaseObservedStep, UseCaseStep, UseCaseStepDiff } from '../model';

/**
 * Pure diff engine for one use-case step.
 */
export function diffUseCaseStep(expected: UseCaseStep, actual: UseCaseObservedStep): UseCaseStepDiff {
  const semanticValue = buildDiffField(expected.semanticValue, actual.semanticValue);
  const linguisticValue = buildDiffField(expected.linguisticValue, actual.linguisticValue);
  const grammarType = buildDiffField(expected.grammarUsed.type, actual.grammarUsed.type);
  const grammarContract = buildDiffField(expected.grammarUsed.contract, actual.grammarUsed.contract);
  const botResponse = buildDiffField(expected.botResponse, actual.botResponse);
  const changed =
    semanticValue.changed ||
    linguisticValue.changed ||
    grammarType.changed ||
    grammarContract.changed ||
    botResponse.changed;

  return {
    changed,
    semanticValue,
    linguisticValue,
    grammarType,
    grammarContract,
    botResponse,
  };
}

function buildDiffField(expected: string, actual: string): { changed: boolean; expected: string; actual: string } {
  const left = String(expected || '');
  const right = String(actual || '');
  return {
    changed: left !== right,
    expected: left,
    actual: right,
  };
}

