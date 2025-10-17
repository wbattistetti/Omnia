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
    console.log('[useActionCommands][dropFromViewer]', { 
      incoming, 
      to, 
      position,
      incomingKeys: Object.keys(incoming || {})
    });
    setLocalModel(prev => {
      console.log('[useActionCommands][dropFromViewer] prev model:', prev);
      const next = prev.map(esc => ({ ...esc, actions: [...esc.actions] }));
      const newAction = normalizeActionFromViewer(incoming);
      console.log('[useActionCommands][dropFromViewer] normalized action:', newAction);
      let insertIdx = to.actionIdx;
      if (position === 'after') insertIdx++;
      console.log('[useActionCommands][dropFromViewer] inserting at:', insertIdx, 'in escalation:', to.escalationIdx);
      next[to.escalationIdx].actions.splice(insertIdx, 0, newAction);
      console.log('[useActionCommands][dropFromViewer] new model:', next);
      return next;
    });
  }, [setLocalModel]);

  const appendAction = React.useCallback((escalationIdx: number, action: Action) => {
    setLocalModel(prev => {
      const next = prev.map(esc => ({ ...esc, actions: [...esc.actions] }));
      if (!next[escalationIdx]) {
        // crea escalation mancante
        while (next.length <= escalationIdx) next.push({ actions: [] });
      }
      next[escalationIdx].actions.push(action);
      return next;
    });
  }, [setLocalModel]);

  return { editAction, deleteAction, moveAction, dropFromViewer, appendAction };
}
