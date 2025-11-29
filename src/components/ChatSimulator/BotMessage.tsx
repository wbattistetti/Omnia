import React from 'react';
import { Check, X as XIcon, Pencil, AlertTriangle, AlertCircle, Bot } from 'lucide-react';
import { getStepIcon } from './chatSimulatorUtils';
import type { Message } from './UserMessage';

interface BotMessageProps {
  message: Message;
  editingId: string | null;
  draftText: string;
  hoveredId: string | null;
  onEdit: (id: string, text: string) => void;
  onSave: (id: string, text: string) => void;
  onCancel: () => void;
  onHover: (id: string | null) => void;
}

const BotMessage: React.FC<BotMessageProps> = ({
  message,
  editingId,
  draftText,
  hoveredId,
  onEdit,
  onSave,
  onCancel,
  onHover
}) => {
  const isEditing = editingId === message.id;

  // Debug: log warning message
  if (message.warningMessage) {
    console.log('[BotMessage] ⚠️ Rendering message with warning:', {
      id: message.id,
      text: message.text,
      warningMessage: message.warningMessage,
      hasWarningMessage: !!message.warningMessage
    });
  }

  return (
    <div className="flex flex-col items-start">
      <div className="flex flex-row items-start gap-2 w-full flex-wrap">
        <div
          className="bg-gray-100 border border-gray-200 relative max-w-sm lg:max-w-lg xl:max-w-xl px-4 py-2 rounded-lg shadow-md"
          style={{ width: 'fit-content', maxWidth: '100%' }}
          onMouseEnter={() => onHover(message.id)}
          onMouseLeave={() => onHover(null)}
        >
          {isEditing ? (
            <div className="flex items-center gap-2">
              <input
                autoFocus
                className="w-full px-2 py-1 border rounded text-sm"
                value={draftText}
                onChange={(e) => onEdit(message.id, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    onSave(message.id, draftText);
                  } else if (e.key === 'Escape') {
                    onCancel();
                  }
                }}
                onBlur={() => {
                  onSave(message.id, draftText);
                }}
              />
              <button className="p-1 text-green-600" title="Save" onMouseDown={(e) => e.preventDefault()} onClick={() => onSave(message.id, draftText)}>
                <Check size={16} />
              </button>
              <button className="p-1 text-red-600" title="Cancel" onMouseDown={(e) => e.preventDefault()} onClick={onCancel}>
                <XIcon size={16} />
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-start gap-2">
                {/* Bot icon inside bubble */}
                <div className="flex-shrink-0 mt-0.5">
                  <Bot size={18} className="text-gray-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-2 flex-wrap">
                    <div
                      className="flex-1 min-w-0 text-sm cursor-pointer whitespace-normal break-words"
                      title={message.textKey ? 'Click to edit' : undefined}
                      onClick={() => {
                        if (message.textKey) {
                          onEdit(message.id, message.text);
                        }
                      }}
                    >
                      {message.warningMessage ? '' : message.text}
                    </div>
                    {/* Step icon on the right */}
                    {message.stepType && (
                      <div className="flex items-center gap-1 flex-shrink-0 mt-0.5" style={{ color: message.color }}>
                        {message.escalationNumber !== undefined && message.escalationNumber > 0 && (
                          <span className="text-xs font-medium" style={{ color: message.color }}>
                            {message.escalationNumber}°
                          </span>
                        )}
                        {getStepIcon(message.stepType, message.color)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              {message.textKey && hoveredId === message.id && (
                <button className="absolute -top-2 -right-2 bg-white border border-gray-300 rounded-full p-1 shadow-sm" title="Edit" onClick={() => onEdit(message.id, message.text)}>
                  <Pencil size={14} />
                </button>
              )}
            </>
          )}
        </div>
        {/* Warning incorporato */}
        {message.warningMessage && (
          <div className="flex items-center gap-2 text-xs text-yellow-700 flex-shrink-0 whitespace-nowrap">
            <AlertTriangle size={12} className="flex-shrink-0 text-yellow-600" />
            <span>{message.warningMessage}</span>
          </div>
        )}
        {/* Error incorporato (per futuri utilizzi) */}
        {message.errorMessage && (
          <div className="flex items-center gap-2 text-xs text-red-700 flex-shrink-0 whitespace-nowrap">
            <AlertCircle size={12} className="flex-shrink-0 text-red-600" />
            <span>{message.errorMessage}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default BotMessage;

