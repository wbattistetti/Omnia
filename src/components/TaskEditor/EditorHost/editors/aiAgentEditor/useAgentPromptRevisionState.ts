/**
 * Reducer-driven state: clean base text (Monaco buffer), delete mask, inserts, and chronological refine ops.
 */

import React from 'react';
import { effectiveFromRevisionMask, type InsertOp } from './effectiveFromRevisionMask';
import type { StructuredRefinementOp } from './structuredRefinementOps';

export interface AgentPromptRevisionState {
  promptBaseText: string;
  deletedMask: boolean[];
  inserts: InsertOp[];
  refinementOpLog: StructuredRefinementOp[];
}

type RevAction =
  | { type: 'RESET'; base: string }
  | { type: 'DELETE_RANGE'; start: number; end: number }
  | { type: 'INSERT'; position: number; text: string };

const initialRevisionState: AgentPromptRevisionState = {
  promptBaseText: '',
  deletedMask: [],
  inserts: [],
  refinementOpLog: [],
};

function revisionReducer(state: AgentPromptRevisionState, action: RevAction): AgentPromptRevisionState {
  switch (action.type) {
    case 'RESET':
      return {
        promptBaseText: action.base,
        deletedMask: new Array(action.base.length).fill(false),
        inserts: [],
        refinementOpLog: [],
      };
    case 'DELETE_RANGE': {
      const { start, end } = action;
      const base = state.promptBaseText;
      const n = [...state.deletedMask];
      const hi = Math.min(end, base.length);
      const lo = Math.max(0, start);
      const newOps: StructuredRefinementOp[] = [];
      let i = lo;
      while (i < hi) {
        if (i >= n.length || n[i]) {
          i++;
          continue;
        }
        const runStart = i;
        while (i < hi && i < n.length && !n[i]) {
          n[i] = true;
          i++;
        }
        const runEnd = i;
        newOps.push({
          type: 'delete',
          start: runStart,
          end: runEnd,
          text: base.slice(runStart, runEnd),
        });
      }
      if (newOps.length === 0) {
        return state;
      }
      return {
        ...state,
        deletedMask: n,
        refinementOpLog: [...state.refinementOpLog, ...newOps],
      };
    }
    case 'INSERT': {
      const pos = Math.max(0, Math.min(action.position, state.promptBaseText.length));
      const id =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `ins-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const op: InsertOp = { id, position: pos, text: action.text };
      return {
        ...state,
        inserts: [...state.inserts, op],
        refinementOpLog: [...state.refinementOpLog, { type: 'insert', position: pos, text: action.text }],
      };
    }
    default:
      return state;
  }
}

export interface UseAgentPromptRevisionStateResult extends AgentPromptRevisionState {
  effectivePrompt: string;
  resetPromptBase: (base: string) => void;
  applyDeleteRange: (start: number, end: number) => void;
  applyInsert: (position: number, text: string) => void;
}

export function useAgentPromptRevisionState(): UseAgentPromptRevisionStateResult {
  const [state, dispatch] = React.useReducer(revisionReducer, initialRevisionState);

  const effectivePrompt = React.useMemo(
    () => effectiveFromRevisionMask(state.promptBaseText, state.deletedMask, state.inserts),
    [state.promptBaseText, state.deletedMask, state.inserts]
  );

  const resetPromptBase = React.useCallback((base: string) => {
    dispatch({ type: 'RESET', base });
  }, []);

  const applyDeleteRange = React.useCallback((start: number, end: number) => {
    dispatch({ type: 'DELETE_RANGE', start, end });
  }, []);

  const applyInsert = React.useCallback((position: number, text: string) => {
    dispatch({ type: 'INSERT', position, text });
  }, []);

  return {
    ...state,
    effectivePrompt,
    resetPromptBase,
    applyDeleteRange,
    applyInsert,
  };
}
