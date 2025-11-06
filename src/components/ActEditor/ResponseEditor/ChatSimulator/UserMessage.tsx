import React from 'react';
import { Check, X as XIcon, CheckCircle, AlertCircle, AlertTriangle } from 'lucide-react';
import { useFontContext } from '../../../../context/FontContext';

export interface Message {
  id: string;
  type: 'bot' | 'user' | 'system';
  text: string;
  stepType?: string;
  textKey?: string;
  escalationNumber?: number;
  matchStatus?: 'match' | 'noMatch' | 'partialMatch';
  warningMessage?: string;
  errorMessage?: string;
  color?: string;
}

interface UserMessageProps {
  message: Message;
  editingId: string | null;
  draftText: string;
  onEdit: (id: string, text: string) => void;
  onSave: (id: string, text: string) => void;
  onCancel: () => void;
  onHover: (id: string | null) => void;
}

const UserMessage: React.FC<UserMessageProps> = ({
  message,
  editingId,
  draftText,
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
    <div className={`flex flex-row items-start gap-2 w-full flex-wrap ${combinedClass}`}>
      <div
        className={`${message.matchStatus === 'noMatch'
          ? 'bg-red-50 border border-red-300 text-red-900'
          : message.matchStatus === 'partialMatch'
            ? 'bg-orange-50 border border-orange-300 text-orange-900'
            : 'bg-purple-50 border border-purple-300 text-purple-900'
          } relative max-w-xs lg:max-w-md px-4 py-2 rounded-lg flex-shrink-0 ${combinedClass}`}
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
              {message.matchStatus && (
                <div className={`mt-0.5 flex-shrink-0 ${combinedClass}`}>
                  {message.matchStatus === 'match' && (
                    <CheckCircle size={16} className="text-green-600" />
                  )}
                  {message.matchStatus === 'noMatch' && (
                    <AlertCircle size={16} className="text-red-600" />
                  )}
                  {message.matchStatus === 'partialMatch' && (
                    <AlertCircle size={16} className="text-orange-600" />
                  )}
                </div>
              )}
              <div
                className={`flex-1 ${message.matchStatus === 'noMatch' ? 'text-red-700 font-medium' : ''} ${combinedClass}`}
                style={fontStyle}
              >
                {message.text}
              </div>
            </div>
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
  );
};

export default UserMessage;

