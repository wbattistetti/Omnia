import type { Message } from '@components/ChatSimulator/UserMessage';

/**
 * Runtime bridge exposed by debugger chat.
 */
export interface DebuggerRuntimeBridge {
  restart(): Promise<void>;
  /**
   * Resolves when the session reports it is ready to accept user input (e.g. SSE waitingForInput).
   * Call before sendUserInput to avoid racing restart/start and the first provideInput.
   */
  waitUntilWaitingForInput(timeoutMs?: number): Promise<void>;
  sendUserInput(input: string): Promise<void>;
  getMessages(): Message[];
  waitForNextBotMessage(afterBotCount: number, timeoutMs?: number): Promise<Message | null>;
}

