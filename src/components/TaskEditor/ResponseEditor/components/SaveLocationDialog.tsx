// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import React, { useState, useLayoutEffect, useRef } from 'react';

interface SaveLocationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveToFactory: () => void;
  onSaveToProject: () => void;
  onCancel: () => void;
  originalLabel: string;
  generalizedLabel: string | null;
  generalizationReason: string | null;
  generalizedMessages: string[] | null;
  anchorRef?: React.RefObject<HTMLElement> | null;
}

/**
 * Popover component for choosing where to save a generalizable template
 *
 * Shows when shouldBeGeneral === true and user hasn't made a decision yet
 * Positioned as a popover below the "Vuoi salvare in libreria?" button
 */
export function SaveLocationDialog({
  isOpen,
  onClose,
  onSaveToFactory,
  onSaveToProject,
  onCancel,
  originalLabel,
  generalizedLabel,
  generalizationReason,
  generalizedMessages,
  anchorRef,
  toolbarButtons // ✅ 2. Aggiunto per dipendenza del layout effect
}: SaveLocationDialogProps) {
  const [showMessages, setShowMessages] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  // Calculate position based on anchor element
  // ✅ 1. SOSTITUITO useEffect con useLayoutEffect per garantire che il DOM sia montato
  useLayoutEffect(() => {
    if (!isOpen) {
      setPosition(null);
      return;
    }

    const updatePosition = () => {
      // Try to get button from anchorRef first
      let anchorElement: HTMLElement | null = null;

      if (anchorRef?.current) {
        anchorElement = anchorRef.current;
      } else {
        // Fallback: find button by data attribute (should not be needed, but keep as safety)
        anchorElement = document.querySelector('[data-button-id="save-to-library"]') as HTMLElement;
      }

      if (!anchorElement) {
        setPosition(null);
        return;
      }

      const anchorRect = anchorElement.getBoundingClientRect();
      const popoverWidth = 400;
      const popoverHeight = 300;
      const spacing = 8;

      // Position below the button, aligned to the right edge
      let top = anchorRect.bottom + spacing;
      let left = anchorRect.right - popoverWidth;

      // Ensure popover stays within viewport
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      // Adjust horizontally if needed
      if (left < 10) {
        left = 10;
      } else if (left + popoverWidth > viewportWidth - 10) {
        left = viewportWidth - popoverWidth - 10;
      }

      // Adjust vertically if not enough space below
      if (top + popoverHeight > viewportHeight - 10) {
        top = anchorRect.top - popoverHeight - spacing;
        if (top < 10) {
          top = 10;
        }
      }

      setPosition({ top, left });
    };

    // ✅ 3. RIMOSSI tutti i setTimeout - chiamata diretta
    updatePosition();

    // Update on scroll/resize
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);

    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [isOpen, anchorRef, toolbarButtons]); // ✅ 2. Aggiunto toolbarButtons come dipendenza per ricalcolare quando la toolbar viene sincronizzata nel dock

  // ✅ REMOVED: Debug log che causa loop infinito

  if (!isOpen) {
    return null;
  }

  // ✅ NON mostriamo il popover se la posizione non è pronta (il pulsante deve essere trovato)
  if (!position) {
    return null; // ✅ Non mostriamo nulla finché il pulsante non viene trovato
  }

  const handleShowMessagesClick = () => {
    setShowMessages(!showMessages);
  };

  return (
    <>
      {/* Backdrop - only for click outside detection, not fullscreen */}
      <div
        className="fixed inset-0 z-40"
        onClick={(e) => {
          // Close on backdrop click, but allow clicks inside popover
          if (e.target === e.currentTarget) {
            onCancel();
          }
        }}
        style={{ pointerEvents: isOpen ? 'auto' : 'none' }}
      />

      {/* Popover positioned below button */}
      <div
        ref={popoverRef}
        className="fixed z-50 bg-white rounded-lg shadow-xl border border-gray-200"
        style={{
          top: `${position.top}px`,
          left: `${position.left}px`,
          width: '400px',
          maxHeight: '500px',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 flex-1 overflow-y-auto">
          {/* ✅ REMOVED: Titolo ridondante "Vuoi salvare in libreria?" */}

          <p className="text-sm text-gray-700 mb-2">
            "<span className="font-semibold">{originalLabel}</span>" può essere generalizzato per contesti diversi.
            <br />
            Consiglio di salvarla nella libreria generale.
            <br />
            <span
              onClick={handleShowMessagesClick}
              className="text-blue-600 hover:text-blue-800 cursor-pointer underline"
            >
              Vuoi vedere come generalizzerei i messaggi? (puoi ovviamente modificarli)
            </span>
          </p>

          {/* ✅ Lista messaggi generalizzati - appare solo dopo click */}
          {showMessages && generalizedMessages && generalizedMessages.length > 0 && (
            <div className="mt-4 p-3 bg-gray-50 rounded border border-gray-200 max-h-48 overflow-y-auto">
              <p className="text-xs font-semibold text-gray-700 mb-2">Messaggi generalizzati:</p>
              <ul className="list-disc list-inside space-y-1">
                {generalizedMessages.map((msg, idx) => (
                  <li key={idx} className="text-xs text-gray-600">
                    {msg}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="flex gap-2 justify-end p-4 border-t border-gray-200">
          <button
            onClick={() => {
              onSaveToProject();
              onClose();
            }}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors text-sm"
          >
            Salva nel progetto
          </button>
          <button
            onClick={() => {
              onSaveToFactory();
              onClose();
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm"
          >
            Salva nella libreria generale
          </button>
          <button
            onClick={() => {
              onCancel();
            }}
            className="px-4 py-2 bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors text-sm"
          >
            Annulla
          </button>
        </div>
      </div>
    </>
  );
}
