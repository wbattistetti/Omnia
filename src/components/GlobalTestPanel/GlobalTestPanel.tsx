// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import React from 'react';
import { X } from 'lucide-react';
import { useGlobalTestPanel } from '@context/GlobalTestPanelContext';
import DDEBubbleChat from '@responseEditor/ChatSimulator/DDEBubbleChat';
import { FontProvider } from '@context/FontContext';

export function GlobalTestPanel() {
  const { isOpen, context, close } = useGlobalTestPanel();

  React.useEffect(() => {
    console.log('[GlobalTestPanel] State changed:', { isOpen, contextType: context?.type });
  }, [isOpen, context]);

  if (!isOpen) {
    return null;
  }

  if (!context) {
    console.warn('[GlobalTestPanel] Panel is open but context is null');
    return null;
  }

  return (
    <div
      className={`
        fixed top-0 right-0 h-full z-50 transition-transform duration-300
        bg-white shadow-lg border-l
        translate-x-0
        w-[400px] max-w-[90vw]
      `}
      style={{ boxShadow: '0 0 16px rgba(0,0,0,0.1)' }}
    >
      {/* Header */}
      <div className="absolute top-0 left-0 w-full flex items-center justify-center h-12 border-b bg-gray-50 z-10">
        <button
          className="absolute left-3 text-gray-500 hover:text-gray-800 transition-colors"
          onClick={close}
          aria-label="Close test panel"
        >
          <X className="w-5 h-5" />
        </button>
        <span className="font-bold text-center flex-1 text-gray-800">Test Panel</span>
      </div>

      {/* Content */}
      <div className="pt-12 h-full overflow-hidden flex flex-col">
        {context?.type === 'task' && (
          <FontProvider>
            <DDEBubbleChat
              task={context.task}
              projectId={context.projectId}
              translations={context.translations}
              taskTree={context.taskTree}
              onUpdateTaskTree={() => {}}
              mode="interactive"
            />
          </FontProvider>
        )}
        {context?.type === 'flowchart' && (
          <div className="flex items-center justify-center h-full text-gray-500">
            Flowchart test mode - Coming soon
          </div>
        )}
      </div>
    </div>
  );
}
