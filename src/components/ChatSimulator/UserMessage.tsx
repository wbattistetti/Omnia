import React from 'react';
import { Check, X as XIcon, CheckCircle, AlertCircle, AlertTriangle, ChevronDown, ChevronUp, User } from 'lucide-react';


export interface ExtractedValue {
  variable: string; // Nome della variabile (es. "Day", "Month", "Year")
  linguisticValue?: string; // Valore linguistico originale (es. "febbraio", "12 febbraio 1980")
  semanticValue: any; // Valore semantico normalizzato (es. 12, 2, 1980)
}

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
  grammarMissing?: boolean; // Flag per indicare che manca la grammatica NLP
  extractedValues?: ExtractedValue[]; // Valori estratti dall'input
  engineType?: 'new' | 'old'; // Track which engine generated this message
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
  // FontContext is optional - use defaults if not available
  // This allows UserMessage to work both in Response Editor (with FontContext) and Flow Orchestrator (without)
  const combinedClass = '';
  const fontType: 'sans' | 'serif' | 'mono' = 'sans';
  const fontSize: 'xs' | 'sm' | 'base' | 'md' | 'lg' = 'base';

  const isEditing = editingId === message.id;
  const [isExpanded, setIsExpanded] = React.useState(false);
  const hasExtractedValues = message.extractedValues && message.extractedValues.length > 0;

  // Debug: log extracted values
  React.useEffect(() => {
    if (message.type === 'user') {
      console.log('[UserMessage] Message check:', {
        messageId: message.id,
        text: message.text,
        hasExtractedValues,
        extractedValues: message.extractedValues,
        extractedValuesLength: message.extractedValues?.length || 0
      });
    }
  }, [message.extractedValues, hasExtractedValues, message.id, message.type, message.text]);

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
    fontFamily: fontFamilyMap[fontType] || fontFamilyMap.sans,
    fontSize: fontSizeMap[fontSize] || fontSizeMap.base,
  };

  // Debug log per verificare se i valori estratti sono presenti
  React.useEffect(() => {
    if (message.type === 'user' && message.extractedValues) {
      console.log('[UserMessage] Extracted values:', {
        messageId: message.id,
        hasExtractedValues,
        extractedValues: message.extractedValues,
        count: message.extractedValues.length
      });
    }
  }, [message.extractedValues, hasExtractedValues, message.id, message.type]);

  // Helper per formattare i nomi delle variabili
  const formatVariableName = (key: string): string => {
    const mapping: Record<string, string> = {
      'day': 'Day',
      'month': 'Month',
      'year': 'Year',
      'firstname': 'First Name',
      'lastname': 'Last Name',
      'street': 'Street',
      'city': 'City',
      'postal_code': 'Postal Code',
      'zip': 'ZIP',
      'country': 'Country'
    };
    return mapping[key.toLowerCase()] || key.charAt(0).toUpperCase() + key.slice(1);
  };

  return (
    <div className={`flex flex-col gap-2 w-full ${combinedClass}`}>
      <div className="flex flex-row items-start gap-2 w-full flex-wrap">
        <div
          className={`${message.matchStatus === 'noMatch'
            ? 'bg-red-50 border border-red-300 text-red-900'
            : message.matchStatus === 'partialMatch'
              ? 'bg-orange-50 border border-orange-300 text-orange-900'
              : 'bg-purple-50 border border-purple-300 text-purple-900'
            } relative max-w-sm lg:max-w-lg xl:max-w-xl px-4 py-2 rounded-lg shadow-md ${combinedClass}`}
          style={{ width: 'fit-content', maxWidth: '100%' }}
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
              <div className="flex items-start gap-2">
                {/* User icon inside bubble */}
                <div className="flex-shrink-0 mt-0.5">
                  <User size={18} className="text-gray-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-2 flex-wrap">
                    {message.matchStatus && (
                      <div className="flex-shrink-0 mt-0.5">
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
                      className={`flex-1 min-w-0 whitespace-normal break-words ${message.matchStatus === 'noMatch' ? 'text-red-700 font-medium' : ''} ${combinedClass}`}
                      style={fontStyle}
                    >
                      {message.text}
                    </div>
                    {/* Chevron per espandere i valori estratti - dentro la bubble, a destra, piccola e allineata in alto */}
                    {hasExtractedValues && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsExpanded(!isExpanded);
                        }}
                        className="flex-shrink-0 mt-0.5 p-1 hover:bg-gray-200/50 rounded transition-colors"
                        title={isExpanded ? "Nascondi valori estratti" : "Mostra valori estratti"}
                      >
                        {isExpanded ? (
                          <ChevronUp size={14} className="text-gray-600" />
                        ) : (
                          <ChevronDown size={14} className="text-gray-600" />
                        )}
                      </button>
                    )}
                  </div>
                  {/* Valori estratti dentro la bubble */}
                  {isExpanded && hasExtractedValues && (
                    <div className="mt-2 pt-2 border-t border-gray-300/50">
                      <div className="text-xs font-semibold text-gray-700 mb-1.5">Valori estratti:</div>
                      <div className="space-y-1">
                        {message.extractedValues!.map((ev, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-xs text-gray-600">
                            <span className="font-medium text-gray-700">{formatVariableName(ev.variable)}:</span>
                            {ev.linguisticValue ? (
                              <>
                                <span className="italic">&quot;{ev.linguisticValue}&quot;</span>
                                <span className="text-gray-400">→</span>
                              </>
                            ) : null}
                            <span className="font-mono text-gray-800">{String(ev.semanticValue)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
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
        {/* Grammar missing badge - piccolo payoff a lato del bubble */}
        {message.grammarMissing && (
          <div className={`flex items-center gap-1 text-orange-600 flex-shrink-0 whitespace-nowrap ${combinedClass}`}>
            <AlertTriangle size={10} className="flex-shrink-0" />
            <span className="font-medium">Grammar missing!</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserMessage;

