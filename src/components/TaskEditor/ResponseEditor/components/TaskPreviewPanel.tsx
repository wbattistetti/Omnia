// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import React, { useState, useMemo } from 'react';
import DDEBubbleChat from '@responseEditor/ChatSimulator/DDEBubbleChat';
import type { Message } from '@components/ChatSimulator/UserMessage';

export type DialogScenario = 'happy' | 'partial' | 'error';

export interface TaskPreviewPanelProps {
  messages?: Message[];
  mockMessages?: {
    happy?: Message[];
    partial?: Message[];
    error?: Message[];
  };
  onScenarioChange?: (scenario: DialogScenario) => void;
}

/**
 * Panel that shows preview of dialogue scenarios using DDEBubbleChat in preview mode
 * Uses tabs to switch between Happy Path, Partial, and Error scenarios
 */
export function TaskPreviewPanel({
  messages,
  mockMessages,
  onScenarioChange,
}: TaskPreviewPanelProps) {
  const [activeScenario, setActiveScenario] = useState<DialogScenario>('happy');

  const handleScenarioChange = (scenario: DialogScenario) => {
    setActiveScenario(scenario);
    if (onScenarioChange) {
      onScenarioChange(scenario);
    }
  };

  // Determine which messages to show
  const activeMessages = useMemo((): Message[] => {
    if (messages) {
      return messages; // Use provided messages if available
    }

    // Otherwise use mock messages based on scenario
    if (mockMessages) {
      switch (activeScenario) {
        case 'happy':
          return mockMessages.happy || [];
        case 'partial':
          return mockMessages.partial || [];
        case 'error':
          return mockMessages.error || [];
        default:
          return [];
      }
    }

    return [];
  }, [messages, mockMessages, activeScenario]);

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#0f172a',
      }}
    >
      {/* Use DDEBubbleChat in preview mode */}
      <DDEBubbleChat
        task={null}
        projectId={null}
        taskTree={null}
        mode="preview"
        previewMessages={activeMessages}
        activeScenario={activeScenario}
        onScenarioChange={handleScenarioChange}
      />
    </div>
  );
}
