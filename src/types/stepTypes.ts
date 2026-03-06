// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * StepType: Enum for dialogue step types
 * Aligned with StepGroup['type'] but includes additional steps
 */
export enum StepType {
  START = 'start',
  INTRODUCTION = 'introduction',
  NO_INPUT = 'noInput',
  NO_MATCH = 'noMatch',
  CONFIRMATION = 'confirmation',
  NOT_CONFIRMED = 'notConfirmed',
  INVALID = 'invalid',
  SUCCESS = 'success',
}

/**
 * Standard order of steps for display
 */
export const STEP_ORDER: StepType[] = [
  StepType.START,
  StepType.INTRODUCTION,
  StepType.NO_INPUT,
  StepType.NO_MATCH,
  StepType.CONFIRMATION,
  StepType.NOT_CONFIRMED,
  StepType.INVALID,
  StepType.SUCCESS,
];

/**
 * Helper: Convert StepType enum to string
 */
export function stepTypeToString(stepType: StepType): string {
  return stepType;
}

/**
 * Helper: Convert string to StepType enum
 */
export function stringToStepType(stepType: string): StepType | null {
  const entries = Object.entries(StepType) as [string, StepType][];
  const found = entries.find(([_, value]) => value === stepType);
  return found ? found[1] : null;
}

/**
 * Helper: Get step order index
 */
export function getStepOrder(stepType: string): number {
  const enumValue = stringToStepType(stepType);
  if (!enumValue) return 999;
  const index = STEP_ORDER.indexOf(enumValue);
  return index === -1 ? 999 : index;
}
