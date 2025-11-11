import React from 'react';
import { flushSync } from 'react-dom';
import type { AssembledDDT } from '../DialogueDataTemplateBuilder/DDTAssembler/currentDDT.types';
import { AlertTriangle } from 'lucide-react';
import UserMessage, { type Message } from './UserMessage';
import BotMessage from './BotMessage';
import { getStepColor } from './chatSimulatorUtils';
import { useMessageEditing } from './hooks/useMessageEditing';
import { useNewFlowOrchestrator } from './hooks/useNewFlowOrchestrator';
import { Node, Edge } from 'reactflow';
import { NodeData, EdgeData } from '../Flowchart/types/flowTypes';

// getStepIcon and getStepColor moved to chatSimulatorUtils.tsx
// Helper functions for message resolution moved to messageResolvers.ts
// UserMessage and BotMessage components moved to separate files

interface DDEBubbleChatProps {
  currentDDT?: AssembledDDT | null; // Optional for flow mode
  translations?: Record<string, string>;
  onUpdateDDT?: (updater: (ddt: AssembledDDT) => AssembledDDT) => void;
  // Flow mode props
  mode?: 'single-ddt' | 'flow';
  nodes?: Node<NodeData>[]; // For flow mode
  edges?: Edge<EdgeData>[]; // For flow mode
}

export default function DDEBubbleChat({
  currentDDT: propCurrentDDT,
  translations,
  onUpdateDDT,
  mode = 'single-ddt',
  nodes: propNodes,
  edges: propEdges
}: DDEBubbleChatProps) {
  // Flow orchestrator reads directly from window.__flowNodes in flow mode
  // This ensures it always has the latest nodes/rows order without polling or synchronization
  // Using new compiler-based orchestrator
  const getCurrentNodes = React.useCallback(() => {
    if (mode === 'flow') {
      try {
        return (window as any).__flowNodes || propNodes || [];
      } catch {
        return propNodes || [];
      }
    }
    return propNodes || [];
  }, [mode, propNodes]);

  const getCurrentEdges = React.useCallback(() => {
    if (mode === 'flow') {
      try {
        return (window as any).__flowEdges || propEdges || [];
      } catch {
        return propEdges || [];
      }
    }
    return propEdges || [];
  }, [mode, propEdges]);

  const orchestrator = useNewFlowOrchestrator({
    nodes: getCurrentNodes(),
    edges: getCurrentEdges(),
    onMessage: (message) => {
      // Add message to chat immediately using flushSync for instant rendering
      // Use unique ID: task.id + timestamp to avoid duplicates
      const uniqueId = message.id ? `${message.id}-${Date.now()}-${Math.random()}` : `msg-${Date.now()}-${Math.random()}`;
      flushSync(() => {
        setMessages((prev) => {
          // Check if message with same text already exists (avoid duplicates from DDT steps)
          const existingIndex = prev.findIndex(m => m.text === message.text && m.type === 'bot');
          if (existingIndex >= 0) {
            // Message already exists, don't add duplicate
            return prev;
          }
          return [...prev, {
            id: uniqueId,
            type: 'bot',
            text: message.text,
            stepType: message.stepType || 'message',
            color: getStepColor(message.stepType || 'message')
          }];
        });
      });
    },
    onDDTStart: (ddt) => {
      // Set DDT as active
      if (onUpdateDDT) {
        onUpdateDDT(() => ddt);
      }
    },
    onDDTComplete: () => {
      // DDT completed, continue flow
      // Engine will automatically continue
    }
  });

  // Determine current DDT: from orchestrator in flow mode, from prop in single-ddt mode
  const currentDDT = React.useMemo(() => {
    if (mode === 'flow') {
      return orchestrator.currentDDT;
    }
    return propCurrentDDT || null;
  }, [mode, orchestrator.currentDDT, propCurrentDDT]);

  // Message ID generator with counter to ensure uniqueness
  const messageIdCounter = React.useRef(0);
  const generateMessageId = (prefix: string = 'msg') => {
    messageIdCounter.current += 1;
    return `${prefix}-${Date.now()}-${messageIdCounter.current}`;
  };
  // updateTranslation moved to useMessageEditing hook

  const [messages, setMessages] = React.useState<Message[]>([]);

  // 🆕 Track sent text to clear input when it appears as a message
  const sentTextRef = React.useRef<string>('');

  // Message editing state and handlers (extracted to hook)
  const {
    hoveredId,
    setHoveredId,
    editingId,
    draftText,
    inlineDraft,
    setInlineDraft,
    scrollContainerRef,
    inlineInputRef,
    ensureInlineFocus,
    handleEdit,
    handleSave,
    handleCancel
  } = useMessageEditing({
    messages,
    setMessages,
    currentDDT,
    onUpdateDDT
  });

  // Non-interactive messages are now handled directly by orchestrator.onMessage callback

  // Expose variables globally for ConditionEditor and other panels (flow mode)
  React.useEffect(() => {
    if (mode === 'flow') {
      try {
        (window as any).__omniaVars = { ...(orchestrator.variableStore || {}) };
      } catch { }
    }
  }, [mode, orchestrator.variableStore]);

  // Auto-focus input when DDT becomes active
  React.useEffect(() => {
    if (currentDDT && inlineInputRef.current) {
      setTimeout(() => {
        try {
          inlineInputRef.current?.focus({ preventScroll: true } as any);
        } catch { }
      }, 100);
    }
  }, [currentDDT]);

  // 🆕 Clear input when sent text appears as a user message (frozen label)
  // This happens after handleSend adds the message to messages, before engine processes
  React.useEffect(() => {
    if (sentTextRef.current && messages.length > 0) {
      // Find the last user message that matches the sent text
      const matchingMessage = [...messages]
        .reverse()
        .find(m => m.type === 'user' && m.text === sentTextRef.current);

      if (matchingMessage) {
        // Message found in chat - text is now frozen/visible, clear input
        setInlineDraft('');
        sentTextRef.current = ''; // Reset ref
        // Ensure focus after clearing (new text box ready for next input)
        // 🆕 Use requestAnimationFrame for instant focus without delay
        requestAnimationFrame(() => ensureInlineFocus());
      }
    }
  }, [messages, setInlineDraft, ensureInlineFocus]);

  // Keep the inline input minimally in view when it exists
  React.useEffect(() => {
    // 🆕 Use requestAnimationFrame for instant execution, no setTimeout delay
    const rafId = requestAnimationFrame(() => {
      try {
        inlineInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } catch { }
      // After scroll, try to focus the inline input
      try { ensureInlineFocus(); } catch { }
    });
    return () => cancelAnimationFrame(rafId);
  }, [messages.length, ensureInlineFocus]);

  // Message handling removed - flow mode uses orchestrator.handleUserInput

  // Combined messages: all messages from orchestrator
  const allMessages = React.useMemo(() => {
    return messages;
  }, [messages]);

  return (
    <div className="h-full flex flex-col bg-white">
      <div className="border-b p-3 bg-gray-50 flex items-center gap-2">
        {mode === 'flow' && (
          <>
            <button
              onClick={orchestrator.isRunning ? orchestrator.stop : orchestrator.start}
              className="px-2 py-1 text-xs rounded border bg-gray-100 border-gray-300 text-gray-700"
            >
              {orchestrator.isRunning ? 'Stop' : 'Start'}
            </button>
            {orchestrator.isRunning && orchestrator.currentNodeId && (
              <span className="text-xs text-gray-600">
                Node: {orchestrator.getCurrentNode()?.data?.title || orchestrator.currentNodeId}
              </span>
            )}
          </>
        )}
        <button
          onClick={() => {
            setMessages([]);
            messageIdCounter.current = 0;
            if (mode === 'flow') {
              orchestrator.reset();
            }
          }}
          className="px-2 py-1 text-xs rounded border bg-gray-100 border-gray-300 text-gray-700"
        >
          Reset
        </button>
      </div>
      {/* Error message from orchestrator (e.g., DDT validation failed) */}
      {mode === 'flow' && orchestrator.error && (
        <div className="mx-4 mt-2 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
          <AlertTriangle size={16} className="flex-shrink-0 text-red-600 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-800">Errore DDT</p>
            <p className="text-xs text-red-700 mt-1">{orchestrator.error}</p>
            <p className="text-xs text-red-600 mt-2">
              Il debugger si è fermato. Controlla che il DDT sia configurato correttamente per questo atto.
            </p>
          </div>
        </div>
      )}
      <div className="flex-1 overflow-y-auto p-4 space-y-3" ref={scrollContainerRef}>
        {allMessages.map((m) => {
          // Render user message
          if (m.type === 'user') {
            return (
              <UserMessage
                key={m.id}
                message={m}
                editingId={editingId}
                draftText={draftText}
                onEdit={handleEdit}
                onSave={handleSave}
                onCancel={handleCancel}
                onHover={setHoveredId}
              />
            );
          }

          // Render bot message
          if (m.type === 'bot') {
            return (
              <BotMessage
                key={m.id}
                message={m}
                editingId={editingId}
                draftText={draftText}
                hoveredId={hoveredId}
                onEdit={handleEdit}
                onSave={handleSave}
                onCancel={handleCancel}
                onHover={setHoveredId}
              />
            );
          }

          // Render system message (legacy - dovrebbe essere raro ora)
          if (m.type === 'system') {
            return (
              <div key={m.id} className="flex items-center gap-2 text-xs text-yellow-700">
                <AlertTriangle size={12} className="flex-shrink-0 text-yellow-600" />
                <span>{m.text}</span>
              </div>
            );
          }

          return null;
        })}
        {/* Input field DOPO tutti i messaggi - show when DDT is active OR task is WaitingUserInput */}
        {(currentDDT || (mode === 'flow' && orchestrator.currentTask?.state === 'WaitingUserInput')) && (
          <div className="bg-white border border-gray-300 rounded-lg p-2 shadow-sm max-w-xs lg:max-w-md w-full mt-3">
            <input
              type="text"
              className="w-full px-2 py-1 border rounded focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
              ref={inlineInputRef}
              onFocus={() => {
                try { inlineInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch { }
              }}
              placeholder={mode === 'flow' && !currentDDT ? 'In attesa di atto interattivo...' : 'Type response...'}
              value={inlineDraft}
              onChange={(e) => setInlineDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const v = inlineDraft.trim();
                  if (!v) return;

                  // In flow mode, always use new DDT navigator (handleUserInput)
                  if (mode === 'flow' && (currentDDT || orchestrator.currentTask?.state === 'WaitingUserInput')) {
                    // Add user message to chat
                    setMessages((prev) => [...prev, {
                      id: `msg-${Date.now()}-${Math.random()}`,
                      type: 'user',
                      text: v,
                      matchStatus: 'match'
                    }]);

                    // Send input to DDT navigator (async, no await needed)
                    if (orchestrator.handleUserInput) {
                      console.log('[DDEBubbleChat] Calling handleUserInput', { input: v, hasCurrentDDT: !!currentDDT, taskState: orchestrator.currentTask?.state });
                      void orchestrator.handleUserInput(v);
                    } else {
                      console.warn('[DDEBubbleChat] handleUserInput not available');
                      // Fallback: complete the waiting task
                      const waitingTask = orchestrator.currentTask;
                      if (waitingTask && orchestrator.onDDTCompleted) {
                        orchestrator.onDDTCompleted('saturated');
                      }
                    }

                    // Clear input
                    sentTextRef.current = v;
                    setInlineDraft('');
                  }
                  // Focus will be handled after input is cleared (see useEffect below)
                }
              }}
              autoFocus
              disabled={!currentDDT && !(mode === 'flow' && orchestrator.currentTask?.state === 'WaitingUserInput')}
            />
          </div>
        )}
      </div>
      {/* input spostato nella nuvoletta inline sotto l'ultimo prompt */}
    </div>
  );
}

