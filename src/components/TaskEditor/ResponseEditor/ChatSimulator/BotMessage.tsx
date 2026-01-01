import React from 'react';
import { Check, X as XIcon, Pencil, AlertTriangle, AlertCircle } from 'lucide-react';
import { getStepIcon } from './chatSimulatorUtils';
import type { Message } from '../../../ChatSimulator/UserMessage';
import { useFontContext } from '../../../../context/FontContext';

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
  const { combinedClass, fontType, fontSize } = useFontContext();

  // Map fontSize to actual pixel values
  const fontSizeMap: Record<string, string> = {
    xs: '10px',
    sm: '12px',
    base: '14px',
    md: '16px',
    lg: '18px',
  };

  const fontFamilyMap: Record<string, string> = {
    sans: 'Inter, system-ui, sans-serif',
    serif: 'Georgia, serif',
    mono: 'Monaco, Consolas, monospace',
  };

  const fontStyle = {
    fontFamily: fontFamilyMap[fontType],
    fontSize: fontSizeMap[fontSize],
  };
  const isEditing = editingId === message.id;

  return (
    <div className={`flex flex-col items-start ${combinedClass}`}>
      <div className="flex flex-row items-start gap-2 w-full flex-wrap">
        <div
          className={`bg-gray-100 border border-gray-200 relative max-w-xs lg:max-w-md px-4 py-2 rounded-lg flex-shrink-0 ${combinedClass}`}
          onMouseEnter={() => onHover(message.id)}
          onMouseLeave={() => onHover(null)}
        >
          {isEditing ? (
            <div className="flex items-center gap-2">
              <input
                autoFocus
                className={`w-full px-2 py-1 border rounded ${combinedClass}`}
                style={{
                  fontFamily: 'inherit',
                  fontSize: 'inherit'
                }}
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
              <div className={`flex items-start gap-2 ${combinedClass}`}>
                {message.stepType && (
                  <div className={`mt-0.5 flex items-center gap-1 ${combinedClass}`} style={{ color: message.color }}>
                    {message.escalationNumber !== undefined && message.escalationNumber > 0 && (
                      <span className={`font-medium ${combinedClass}`} style={{ color: message.color }}>
                        {message.escalationNumber}°
                      </span>
                    )}
                    {getStepIcon(message.stepType, message.color)}
                  </div>
                )}
                <div
                  className={`cursor-pointer flex-1 ${combinedClass}`}
                  title={message.textKey ? 'Click to edit' : undefined}
                  onClick={() => {
                    if (message.textKey) {
                      onEdit(message.id, message.text);
                    }
                  }}
                  style={fontStyle}
                >
                  {message.text}
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
          <div className={`flex items-center gap-2 text-yellow-700 flex-shrink-0 whitespace-nowrap ${combinedClass}`}>
            <AlertTriangle size={12} className="flex-shrink-0 text-yellow-600" />
            <span>{message.warningMessage}</span>
          </div>
        )}
        {/* Error incorporato (per futuri utilizzi) */}
        {message.errorMessage && (
          <div className={`flex items-center gap-2 text-red-700 flex-shrink-0 whitespace-nowrap ${combinedClass}`}>
            <AlertCircle size={12} className="flex-shrink-0 text-red-600" />
            <span>{message.errorMessage}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default BotMessage;

