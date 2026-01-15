import React, { useState, useRef, useEffect } from 'react';
import { Target } from 'lucide-react';
import { useIntentStore } from '../../state/intentStore';

interface MoveToIntentDropdownProps {
  phraseId: string;
  phraseText: string;
  currentIntentId: string;
  onMove: (targetIntentId: string) => void;
}

/**
 * Dropdown component to move test phrase to training set of selected intent
 * Enterprise-ready: Clean, accessible, performant
 */
export default function MoveToIntentDropdown({
  phraseId,
  phraseText,
  currentIntentId,
  onMove
}: MoveToIntentDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const intents = useIntentStore(s => s.intents || []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleIntentClick = (targetIntentId: string) => {
    onMove(targetIntentId);
    setIsOpen(false);
  };

  return (
    <div className="relative shrink-0" ref={dropdownRef}>
      {/* Target icon button */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="p-1 rounded hover:bg-gray-100 transition-colors"
        title="Sposta a training set"
      >
        <Target size={14} className="text-blue-600 hover:text-blue-700" />
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
          <div className="py-1">
            {intents.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-500">
                Nessun intent disponibile
              </div>
            ) : (
              intents.map((intent) => (
                <button
                  key={intent.id}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleIntentClick(intent.id);
                  }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 transition-colors ${
                    intent.id === currentIntentId ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{intent.name}</span>
                    {intent.id === currentIntentId && (
                      <span className="text-xs text-blue-600">(corrente)</span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
