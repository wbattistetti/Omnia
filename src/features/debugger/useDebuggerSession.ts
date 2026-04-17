/**
 * React adapter: single debugger session via useReducer; getState stays synchronous after each dispatch.
 */
import React from 'react';
import { applyDebuggerEvent } from './reducer/applyDebuggerEvent';
import type { DebuggerEvent } from './events/DebuggerEvent';
import {
  createInitialDebuggerSessionState,
  type DebuggerSessionState,
} from './session/DebuggerSessionState';

export type UseDebuggerSessionResult = {
  session: DebuggerSessionState;
  dispatchEvent: (event: DebuggerEvent) => void;
  getState: () => DebuggerSessionState;
};

export function useDebuggerSession(): UseDebuggerSessionResult {
  const sessionRef = React.useRef<DebuggerSessionState>(createInitialDebuggerSessionState());

  const [session, dispatch] = React.useReducer(
    (s: DebuggerSessionState, e: DebuggerEvent) => {
      const next = applyDebuggerEvent(s, e);
      sessionRef.current = next;
      return next;
    },
    undefined,
    () => {
      const initial = createInitialDebuggerSessionState();
      sessionRef.current = initial;
      return initial;
    }
  );

  const dispatchEvent = React.useCallback((event: DebuggerEvent) => {
    dispatch(event);
  }, []);

  const getState = React.useCallback(() => sessionRef.current, []);

  return { session, dispatchEvent, getState };
}
