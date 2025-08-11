import React from 'react';
import { Escalation, Action } from './types';
import { normalizeActionFromViewer } from './utils/normalize';

export type Position = 'before' | 'after';

export default function useActionCommands(setLocalModel: React.Dispatch<React.SetStateAction<Escalation[]>>) {
  const editAction = React.useCallback((escalationIdx: number, actionIdx: number, newText: string) => {
    setLocalModel(prev => {
      const next = prev.map(esc => ({ ...esc, actions: [...esc.actions] }));
      next[escalationIdx].actions[actionIdx] = { ...next[escalationIdx].actions[actionIdx], text: newText } as Action;
      return next;
    });
  }, [setLocalModel]);

  const deleteAction = React.useCallback((escalationIdx: number, actionIdx: number) => {
    setLocalModel(prev => {
      const next = prev.map(esc => ({ ...esc, actions: [...esc.actions] }));
      next[escalationIdx].actions.splice(actionIdx, 1);
      return next;
    });
  }, [setLocalModel]);

  const moveAction = React.useCallback((fromEscIdx: number, fromActIdx: number, toEscIdx: number, toActIdx: number, position: Position) => {
    setLocalModel(prev => {
      const next = prev.map(esc => ({ ...esc, actions: [...esc.actions] }));
      const action = next[fromEscIdx].actions[fromActIdx];
      next[fromEscIdx].actions.splice(fromActIdx, 1);
      let insertIdx = toActIdx;
      if (fromEscIdx === toEscIdx && fromActIdx < toActIdx) insertIdx--;
      if (position === 'after') insertIdx++;
      next[toEscIdx].actions.splice(insertIdx, 0, action);
      return next;
    });
  }, [setLocalModel]);

  const dropFromViewer = React.useCallback((incoming: any, to: { escalationIdx: number; actionIdx: number }, position: Position) => {
    setLocalModel(prev => {
      const next = prev.map(esc => ({ ...esc, actions: [...esc.actions] }));
      const newAction = normalizeActionFromViewer(incoming);
      let insertIdx = to.actionIdx;
      if (position === 'after') insertIdx++;
      next[to.escalationIdx].actions.splice(insertIdx, 0, newAction);
      return next;
    });
  }, [setLocalModel]);

  return { editAction, deleteAction, moveAction, dropFromViewer };
}
