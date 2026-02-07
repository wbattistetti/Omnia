export type SimulationSpeed = 'fast' | 'medium' | 'slow';

const SPEED_MULTIPLIERS: Record<SimulationSpeed, number> = {
  fast: 1,
  medium: 2,
  slow: 8
};

export function delay(ms: number, speed: SimulationSpeed = 'fast'): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms * SPEED_MULTIPLIERS[speed]));
}

export function delayBySeconds(seconds: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}

export const TIMINGS = {
  STEP_BASE: 800,
  STEP_SUBSTEP: 400,
  TOAST_DISPLAY: 5000,
  DIALOG_MESSAGE: 1200
};
