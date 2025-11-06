import React, { useState, useRef, useEffect } from 'react';
import { Play, RotateCcw, Bot, Bug } from 'lucide-react';
import { ResponseFlowEngine, FlowState } from './ResponseFlowEngine';
import { usePanelZoom } from '../../../../hooks/usePanelZoom';
import { useFontContext } from '../../../../context/FontContext';

interface ResponseSimulatorProps {
  ddt: any;
  translations?: any;
  selectedNode?: any;
}

const ResponseSimulator: React.FC<ResponseSimulatorProps> = ({
  ddt,
  translations,
  selectedNode
}) => {
  const { combinedClass, fontSize } = useFontContext();
  const [flowState, setFlowState] = useState<FlowState | null>(null);
  const [engine, setEngine] = useState(() => new ResponseFlowEngine(ddt, translations, selectedNode));
  const [showDebug, setShowDebug] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const logFocus = (where: string) => {
    try {
      const el = inputRef.current as any;
      const active = (document as any).activeElement;
      // eslint-disable-next-line no-console
      console.debug('[ChatSimulator][focus]', where, {
        hasEl: Boolean(el),
        activeIsInput: active === el,
        activeTag: active?.tagName,
        waitingForInput: Boolean(flowState?.waitingForInput),
        step: flowState?.currentStep,
      });
    } catch {}
  };
  const ensureFocus = React.useCallback((retries: number = 8) => {
    const attempt = (i: number) => {
      const el = inputRef.current;
      if (!el) return;
      try { el.focus({ preventScroll: true } as any); } catch {}
      logFocus(`attempt#${i}`);
      // If not focused yet, retry
      if (document.activeElement !== el && i < retries) {
        setTimeout(() => attempt(i + 1), 50);
      }
    };
    requestAnimationFrame(() => attempt(0));
  }, []);

  useEffect(() => {
    // Rebuild engine only when DDT or translations change. Preserve chat on sidebar selection changes.
    setEngine(new ResponseFlowEngine(ddt, translations, selectedNode));
    setFlowState(null);
  }, [ddt, translations]);

  useEffect(() => {
    // When only selectedNode changes, keep current conversation and just point the engine to the new node.
    engine.setSelectedNode?.(selectedNode);
  }, [selectedNode, engine]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [flowState?.messages]);

  const handleStart = () => {
    const initialState = engine.start();
    setFlowState(initialState);
    // Ensure input is focused when the first prompt appears
    logFocus('handleStart');
    setTimeout(() => ensureFocus(), 0);
  };

  const handleReset = () => {
    setFlowState(null);
  };

  const handleUserInput = (input: string) => {
    if (!flowState) return;
    const newState = engine.processUserInput(flowState, input);
    setFlowState(newState);
    // Keep focus ready for the next prompt
    logFocus('afterSend');
    setTimeout(() => ensureFocus(), 0);
  };

  const getStepColor = (stepType?: string) => {
    switch (stepType) {
      case 'start': return 'bg-blue-100 border border-blue-200';
      case 'noInput': return 'bg-gray-100 border border-gray-200';
      case 'noMatch': return 'bg-red-100 border border-red-200';
      case 'confirmation': return 'bg-yellow-100 border border-yellow-200';
      case 'success': return 'bg-green-100 border border-green-200';
      default: return 'bg-gray-100 border border-gray-200';
    }
  };

  const rootRef = useRef<HTMLDivElement | null>(null);
  const { ref: zoomRef, zoomStyle } = usePanelZoom<HTMLDivElement>(rootRef);

  // When the input box appears (waitingForInput), ensure it receives focus
  useEffect(() => {
    if (flowState && flowState.waitingForInput && !flowState.completed) {
      logFocus('effect-waiting');
      ensureFocus();
    }
  }, [flowState?.waitingForInput, flowState?.currentStep, flowState?.messages?.length, ensureFocus]);

  return (
    <div ref={zoomRef as any} className="h-full flex flex-col bg-white border-l" style={{ ...zoomStyle }}>
      {/* Header */}
      <div className="border-b p-3 bg-gray-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot size={16} className="text-purple-600" />
            <h3 className={`font-semibold text-gray-800 ${combinedClass}`}>Chat Simulator</h3>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowDebug(!showDebug)}
              className={`flex items-center gap-1 px-2 py-1 rounded border ${combinedClass} ${
                showDebug
                  ? 'bg-orange-100 border-orange-300 text-orange-800'
                  : 'bg-gray-100 border-gray-300 text-gray-600'
              }`}
              title="Toggle debug mode"
            >
              <Bug size={12} />
              Debug
            </button>
            {!flowState ? (
              <button
                onClick={handleStart}
                className={`flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 transition-colors ${combinedClass}`}
              >
                <Play size={14} />
                Start
              </button>
            ) : (
              <button
                onClick={handleReset}
                className={`flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors ${combinedClass}`}
              >
                <RotateCcw size={14} />
                Reset
              </button>
            )}
          </div>
        </div>
        {flowState && (
          <div className={`mt-2 text-gray-600 ${combinedClass}`}>
            <div className="flex items-center gap-4">
              <span className={combinedClass}>
                <strong>Step:</strong> <code className="bg-gray-200 px-1 rounded">{flowState.currentStep}</code>
              </span>
              {flowState.escalationLevel > 1 && (
                <span className={combinedClass}>
                  <strong>Escalation:</strong> <code className="bg-yellow-200 px-1 rounded">{flowState.escalationLevel}</code>
                </span>
              )}
              {flowState.completed && (
                <span className={`text-green-600 font-medium ${combinedClass}`}>✅ Completed</span>
              )}
            </div>
            <div className={`mt-1 ${combinedClass}`}>
              💡 <strong>Commands:</strong> Empty Enter = noInput • "xxxx" + Enter = noMatch • Other = normal flow
            </div>
          </div>
        )}
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {!flowState ? (
          <div className={`text-center text-gray-500 mt-8 ${combinedClass}`}>
            <Play size={48} className="mx-auto mb-4 text-gray-300" />
            <p className={`font-medium ${combinedClass}`}>Ready to test dialogue flow</p>
            <p className={`mt-2 text-gray-400 ${combinedClass}`}>Press Start to begin simulation</p>
          </div>
        ) : (
          <>
            {flowState.messages.map((message) => (
              <div key={message.id}>
                <div className={`flex ${message.type === 'bot' ? 'justify-start' : 'justify-end'} mb-3`}>
                  <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${message.type === 'bot' ? getStepColor(message.stepType) : 'bg-purple-600 text-white'}`} style={{ minHeight: '40px' }}>
                    <div className="flex items-start gap-2">
                      {message.type === 'bot' && <Bot size={16} className="mt-1 flex-shrink-0" />}
                      <div className="flex-1">
                        <p className={combinedClass}>{message.text || '[NO TEXT]'}</p>
                        {message.stepType && (
                          <span className={`opacity-70 font-mono mt-1 block ${combinedClass}`}>{message.stepType}{message.escalationLevel && message.escalationLevel > 1 && ` #${message.escalationLevel}`}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input Area */}
      {flowState && flowState.waitingForInput && !flowState.completed && (
        <div className={`border-t p-4 bg-gray-50 ${combinedClass}`} onMouseDown={() => ensureFocus()}>
          <style dangerouslySetInnerHTML={{__html: `
            .response-simulator-input-placeholder::placeholder {
              font-family: inherit !important;
              font-size: inherit !important;
            }
          `}} />
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Type response or press Enter for noInput..."
              className={`response-simulator-input-placeholder flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 ${combinedClass}`}
              style={{
                fontFamily: 'inherit',
                fontSize: 'inherit'
              }}
              ref={inputRef}
              onFocus={() => logFocus('input-onFocus')}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  const input = e.currentTarget.value;
                  handleUserInput(input);
                  e.currentTarget.value = '';
                }
              }}
              autoFocus
            />
          </div>
        </div>
      )}

      {flowState?.completed && (
        <div className={`p-4 bg-green-50 border-t text-center text-green-800 ${combinedClass}`}>🎉 Dialogue completed successfully!</div>
      )}
    </div>
  );
};

export default ResponseSimulator;