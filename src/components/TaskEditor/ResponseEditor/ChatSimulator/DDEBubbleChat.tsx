import React from 'react';
import type { AssembledDDT } from '../../../DialogueDataTemplateBuilder/DDTAssembler/currentDDT.types';
import { AlertTriangle } from 'lucide-react';
import UserMessage, { type Message } from '../../../ChatSimulator/UserMessage';
import BotMessage from './BotMessage';
import { getStepColor } from './chatSimulatorUtils';
import { useFontContext } from '../../../../context/FontContext';
import { useMessageEditing } from './hooks/useMessageEditing';

export default function DDEBubbleChat({
  currentDDT,
  translations,
  onUpdateDDT
}: {
  currentDDT: AssembledDDT;
  translations?: Record<string, string>;
  onUpdateDDT?: (updater: (ddt: AssembledDDT) => AssembledDDT) => void;
}) {
  const { combinedClass, fontSize } = useFontContext();
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [sessionId, setSessionId] = React.useState<string | null>(null);
  const [backendError, setBackendError] = React.useState<string | null>(null);
  const [isWaitingForInput, setIsWaitingForInput] = React.useState(false);
  const eventSourceRef = React.useRef<EventSource | null>(null);
  const sentTextRef = React.useRef<string>('');

  // Message ID generator
  const messageIdCounter = React.useRef(0);
  const generateMessageId = (prefix: string = 'msg') => {
    messageIdCounter.current += 1;
    return `${prefix}-${Date.now()}-${messageIdCounter.current}`;
  };

  // Message editing state and handlers
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

  // Connect to backend via SSE
  // ❌ CRITICAL: NO frontend dialogue logic - ALL messages come from backend via SSE
  // If backend is not reachable, NO messages should be shown, NO dialogue should start
  React.useEffect(() => {
    if (!currentDDT) {
      // Clear messages when DDT is not available - NO frontend logic
      setMessages([]);
      setBackendError(null);
      setIsWaitingForInput(false);
      return;
    }

    // Clear any existing messages when starting a new session - NO frontend logic
    setMessages([]);
    messageIdCounter.current = 0;
    setBackendError(null);
    setIsWaitingForInput(false);

    const baseUrl = 'http://localhost:3101';

    const startSession = async () => {
      try {
        setBackendError(null);
        const translationsData = ((currentDDT as any)?.translations && (((currentDDT as any).translations as any).en || (currentDDT as any).translations)) || {};

        const startResponse = await fetch(`${baseUrl}/api/runtime/ddt/session/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ddtInstance: currentDDT,
            translations: translationsData,
            limits: {
              noMatchMax: 3,
              noInputMax: 3,
              notConfirmedMax: 2
            }
          })
        });

        if (!startResponse.ok) {
          const errorText = await startResponse.text();
          // Clear any existing messages when backend is not available
          setMessages([]);
          throw new Error(`Backend server not available: ${startResponse.statusText} - ${errorText}`);
        }

        const { sessionId: newSessionId } = await startResponse.json();
        setSessionId(newSessionId);
        console.log('[DDEBubbleChat] ✅ Backend session created:', { sessionId: newSessionId });

        // Open SSE stream via Ruby proxy (to avoid CORS issues)
        // Ruby proxies /api/runtime/ddt/session/{id}/stream to VB.NET orchestrator
        console.log('[DDEBubbleChat] Opening SSE stream via Ruby proxy:', `${baseUrl}/api/runtime/ddt/session/${newSessionId}/stream`);
        const eventSource = new EventSource(`${baseUrl}/api/runtime/ddt/session/${newSessionId}/stream`);
        eventSourceRef.current = eventSource;

        // Log connection state changes
        eventSource.onopen = () => {
          console.log('[DDEBubbleChat] ✅ SSE stream opened successfully');
        };

        // Handle messages from backend
        // ❌ CRITICAL: ONLY add messages that come from backend - NO frontend logic
        eventSource.addEventListener('message', (e: MessageEvent) => {
          try {
            const msg = JSON.parse(e.data);
            console.log('[DDEBubbleChat] 📨 Backend message received:', msg);

            // Only add message if it has actual text from backend
            const messageText = msg.text || msg.message || '';
            if (!messageText.trim()) {
              console.warn('[DDEBubbleChat] Received empty message from backend, ignoring');
              return;
            }

            // Determine message type from backend data
            const stepType = msg.stepType || 'ask';
            const textKey = msg.textKey || msg.key;

            // ❌ ONLY backend can determine messages - frontend just displays them
            setMessages((m) => [...m, {
              id: generateMessageId('bot'),
              type: 'bot',
              text: messageText,
              stepType: stepType as any,
              textKey: textKey,
              color: getStepColor(stepType)
            }]);
          } catch (error) {
            console.error('[DDEBubbleChat] Error parsing message', error);
            // ❌ Do NOT create fallback messages - if backend fails, show nothing
          }
        });

        // Handle waiting for input
        eventSource.addEventListener('waitingForInput', (e: MessageEvent) => {
          try {
            const data = JSON.parse(e.data);
            console.log('[DDEBubbleChat] Backend waiting for input:', data);
            setIsWaitingForInput(true);
          } catch (error) {
            console.error('[DDEBubbleChat] Error parsing waitingForInput', error);
          }
        });

        // Handle state updates
        eventSource.addEventListener('stateUpdate', (e: MessageEvent) => {
          try {
            const data = JSON.parse(e.data);
            console.log('[DDEBubbleChat] Backend state update:', data);
            // State updates are handled by backend, we just log them
          } catch (error) {
            console.error('[DDEBubbleChat] Error parsing stateUpdate', error);
          }
        });

        // Handle completion
        // ❌ CRITICAL: Only show success message if backend sends it - NO frontend-generated messages
        eventSource.addEventListener('complete', (e: MessageEvent) => {
          try {
            const result = JSON.parse(e.data);
            console.log('[DDEBubbleChat] Backend complete:', result);
            // ❌ Only add message if backend explicitly sends a message in the result
            // Do NOT generate frontend messages like "✅ Dati raccolti con successo!"
            if (result.success && result.message) {
              setMessages((m) => [...m, {
                id: generateMessageId('bot'),
                type: 'bot',
                text: result.message,
                stepType: 'success',
                color: getStepColor('success')
              }]);
            }
            setIsWaitingForInput(false);
          } catch (error) {
            console.error('[DDEBubbleChat] Error parsing complete', error);
            // ❌ Do NOT create fallback messages - if backend fails, show nothing
          }
        });

        // Handle errors
        eventSource.addEventListener('error', (e: MessageEvent) => {
          try {
            if (e.data) {
              const errorData = JSON.parse(e.data);
              setBackendError(errorData.error || 'Backend error');
            }
          } catch (error) {
            console.error('[DDEBubbleChat] Error parsing error event', error);
          }
        });

        eventSource.onerror = (error) => {
          console.error('[DDEBubbleChat] SSE connection error', error);
          if (eventSource.readyState === EventSource.CLOSED) {
            // Clear messages when connection is closed - backend is not available
            setMessages([]);
            setBackendError('Connection to backend server closed. Is Ruby server running on port 3101?');
            setIsWaitingForInput(false);
          }
        };
      } catch (error) {
        console.error('[DDEBubbleChat] Backend session error', error);
        // Clear any existing messages when connection fails
        setMessages([]);
        setBackendError(error instanceof Error ? error.message : 'Failed to connect to backend server. Is Ruby server running on port 3101?');
        setIsWaitingForInput(false);
      }
    };

    startSession();

    // Cleanup on unmount
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (sessionId) {
        const baseUrl = 'http://localhost:3101';
        fetch(`${baseUrl}/api/runtime/ddt/session/${sessionId}`, {
          method: 'DELETE'
        }).catch(() => {});
      }
    };
  }, [currentDDT]);

  // Clear input when sent text appears as a user message
  React.useEffect(() => {
    if (sentTextRef.current && messages.length > 0) {
      const matchingMessage = [...messages]
        .reverse()
        .find(m => m.type === 'user' && m.text === sentTextRef.current);

      if (matchingMessage) {
        setInlineDraft('');
        sentTextRef.current = '';
        requestAnimationFrame(() => ensureInlineFocus());
      }
    }
  }, [messages, setInlineDraft, ensureInlineFocus]);

  // Keep the inline input in view
  React.useEffect(() => {
    const rafId = requestAnimationFrame(() => {
      try {
        inlineInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } catch { }
      try { ensureInlineFocus(); } catch { }
    });
    return () => cancelAnimationFrame(rafId);
  }, [messages.length, ensureInlineFocus]);

  // Handle sending user input to backend
  const handleSend = async (text: string) => {
    const trimmed = String(text || '').trim();
    if (!trimmed || !sessionId) return;

    try {
      // Add user message immediately
      setMessages((prev) => [...prev, {
        id: generateMessageId('user'),
        type: 'user',
        text: trimmed,
        matchStatus: 'match'
      }]);

      // Freeze text for input clearing
      sentTextRef.current = trimmed;

      // Send input to backend (Ruby proxies to orchestrator)
      const baseUrl = 'http://localhost:3101';
      const response = await fetch(`${baseUrl}/api/runtime/ddt/session/${sessionId}/input`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: trimmed
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to send input: ${response.statusText} - ${errorText}`);
      }

      setIsWaitingForInput(false);
    } catch (error) {
      console.error('[DDEBubbleChat] Error sending input', error);
      setBackendError(error instanceof Error ? error.message : 'Failed to send input to backend');
    }
  };

  // Reset function
  const handleReset = () => {
    if (sessionId) {
      const baseUrl = 'http://localhost:3101';
      fetch(`${baseUrl}/api/runtime/ddt/session/${sessionId}`, {
        method: 'DELETE'
      }).catch(() => {});
    }
    setMessages([]);
    messageIdCounter.current = 0;
    setBackendError(null);
    setIsWaitingForInput(false);
    sentTextRef.current = '';

    // Restart session
    if (currentDDT) {
      const baseUrl = 'http://localhost:3101';
      const translationsData = ((currentDDT as any)?.translations && (((currentDDT as any).translations as any).en || (currentDDT as any).translations)) || {};

      fetch(`${baseUrl}/api/runtime/ddt/session/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ddtInstance: currentDDT,
          translations: translationsData,
          limits: {
            noMatchMax: 3,
            noInputMax: 3,
            notConfirmedMax: 2
          }
        })
      })
        .then(res => res.json())
        .then(data => {
          setSessionId(data.sessionId);
          // SSE connection will be re-established by useEffect
        })
        .catch(err => {
          console.error('[DDEBubbleChat] Error restarting session', err);
          setBackendError(err.message);
        });
    }
  };

  return (
    <div className={`h-full flex flex-col bg-white ${combinedClass}`}>
      <div className="border-b p-3 bg-gray-50 flex items-center gap-2">
        <button
          onClick={handleReset}
          className={`px-2 py-1 rounded border bg-gray-100 border-gray-300 text-gray-700 ${combinedClass}`}
        >
          Reset
        </button>
        {backendError && (
          <div className="flex items-center gap-2 text-red-600 text-sm">
            <AlertTriangle size={16} />
            <span>{backendError}</span>
          </div>
        )}
      </div>
      <div className={`flex-1 overflow-y-auto p-4 space-y-3 ${combinedClass}`} ref={scrollContainerRef}>
        {messages.map((m) => {
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

          if (m.type === 'system') {
            return (
              <div key={m.id} className={`flex items-center gap-2 text-yellow-700 ${combinedClass}`}>
                <AlertTriangle size={12} className="flex-shrink-0 text-yellow-600" />
                <span>{m.text}</span>
              </div>
            );
          }

          return null;
        })}
        {/* Input field */}
        <div className={`bg-white border border-gray-300 rounded-lg p-2 shadow-sm max-w-xs lg:max-w-md w-full mt-3 ${combinedClass}`}>
          <style dangerouslySetInnerHTML={{__html: `
            .chat-simulator-input-placeholder::placeholder {
              font-family: inherit !important;
              font-size: inherit !important;
            }
          `}} />
          <input
            type="text"
            className={`chat-simulator-input-placeholder w-full px-2 py-1 border rounded focus:outline-none focus:ring-2 focus:ring-purple-500 ${combinedClass}`}
            style={{
              fontFamily: 'inherit',
              fontSize: 'inherit'
            }}
            ref={inlineInputRef}
            onFocus={() => {
              try { inlineInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch { }
            }}
            placeholder={isWaitingForInput ? "Type response..." : "Waiting for backend..."}
            value={inlineDraft}
            onChange={(e) => setInlineDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && isWaitingForInput) {
                const v = inlineDraft.trim();
                if (!v) return;
                sentTextRef.current = v;
                void handleSend(v);
              }
            }}
            disabled={!isWaitingForInput}
            autoFocus
          />
        </div>
      </div>
    </div>
  );
}
