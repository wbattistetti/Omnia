import { useState } from 'react';
import { SimulatorState } from './engine/types';
import { initEngine, advance } from './engine/engine';

/**
 * React hook to encapsulate the simulator engine logic.
 * Handles async step advancement and state updates.
 */
export function useSimulator(ddt: any) {
  const [state, setState] = useState<SimulatorState>(() => initEngine(ddt));

  /**
   * Sends user input to the engine and advances the conversation.
   * Updates state asynchronously.
   */
  const sendInput = async (input: string) => {
    const newState = await advance(state, input, ddt);
    setState(newState);
  };

  /**
   * Resets the simulator to its initial state.
   */
  const reset = () => setState(initEngine(ddt));

  return { state, sendInput, reset };
}