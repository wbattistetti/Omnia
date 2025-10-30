import React from 'react';
import { info } from '../../../utils/logger';
import { Escalation, Action } from './types';
import { normalizeActionFromViewer } from './utils/normalize';

export type Position = 'before' | 'after';

export default function useActionCommands(
  setLocalModel: React.Dispatch<React.SetStateAction<Escalation[]>>,
  onCommit?: (next: Escalation[]) => void
) {
  const editAction = React.useCallback((escalationIdx: number, actionIdx: number, newText: string) => {
    setLocalModel(prev => {
      const next = prev.map(esc => ({ ...esc, actions: [...esc.actions] }));
      next[escalationIdx].actions[actionIdx] = { ...next[escalationIdx].actions[actionIdx], text: newText } as Action;
      try { console.log('[Commit][editAction]', { escalationIdx, actionIdx, newText }); info('RESPONSE_EDITOR', 'editAction', { escalationIdx, actionIdx, newTextLen: newText?.length || 0 }); } catch { }
      try { onCommit?.(next); } catch { }
      return next;
    });
  }, [setLocalModel, onCommit]);

  const deleteAction = React.useCallback((escalationIdx: number, actionIdx: number) => {
    setLocalModel(prev => {
      const next = prev.map(esc => ({ ...esc, actions: [...esc.actions] }));
      next[escalationIdx].actions.splice(actionIdx, 1);
      try { console.log('[Commit][deleteAction]', { escalationIdx, actionIdx }); info('RESPONSE_EDITOR', 'deleteAction', { escalationIdx, actionIdx }); } catch { }
      try { onCommit?.(next); } catch { }
      return next;
    });
  }, [setLocalModel, onCommit]);

  const moveAction = React.useCallback((fromEscIdx: number, fromActIdx: number, toEscIdx: number, toActIdx: number, position: Position) => {
    setLocalModel(prev => {
      const next = prev.map(esc => ({ ...esc, actions: [...esc.actions] }));
      const action = next[fromEscIdx].actions[fromActIdx];
      next[fromEscIdx].actions.splice(fromActIdx, 1);
      let insertIdx = toActIdx;
      if (fromEscIdx === toEscIdx && fromActIdx < toActIdx) insertIdx--;
      if (position === 'after') insertIdx++;
      next[toEscIdx].actions.splice(insertIdx, 0, action);
      try { console.log('[Commit][moveAction]', { fromEscIdx, fromActIdx, toEscIdx, toActIdx, position, insertIdx }); info('RESPONSE_EDITOR', 'moveAction', { fromEscIdx, fromActIdx, toEscIdx, toActIdx, position }); } catch { }
      try { onCommit?.(next); } catch { }
      return next;
    });
  }, [setLocalModel, onCommit]);

  const dropFromViewer = React.useCallback((incoming: any, to: { escalationIdx: number; actionIdx: number }, position: Position) => {
    console.log('[useActionCommands][dropFromViewer]', { to, position });
    setLocalModel(prev => {
      const next = prev.map(esc => ({ ...esc, actions: [...esc.actions] }));
      const newAction = normalizeActionFromViewer(incoming);
      let insertIdx = to.actionIdx;
      if (position === 'after') insertIdx++;
      next[to.escalationIdx].actions.splice(insertIdx, 0, newAction);
      console.log('[useActionCommands] Action added at', insertIdx);
      try { console.log('[Commit][dropFromViewer]', { to, position, insertIdx, actionId: (newAction as any)?.actionId }); info('RESPONSE_EDITOR', 'dropFromViewer', { to, position, insertIdx, actionId: (newAction as any)?.actionId }); } catch { }
      try { onCommit?.(next); } catch { }
      return next;
    });
  }, [setLocalModel, onCommit]);

  const appendAction = React.useCallback((escalationIdx: number, action: Action) => {
    setLocalModel(prev => {
      const next = prev.map(esc => ({ ...esc, actions: [...esc.actions] }));
      if (!next[escalationIdx]) {
        // crea escalation mancante
        while (next.length <= escalationIdx) next.push({ actions: [] });
      }
      next[escalationIdx].actions.push(action);
      try { console.log('[Commit][appendAction]', { escalationIdx, actionId: (action as any)?.actionId }); info('RESPONSE_EDITOR', 'appendAction', { escalationIdx, actionId: (action as any)?.actionId }); } catch { }
      try { onCommit?.(next); } catch { }
      return next;
    });
  }, [setLocalModel, onCommit]);

  return { editAction, deleteAction, moveAction, dropFromViewer, appendAction };
}
