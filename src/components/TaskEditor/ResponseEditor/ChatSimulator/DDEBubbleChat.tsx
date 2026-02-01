import React from 'react';
import type { Task, TaskTree } from '../../../../types/taskTypes';
import { AlertTriangle } from 'lucide-react';
import UserMessage, { type Message } from '../../../ChatSimulator/UserMessage';
import BotMessage from './BotMessage';
import { getStepColor } from './chatSimulatorUtils';
import { useFontContext } from '../../../../context/FontContext';
import { useMessageEditing } from './hooks/useMessageEditing';

export default function DDEBubbleChat({
  task,
  projectId,
  translations,
  taskTree,
  onUpdateTaskTree
}: {
  task: Task | null;
  projectId: string | null;
  translations?: Record<string, string>;
  taskTree?: TaskTree | null;
  onUpdateTaskTree?: (updater: (taskTree: any) => any) => void;
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
  // TODO: Update useMessageEditing to work with TaskTree instead of AssembledDDT
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
    currentDDT: null as any, // TODO: Remove when useMessageEditing is updated
    onUpdateDDT: onUpdateTaskTree as any // TODO: Update when useMessageEditing is updated
  });

  // Connect to backend via SSE
  // ❌ CRITICAL: NO frontend dialogue logic - ALL messages come from backend via SSE
  // If backend is not reachable, NO messages should be shown, NO dialogue should start
  React.useEffect(() => {
    if (!task || !projectId || !task.id) {
      // Clear messages when task is not available - NO frontend logic
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

    const baseUrl = 'http://localhost:5000'; // ✅ VB.NET backend diretto

    const startSession = async () => {
      try {
        setBackendError(null);
        const translationsData = translations || {};

        // ✅ CRITICAL: TaskTree è OBBLIGATORIO - non inviare solo taskId
        if (!taskTree) {
          throw new Error('[DDEBubbleChat] TaskTree is required. Cannot start session without complete instance.');
        }

        // ✅ NUOVO MODELLO: Invia TaskTree completo (working copy) invece di solo taskId
        // L'istanza in memoria è la fonte di verità, non il database
        // ✅ CRITICAL: Steps è già dictionary: { "templateId": { "start": {...}, "noMatch": {...} } }
        // Il backend VB.NET si aspetta questa struttura (stessa del database)
        const stepsDict = taskTree.steps && typeof taskTree.steps === 'object' && !Array.isArray(taskTree.steps)
          ? taskTree.steps
          : {};  // ✅ Se non è dictionary, usa vuoto (legacy format)

        const requestBody = {
          taskId: task.id,  // Mantieni per compatibilità/identificazione
          projectId: projectId,
          translations: translationsData,
          taskTree: {
            ...taskTree,
            steps: stepsDict  // ✅ Dictionary: { "templateId": { "start": {...}, "noMatch": {...} } }
          }
        };
        console.log('[DDEBubbleChat] 📤 Sending request to backend with TaskTree:', {
          url: `${baseUrl}/api/runtime/task/session/start`,
          method: 'POST',
          taskId: task.id,
          hasTaskTree: !!taskTree,
          taskTreeNodesCount: taskTree?.nodes?.length || 0,
          // ✅ NUOVO: Mostra chiavi del dictionary invece di count array
          taskTreeStepsType: typeof taskTree?.steps,
          taskTreeStepsIsDictionary: taskTree?.steps && typeof taskTree.steps === 'object' && !Array.isArray(taskTree.steps),
          taskTreeStepsKeys: taskTree?.steps && typeof taskTree.steps === 'object' && !Array.isArray(taskTree.steps)
            ? Object.keys(taskTree.steps)
            : [],
          taskTreeStepsCount: taskTree?.steps && typeof taskTree.steps === 'object' && !Array.isArray(taskTree.steps)
            ? Object.keys(taskTree.steps).length
            : 0,
          stepsDictKeys: stepsDict && typeof stepsDict === 'object' && !Array.isArray(stepsDict)
            ? Object.keys(stepsDict)
            : [],
          stepsDictPreview: stepsDict && typeof stepsDict === 'object' && !Array.isArray(stepsDict)
            ? Object.entries(stepsDict).slice(0, 2).map(([templateId, nodeSteps]) => ({
                templateId,
                stepTypes: typeof nodeSteps === 'object' && !Array.isArray(nodeSteps) ? Object.keys(nodeSteps) : []
              }))
            : [],
          bodyString: JSON.stringify(requestBody).substring(0, 500) + '...'
        });

        const startResponse = await fetch(`${baseUrl}/api/runtime/task/session/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        });

        console.log('[DDEBubbleChat] 📥 Response received:', {
          status: startResponse.status,
          statusText: startResponse.statusText,
          ok: startResponse.ok,
          headers: Object.fromEntries(startResponse.headers.entries()),
          url: startResponse.url
        });

        if (!startResponse.ok) {
          const errorText = await startResponse.text();
          console.error('[DDEBubbleChat] ❌ Error response:', {
            status: startResponse.status,
            statusText: startResponse.statusText,
            body: errorText,
            bodyLength: errorText.length,
            bodyPreview: errorText.substring(0, 200)
          });
          // Clear any existing messages when backend is not available
          setMessages([]);
          throw new Error(`Backend server not available: ${startResponse.statusText} - ${errorText}`);
        }

        // ✅ Verifica che la risposta abbia contenuto prima di fare parsing JSON
        const responseText = await startResponse.text();
        console.log('[DDEBubbleChat] 📥 Response text:', {
          length: responseText.length,
          isEmpty: !responseText || responseText.trim().length === 0,
          preview: responseText.substring(0, 200),
          fullText: responseText
        });

        if (!responseText || responseText.trim().length === 0) {
          console.error('[DDEBubbleChat] ❌ EMPTY RESPONSE DETECTED', {
            status: startResponse.status,
            statusText: startResponse.statusText,
            headers: Object.fromEntries(startResponse.headers.entries()),
            url: startResponse.url,
            contentType: startResponse.headers.get('content-type'),
            contentLength: startResponse.headers.get('content-length')
          });
          throw new Error('Backend returned empty response');
        }

        let responseData: any;
        try {
          responseData = JSON.parse(responseText);
        } catch (parseError) {
          console.error('[DDEBubbleChat] Failed to parse JSON response:', parseError);
          console.error('[DDEBubbleChat] Response text:', responseText);
          throw new Error(`Failed to parse backend response: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
        }

        const { sessionId: newSessionId } = responseData;
        setSessionId(newSessionId);
        console.log('[DDEBubbleChat] ✅ Backend session created:', { sessionId: newSessionId });

        // ✅ NUOVO: SSE stream diretto da VB.NET backend
        console.log('[DDEBubbleChat] Opening SSE stream:', `${baseUrl}/api/runtime/task/session/${newSessionId}/stream`);
        const eventSource = new EventSource(`${baseUrl}/api/runtime/task/session/${newSessionId}/stream`);
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
        const baseUrl = 'http://localhost:5000';
        fetch(`${baseUrl}/api/runtime/task/session/${sessionId}`, {
          method: 'DELETE'
        }).catch(() => { });
      }
    };
  }, [task?.id, projectId, translations]);

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

      // ✅ NUOVO: Send input to backend VB.NET direttamente
      const baseUrl = 'http://localhost:5000';
      const response = await fetch(`${baseUrl}/api/runtime/task/session/${sessionId}/input`, {
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

  // Reset function - restart session with same task
  const handleReset = () => {
    if (sessionId) {
      const baseUrl = 'http://localhost:5000';
      fetch(`${baseUrl}/api/runtime/task/session/${sessionId}`, {
        method: 'DELETE'
      }).catch(() => { });
    }
    setMessages([]);
    messageIdCounter.current = 0;
    setBackendError(null);
    setIsWaitingForInput(false);
    sentTextRef.current = '';
    setSessionId(null);

    // Session will be restarted automatically by useEffect when sessionId becomes null
  };

  return (
    <div className={`h-full flex flex-col bg-white ${combinedClass}`}>
      <div className="border-b p-3 bg-gray-50 flex items-center gap-2">
        <button
          onClick={handleReset}
          className={`px-2 py-1 rounded border bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200 ${combinedClass}`}
          title="Reset the chat session"
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
          <style dangerouslySetInnerHTML={{
            __html: `
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
