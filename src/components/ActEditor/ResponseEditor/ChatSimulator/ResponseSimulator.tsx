import React, { useState, useRef, useEffect } from 'react';
import { Play, RotateCcw, Bot, Bug } from 'lucide-react';
import { ResponseFlowEngine, FlowState } from './ResponseFlowEngine';

interface ResponseSimulatorProps {
  ddt: any;
  translations?: any;
  selectedNode?: any;
  onClose?: () => void;
}

const ResponseSimulator: React.FC<ResponseSimulatorProps> = ({ 
  ddt, 
  translations, 
  selectedNode, 
  onClose 
}) => {
  const [flowState, setFlowState] = useState<FlowState | null>(null);
  const [engine] = useState(() => new ResponseFlowEngine(ddt, translations, selectedNode));
  const [showDebug, setShowDebug] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [flowState?.messages]);

  const handleStart = () => {
    const initialState = engine.start();
    setFlowState(initialState);
  };

  const handleReset = () => {
    setFlowState(null);
  };

  const handleUserInput = (input: string) => {
    if (!flowState) return;
    
    const newState = engine.processUserInput(flowState, input);
    setFlowState(newState);
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

  return (
    <div className="h-full flex flex-col bg-white border-l">
      {/* Header */}
      <div className="border-b p-3 bg-gray-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot size={16} className="text-purple-600" />
            <h3 className="font-semibold text-gray-800">Chat Simulator</h3>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowDebug(!showDebug)}
              className={`flex items-center gap-1 px-2 py-1 text-xs rounded border ${
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
                className="flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white rounded text-sm hover:bg-green-700 transition-colors"
              >
                <Play size={14} />
                Start
              </button>
            ) : (
              <button
                onClick={handleReset}
                className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition-colors"
              >
                <RotateCcw size={14} />
                Reset
              </button>
            )}
          </div>
        </div>
        
        {/* Status */}
        {flowState && (
          <div className="mt-2 text-xs text-gray-600">
            <div className="flex items-center gap-4">
              <span>
                <strong>Step:</strong> <code className="bg-gray-200 px-1 rounded">{flowState.currentStep}</code>
              </span>
              {flowState.escalationLevel > 1 && (
                <span>
                  <strong>Escalation:</strong> <code className="bg-yellow-200 px-1 rounded">{flowState.escalationLevel}</code>
                </span>
              )}
              {flowState.completed && (
                <span className="text-green-600 font-medium">✅ Completed</span>
              )}
            </div>
            <div className="mt-1">
              💡 <strong>Commands:</strong> Empty Enter = noInput • "xxxx" + Enter = noMatch • Other = normal flow
            </div>
          </div>
        )}
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {!flowState ? (
          <div className="text-center text-gray-500 mt-8">
            <Play size={48} className="mx-auto mb-4 text-gray-300" />
            <p className="text-lg font-medium">Ready to test dialogue flow</p>
            <p className="text-sm mt-2 text-gray-400">
              Press Start to begin simulation
            </p>
            <div className="mt-4 text-xs bg-gray-50 p-3 rounded border-l-4 border-gray-300">
              <p className="font-medium text-gray-700 mb-1">Test commands:</p>
              <p>• Empty Enter → triggers noInput escalation</p>
              <p>• "xxxx" + Enter → triggers noMatch escalation</p>
              <p>• Any other text → normal flow</p>
            </div>
            {showDebug && (
              <div className="mt-4 text-xs bg-orange-50 p-3 rounded border-l-4 border-orange-300">
                <p className="font-medium text-orange-700 mb-1">Debug info:</p>
                <p>DDT ID: {ddt?.id || ddt?.label || 'Unknown'}</p>
                <p>Has translations: {translations ? Object.keys(translations).length : 0} keys</p>
                <p>Selected node: {selectedNode?.label || 'Main data'}</p>
              </div>
            )}
          </div>
        ) : (
          <>
            {flowState.messages.map((message, index) => (
              <div key={message.id}>
                <div
                  className={`flex ${message.type === 'bot' ? 'justify-start' : 'justify-end'} mb-3`}
                >
                  <div
                    className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                      message.type === 'bot'
                        ? getStepColor(message.stepType)
                        : 'bg-purple-600 text-white'
                    }`}
                    style={{ minHeight: '40px' }}
                  >
                    <div className="flex items-start gap-2">
                      {message.type === 'bot' && <Bot size={16} className="mt-1 flex-shrink-0" />}
                      <div className="flex-1">
                        <p className="text-sm">{message.text || '[NO TEXT]'}</p>
                        {message.stepType && (
                          <span className="text-xs opacity-70 font-mono mt-1 block">
                            {message.stepType}
                            {message.escalationLevel && message.escalationLevel > 1 && ` #${message.escalationLevel}`}
                          </span>
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
        <div className="border-t p-4 bg-gray-50">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Type response or press Enter for noInput..."
              className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
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
        <div className="p-4 bg-green-50 border-t text-center text-green-800">
          🎉 Dialogue completed successfully!
        </div>
      )}
    </div>
  );
};

export default ResponseSimulator;