import React, { useState } from 'react';
import { useDDTManager } from '../../context/DDTManagerContext';
import BubbleBot from './BubbleBot';
import BubbleUser from './BubbleUser';
import BubbleInput from './BubbleInput';
import DebugPanel from './DebugPanel';
import DDTSimulatorPreview from './DDTSimulatorPreview';
import { useSimulator } from './useSimulator';

// Example DDT definition for date of birth
const ddt = {
  startStepId: 'askDOB',
  steps: {
    askDOB: {
      prompt: 'What is your date of birth?',
      expectedType: 'date',
      nextStepId: 'done',
    },
    done: {
      prompt: 'Thank you!',
    },
  },
};

const ChatSimulator: React.FC = () => {
  const { state, sendInput, reset } = useSimulator(ddt);
  const [showDebug, setShowDebug] = useState(false);
  const [useNewEngine, setUseNewEngine] = useState(true);
  const { selectedDDT } = useDDTManager();
  const [inputLoading, setInputLoading] = useState(false);

  // Handle sending user input asynchronously
  const handleSend = async (text: string) => {
    setInputLoading(true);
    await sendInput(text);
    setInputLoading(false);
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <button onClick={reset}>Reset</button>
        <button onClick={() => setShowDebug(d => !d)}>
          {showDebug ? 'Hide Debug' : 'Show Debug'}
        </button>
        <button onClick={() => setUseNewEngine(v => !v)}>
          {useNewEngine ? 'Use legacy engine' : 'Use new DialogueDataEngine'}
        </button>
      </div>
      {useNewEngine ? (
        <DDTSimulatorPreview currentDDT={selectedDDT as any} />
      ) : (
        <>
          <div className="chat-bubbles" style={{ minHeight: 200, border: '1px solid #eee', padding: 16, marginBottom: 8 }}>
            {state.history.map((event, idx) =>
              event.from === 'bot' ? (
                <BubbleBot key={idx} text={event.text} />
              ) : event.from === 'user' ? (
                <BubbleUser key={idx} text={event.text} />
              ) : (
                <div key={idx} className="system-message" style={{ color: '#b00', fontStyle: 'italic', margin: '8px 0' }}>{event.text}</div>
              )
            )}
          </div>
          <BubbleInput onSend={handleSend} disabled={inputLoading} />
          {showDebug && <DebugPanel state={state} />}
        </>
      )}
    </div>
  );
};

export default ChatSimulator;