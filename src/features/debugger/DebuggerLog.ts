/**
 * Clears debugger chat transcript and related client-side log counters.
 */
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { Message } from '@components/ChatSimulator/UserMessage';

export const DebuggerLog = {
  clear(args: {
    setMessages: Dispatch<SetStateAction<Message[]>>;
    messagesRef: MutableRefObject<Message[]>;
    resetMessageIdCounter: () => void;
  }): void {
    args.resetMessageIdCounter();
    args.setMessages([]);
    args.messagesRef.current = [];
  },
};
