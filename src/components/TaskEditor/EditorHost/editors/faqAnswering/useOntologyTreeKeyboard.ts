/**
 * Scorciatoie Ctrl/Cmd + frecce per spostare il nodo selezionato (con sottoalbero).
 * Ignorate mentre il focus è in un campo di testo.
 */

import { useEffect } from 'react';
import { useFaqOntology } from './FaqOntologyContext';

function isTypingInField(el: EventTarget | null): boolean {
  if (!el || !(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return el.isContentEditable;
}

export function useOntologyTreeKeyboard(): void {
  const { editMode, selectedNodeId, keyboardMove } = useFaqOntology();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!editMode || !selectedNodeId) return;
      if (isTypingInField(document.activeElement)) return;
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key;
      if (k !== 'ArrowLeft' && k !== 'ArrowRight' && k !== 'ArrowUp' && k !== 'ArrowDown') {
        return;
      }
      e.preventDefault();
      const dir =
        k === 'ArrowLeft'
          ? 'left'
          : k === 'ArrowRight'
            ? 'right'
            : k === 'ArrowUp'
              ? 'up'
              : 'down';
      keyboardMove(dir);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editMode, keyboardMove, selectedNodeId]);
}
