import React from 'react';
import { Check, X as XIcon, CheckCircle, AlertCircle, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';


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
              <div className="flex items-start gap-2">
                {message.matchStatus && (
                  <div className="mt-0.5 flex-shrink-0">
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
                {/* Chevron per espandere i valori estratti - mostra SOLO se ci sono valori estratti dal parsing */}
                {hasExtractedValues && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsExpanded(!isExpanded);
                    }}
                    className="flex-shrink-0 mt-0.5 p-1 hover:bg-gray-200 rounded transition-colors"
                    title={isExpanded ? "Nascondi valori estratti" : "Mostra valori estratti"}
                    style={{ minWidth: '20px', minHeight: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    {isExpanded ? (
                      <ChevronUp size={16} className="text-gray-700" />
                    ) : (
                      <ChevronDown size={16} className="text-gray-700" />
                    )}
                  </button>
                )}
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

      {/* Pannello espandibile con valori estratti */}
      {isExpanded && (
        <div className="ml-6 mt-1 bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs max-w-xs lg:max-w-md">
          {hasExtractedValues ? (
            <>
              <div className="font-semibold text-gray-700 mb-2">Valori estratti:</div>
              <div className="space-y-1">
                {message.extractedValues!.map((ev, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-gray-600">
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
            </>
          ) : (
            <div className="text-gray-500 italic">Nessun valore estratto disponibile</div>
          )}
        </div>
      )}
    </div>
  );
};

export default UserMessage;

