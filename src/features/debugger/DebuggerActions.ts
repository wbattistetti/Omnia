/**
 * Orchestrates debugger toolbar actions: play (start session), clear (soft reset), restart (hard reset + run).
 */
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { DebuggerSessionState } from './DebuggerStateMachine';
import { FlowHighlighter } from './FlowHighlighter';
import type { Message } from '@components/ChatSimulator/UserMessage';

export interface DebuggerActionsDeps {
  machine: { getState: () => DebuggerSessionState; setState: (s: DebuggerSessionState) => void };
  flow: {
    startSession: () => Promise<void>;
    clearSession: () => Promise<void>;
    restartFlow: () => Promise<void>;
  };
  ui: {
    clearChatLog: () => void;
  };
}

const DBG = '[DebuggerFlow]';

export function createDebuggerActions(deps: DebuggerActionsDeps) {
  const { machine, flow, ui } = deps;

  return {
    async play(): Promise<void> {
      if (machine.getState() !== 'idle') {
        console.info(`${DBG} play ignored (state=${machine.getState()})`);
        return;
      }
      console.info(`${DBG} toolbar Play`);
      machine.setState('running');
      try {
        await flow.startSession();
      } catch {
        machine.setState('idle');
      }
    },

    async clear(): Promise<void> {
      console.info(`${DBG} toolbar Clear (soft reset)`);
      FlowHighlighter.reset();
      try {
        const { clearCompilationErrorsGlobal } = await import('@context/CompilationErrorsContext');
        clearCompilationErrorsGlobal();
      } catch {
        /* optional */
      }
      ui.clearChatLog();
      await flow.clearSession();
      machine.setState('idle');
    },

    async restart(): Promise<void> {
      console.info(`${DBG} toolbar Restart (hard reset + run)`);
      machine.setState('running');
      try {
        await flow.restartFlow();
      } catch {
        machine.setState('idle');
      }
    },
  };
}

export type DebuggerActions = ReturnType<typeof createDebuggerActions>;

/** Used by DebuggerLog typings without importing React namespace in every consumer. */
export type DebuggerLogClearArgs = {
  setMessages: Dispatch<SetStateAction<Message[]>>;
  messagesRef: MutableRefObject<Message[]>;
  resetMessageIdCounter: () => void;
};
