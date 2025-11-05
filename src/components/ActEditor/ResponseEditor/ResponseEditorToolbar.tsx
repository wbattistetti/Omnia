import React from 'react';
import { Undo2, Redo2, MessageSquare, Rocket, BookOpen, List } from 'lucide-react';
import { RightPanelMode } from './RightPanel';

interface ResponseEditorToolbarProps {
  showWizard: boolean;
  rightMode: RightPanelMode;
  showSynonyms: boolean;
  showMessageReview: boolean;
  onRightModeChange: (mode: RightPanelMode) => void;
  onToggleSynonyms: () => void;
  onToggleMessageReview: () => void;
}

/**
 * Hook that returns toolbar buttons configuration for ResponseEditor.
 * Provides buttons for editor actions and panel toggles.
 */
export function useResponseEditorToolbar({
  showWizard,
  rightMode,
  showSynonyms,
  showMessageReview,
  onRightModeChange,
  onToggleSynonyms,
  onToggleMessageReview,
}: ResponseEditorToolbarProps) {
  if (showWizard) {
    return []; // Empty during wizard
  }

  const handleRightModeChange = (mode: RightPanelMode) => {
    // Close both panels when changing right mode
    if (showSynonyms) onToggleSynonyms();
    if (showMessageReview) onToggleMessageReview();
    onRightModeChange(mode);
  };

  return [
    { icon: <Undo2 size={16} />, onClick: () => { }, title: "Undo" },
    { icon: <Redo2 size={16} />, onClick: () => { }, title: "Redo" },
    {
      icon: <Rocket size={16} />,
      label: "Behaviour",
      onClick: () => handleRightModeChange('actions'),
      title: "Define the agent's response flow: prompts, confirmations, error handling, and escalation logic.",
      active: rightMode === 'actions'
    },
    {
      icon: <List size={16} />,
      label: "Personality",
      onClick: () => {
        if (showSynonyms) onToggleSynonyms();
        onToggleMessageReview();
      },
      title: "Customize the agent's tone, empathy level, and linguistic style to match your target audience.",
      active: showMessageReview
    },
    {
      icon: <BookOpen size={16} />,
      label: "Recognition",
      onClick: () => {
        if (showMessageReview) onToggleMessageReview();
        onToggleSynonyms();
      },
      title: "Configure rules and models to identify and extract relevant data from user input.",
      active: showSynonyms
    },
    {
      icon: <MessageSquare size={16} />,
      label: "Test",
      onClick: () => handleRightModeChange('chat'),
      title: "Simulate and validate the dialogue flow to ensure correct behavior and data recognition.",
      active: rightMode === 'chat'
    },
  ];
}

