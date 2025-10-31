import React from 'react';
import { Undo2, Redo2, Plus, MessageSquare, Code2, FileText, Rocket, BookOpen, List } from 'lucide-react';
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
    { icon: <Plus size={16} />, label: "Add constraint", onClick: () => { }, primary: true },
    {
      icon: <Rocket size={16} />,
      onClick: () => handleRightModeChange('actions'),
      title: "Actions",
      active: rightMode === 'actions'
    },
    {
      icon: <Code2 size={16} />,
      onClick: () => handleRightModeChange('validator'),
      title: "Validator",
      active: rightMode === 'validator'
    },
    {
      icon: <FileText size={16} />,
      onClick: () => handleRightModeChange('testset'),
      title: "Test set",
      active: rightMode === 'testset'
    },
    {
      icon: <MessageSquare size={16} />,
      onClick: () => handleRightModeChange('chat'),
      title: "Chat",
      active: rightMode === 'chat'
    },
    {
      icon: <List size={16} />,
      onClick: () => {
        if (showSynonyms) onToggleSynonyms();
        onToggleMessageReview();
      },
      title: "Message review",
      active: showMessageReview
    },
    {
      icon: <BookOpen size={16} />,
      onClick: () => {
        if (showMessageReview) onToggleMessageReview();
        onToggleSynonyms();
      },
      title: showSynonyms ? 'Close contract editor' : 'Open contract editor',
      active: showSynonyms
    },
  ];
}

