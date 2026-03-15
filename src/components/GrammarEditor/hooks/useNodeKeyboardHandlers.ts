// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { useCallback } from 'react';
import { useNodeEditing } from '../features/node-editing/useNodeEditing';
import { useNodeCreation } from '../features/node-creation/useNodeCreation';
import { useEdgeInteractions } from './useEdgeInteractions';
import { useGrammarStore } from '../core/state/grammarStore';
import { isFloatingNode } from '../core/domain/grammar';

interface UseNodeKeyboardHandlersParams {
  nodeId: string;
  editValue: string;
  isEditing: boolean;
  onSave: (value: string) => void;
  onCancel: () => void;
  onStopEditing: () => void;
}

/**
 * Hook for handling keyboard events in node editing.
 * Single Responsibility: Keyboard event handling only.
 *
 * ENTER behavior:
 * - If node is floating (new, no descendants): save caption + create new node
 * - If node has descendants: only save caption (no new node)
 */
export function useNodeKeyboardHandlers({
  nodeId,
  editValue,
  isEditing,
  onSave,
  onCancel,
  onStopEditing,
}: UseNodeKeyboardHandlersParams) {
  const { editNodeLabel } = useNodeEditing();
  const { createNodeAfterFloating } = useNodeCreation();
  const { handleEdgeCreate } = useEdgeInteractions();
  const { getNode, grammar, deleteNode } = useGrammarStore();

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const trimmedValue = editValue.trim();

        // Get current node once (avoid duplicate calls)
        const currentNode = grammar ? getNode(nodeId) : undefined;

        // Check if node is floating BEFORE saving (use current editValue)
        let shouldCreateNewNode = false;
        if (grammar && currentNode) {
          // Check if floating using current edit value (before save)
          shouldCreateNewNode = isFloatingNode(
            grammar,
            currentNode,
            isEditing,
            editValue // Pass current edit value
          );
        }

        // Always save the current node label
        if (trimmedValue) {
          editNodeLabel(nodeId, trimmedValue);
          onSave(trimmedValue);
        }

        // If node was floating, create new node after it
        if (shouldCreateNewNode && currentNode) {
          // Pass saved label for accurate width calculation
          const newNode = createNodeAfterFloating(currentNode, trimmedValue || undefined);
          if (newNode) {
            handleEdgeCreate(nodeId, newNode.id, 'sequential');

            // Focus immediately on the new node
            // Double RAF: first waits for React commit (after onStopEditing re-render),
            // second waits for browser paint to ensure focus is stable
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                const selector = `[data-node-id="${newNode.id}"] input`;
                const input = document.querySelector(selector) as HTMLInputElement | null;
                if (input) {
                  input.focus();
                  input.select();
                }
              });
            });
          }
        }
        // If node is not floating (has descendants), do nothing
        // Just save the caption and stop editing

        onStopEditing();
      } else if (e.key === 'Escape') {
        e.preventDefault();

        // Check if node is floating (new, empty, no descendants)
        const currentNode = grammar ? getNode(nodeId) : undefined;
        if (grammar && currentNode) {
          const isFloating = isFloatingNode(
            grammar,
            currentNode,
            isEditing,
            editValue // Use current edit value to check if empty
          );

          // If floating and empty, delete the node (user cancelled phrase creation)
          if (isFloating && !editValue.trim()) {
            deleteNode(nodeId);
            onStopEditing();
            return; // Exit early, don't call onCancel
          }
        }

        // If not floating or has content, just cancel editing
        onCancel();
        onStopEditing();
      }
    },
    [
      nodeId,
      editValue,
      isEditing,
      editNodeLabel,
      createNodeAfterFloating,
      handleEdgeCreate,
      onSave,
      onCancel,
      onStopEditing,
      grammar,
      getNode,
      deleteNode,
    ]
  );

  return { handleKeyDown };
}
