import React from 'react';
import type { Message } from '@components/ChatSimulator/UserMessage';
import { useProjectTranslations } from '@context/ProjectTranslationsContext';
import type { AssembledTaskTree } from '@components/TaskTreeBuilder/DDTAssembler/currentDDT.types';
import { updateActionTextInDDT } from '@responseEditor/ChatSimulator/utils/updateActionText';

interface UseMessageEditingProps {
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  currentDDT: AssembledTaskTree;
  onUpdateDDT?: (updater: (ddt: AssembledTaskTree) => AssembledTaskTree) => void;
}

export function useMessageEditing({ messages, setMessages, currentDDT, onUpdateDDT }: UseMessageEditingProps) {
  const { addTranslation } = useProjectTranslations();

  // State for hover and editing
  const [hoveredId, setHoveredId] = React.useState<string | null>(null);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [draftText, setDraftText] = React.useState<string>('');
  const [inlineDraft, setInlineDraft] = React.useState<string>('');

  // Refs for scrolling and input focus
  const scrollContainerRef = React.useRef<HTMLDivElement | null>(null);
  const inlineInputRef = React.useRef<HTMLInputElement | null>(null);

  // Ensure inline input gets focus (with retry logic for React 18+)
  const ensureInlineFocus = React.useCallback((retries: number = 8) => {
    const attempt = (i: number) => {
      const el = inlineInputRef.current;
      if (!el) return;
      try { el.focus({ preventScroll: true } as any); } catch { }
      if (document.activeElement !== el && i < retries) {
        setTimeout(() => attempt(i + 1), 50);
      }
    };
    requestAnimationFrame(() => attempt(0));
  }, []);

  // Handlers for editing messages
  const handleEdit = React.useCallback((id: string, text: string) => {
    setEditingId(id);
    setDraftText(text);
  }, []);

  const handleSave = React.useCallback((id: string, text: string) => {
    const msg = messages.find(x => x.id === id);
    if (msg?.textKey) {
      // 1. Update translation in memory (available for on-the-fly tests via window.__projectTranslationsContext)
      // Database save happens only when user clicks explicit save button
      try {
        addTranslation(msg.textKey, text);
      } catch (err) {
        console.error('[useMessageEditing] Failed to update translation:', err);
      }

      // 2. Update action.text in DDT (primary source of truth, same as StepEditor)
      if (onUpdateDDT && msg.stepType) {
        try {
          onUpdateDDT((ddt) => updateActionTextInDDT(
            ddt,
            msg.textKey!,
            msg.stepType!,
            text,
            msg.escalationNumber
          ));
        } catch (error) {
          console.error('[useMessageEditing] Failed to update action.text in DDT:', error);
        }
      }

      // 3. Update local message state (for immediate UI feedback)
      setMessages((prev) => prev.map(x => x.id === id ? { ...x, text } : x));
    }
    setEditingId(null);
  }, [messages, setMessages, addTranslation, currentDDT, onUpdateDDT]);

  const handleCancel = React.useCallback(() => {
    setEditingId(null);
    setDraftText('');
  }, []);

  return {
    // State
    hoveredId,
    setHoveredId,
    editingId,
    draftText,
    inlineDraft,
    setInlineDraft,
    // Refs
    scrollContainerRef,
    inlineInputRef,
    // Functions
    ensureInlineFocus,
    handleEdit,
    handleSave,
    handleCancel
  };
}

