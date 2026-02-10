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
  anchorRef
}: SaveLocationDialogProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  // Calculate position based on anchor element
  // ✅ 1. SOSTITUITO useEffect con useLayoutEffect per garantire che il DOM sia montato
  useLayoutEffect(() => {
    if (!isOpen) {
      setPosition(null);
      return;
    }

    console.log('[SaveLocationDialog] 🔍 POPOVER OPENING - useLayoutEffect triggered', {
      isOpen,
      hasAnchorRef: !!anchorRef,
      anchorRefCurrent: anchorRef?.current,
      anchorRefTagName: anchorRef?.current?.tagName,
      anchorRefDataId: anchorRef?.current?.getAttribute('data-button-id')
    });

    const updatePosition = () => {
      // Try to get button from anchorRef first
      let anchorElement: HTMLElement | null = null;

      if (anchorRef?.current) {
        anchorElement = anchorRef.current;
        console.log('[SaveLocationDialog] ✅✅✅ FOUND BUTTON via anchorRef.current', {
          tagName: anchorElement.tagName,
          dataButtonId: anchorElement.getAttribute('data-button-id'),
          rect: anchorElement.getBoundingClientRect()
        });
      } else {
        console.log('[SaveLocationDialog] ⚠️ anchorRef.current is NULL, trying querySelector fallback');
        // Fallback: find button by data attribute (should not be needed, but keep as safety)
        anchorElement = document.querySelector('[data-button-id="save-to-library"]') as HTMLElement;
        if (anchorElement) {
          console.log('[SaveLocationDialog] ✅ Found via querySelector fallback', {
            tagName: anchorElement.tagName,
            rect: anchorElement.getBoundingClientRect()
          });
        } else {
          console.log('[SaveLocationDialog] ❌ querySelector ALSO FAILED - NO BUTTON FOUND');
        }
      }

      if (!anchorElement) {
        console.log('[SaveLocationDialog] ❌❌❌ CRITICAL: NO ANCHOR ELEMENT - Cannot position popover');
        setPosition(null);
        return;
      }

      const anchorRect = anchorElement.getBoundingClientRect();
      const popoverWidth = 400;
      // Calculate dynamic height based on content (messages list)
      const hasMessages = generalizedMessages && generalizedMessages.length > 0;
      const estimatedPopoverHeight = hasMessages ? Math.min(500, 200 + (generalizedMessages.length * 30)) : 200;
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
      if (top + estimatedPopoverHeight > viewportHeight - 10) {
        top = anchorRect.top - estimatedPopoverHeight - spacing;
        if (top < 10) {
          top = 10;
        }
      }

      console.log('[SaveLocationDialog] ✅ Position calculated:', { top, left });
      setPosition({ top, left });
    };

    updatePosition();

    // Update on scroll/resize
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);

    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [isOpen, anchorRef]); // ✅ RIMOSSO toolbarButtons e generalizedMessages - causavano loop infinito

  // ✅ Log quando position è null (solo quando cambia isOpen o position)
  React.useEffect(() => {
    if (isOpen && !position) {
      console.log('[SaveLocationDialog] ❌ BLOCKED: position is null - button not found!', {
        hasAnchorRef: !!anchorRef,
        anchorRefCurrent: anchorRef?.current,
        querySelectorResult: document.querySelector('[data-button-id="save-to-library"]')
      });
    }
  }, [isOpen, position, anchorRef]);

  if (!isOpen) {
    return null;
  }

  // ✅ NON mostriamo il popover se la posizione non è pronta (il pulsante deve essere trovato)
  if (!position) {
    return null; // ✅ Non mostriamo nulla finché il pulsante non viene trovato
  }


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

          <p className="text-sm text-gray-700 mb-3">
            "<span className="font-semibold">{originalLabel}</span>" può essere generalizzato per contesti diversi.
            <br />
            Consiglio di salvarla nella libreria generale.
          </p>

          {/* ✅ Lista messaggi generalizzati - sempre visibile quando ci sono messaggi */}
          {generalizedMessages && generalizedMessages.length > 0 && (
            <div className="mt-3 p-3 bg-gray-50 rounded border border-gray-200 max-h-48 overflow-y-auto">
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
