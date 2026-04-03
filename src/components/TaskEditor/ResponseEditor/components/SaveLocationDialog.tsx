// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import React, { useState, useLayoutEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { useResponseEditorContext } from '@responseEditor/context/ResponseEditorContext';
import { useWizardContext } from '@responseEditor/context/WizardContext';

interface SaveLocationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveToFactory: () => void;
  onCancel: () => void;
  anchorRef?: React.RefObject<HTMLElement> | null;
  isSaving?: boolean; // ✅ NEW: State for saving operation
  responseEditorRef?: React.RefObject<HTMLElement> | null; // ✅ NEW: Ref to ResponseEditor container for positioning
}

/**
 * Popover to save the current template to the global Factory library.
 * Opened from the toolbar; primary action delegates to the parent `onSaveToFactory` (handleSaveToFactory).
 */
export function SaveLocationDialog({
  isOpen,
  onClose,
  onSaveToFactory,
  onCancel,
  anchorRef,
  isSaving = false, // ✅ NEW: Default to false
  responseEditorRef // ✅ NEW: Ref to ResponseEditor container
}: SaveLocationDialogProps) {
  // ✅ ARCHITECTURE: Read from contexts (single source of truth)
  const { taskLabel } = useResponseEditorContext();
  const wizardContext = useWizardContext();
  const generalizedMessages = wizardContext?.generalizedMessages ?? null;
  const popoverRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  // ✅ NEW: State to show/hide messages list
  const [showMessages, setShowMessages] = useState(false);

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
        anchorElement = document.querySelector('[data-button-id="save-to-library"]') as HTMLElement;
      }

      if (!anchorElement) {
        setPosition(null);
        return;
      }

      const anchorRect = anchorElement.getBoundingClientRect();
      const popoverWidth = 400;
      // Calculate dynamic height based on content (messages list)
      const hasMessages = generalizedMessages && generalizedMessages.length > 0;
      const estimatedPopoverHeight = hasMessages ? Math.min(500, 200 + (generalizedMessages.length * 30)) : 200;

      // ✅ FIX: Get ResponseEditor container bounds for positioning
      let responseEditorRight = window.innerWidth - 10; // Default to viewport right edge
      if (responseEditorRef?.current) {
        const editorRect = responseEditorRef.current.getBoundingClientRect();
        responseEditorRight = editorRect.right;
      }

      // ✅ FIX: Position popover:
      // - Top edge of popover = bottom edge of toolbar/button (no spacing)
      // - Right edge of popover = right edge of ResponseEditor
      let top = anchorRect.bottom; // ✅ No spacing - align top of popover with bottom of toolbar
      let left = responseEditorRight - popoverWidth; // ✅ Right edge of popover = right edge of ResponseEditor

      // Ensure popover stays within viewport
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      // Adjust horizontally if needed (should not happen if ResponseEditor is visible)
      if (left < 10) {
        left = 10;
      } else if (left + popoverWidth > viewportWidth - 10) {
        left = viewportWidth - popoverWidth - 10;
      }

      // Adjust vertically if not enough space below
      if (top + estimatedPopoverHeight > viewportHeight - 10) {
        top = anchorRect.top - estimatedPopoverHeight;
        if (top < 10) {
          top = 10;
        }
      }

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
  }, [isOpen, anchorRef, responseEditorRef, generalizedMessages]);

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
          {/* ✅ FIX: Testo introduttivo con link cliccabile */}
          <p className="text-sm text-gray-700 mb-3">
            "<span className="font-semibold">{taskLabel}</span>" può essere riutilizzato in contesti diversi.
            <br />
            Pubblicalo nella <span className="font-medium">Factory</span> (libreria globale) per renderlo disponibile a tutti i progetti.
            {generalizedMessages && generalizedMessages.length > 0 && (
              <>
                {' '}
                <button
                  type="button"
                  onClick={() => setShowMessages(!showMessages)}
                  className="text-blue-600 hover:text-blue-800 underline cursor-pointer font-medium"
                  style={{ background: 'none', border: 'none', padding: 0 }}
                >
                  {showMessages ? 'Nascondi messaggi suggeriti' : 'Mostra messaggi suggeriti dal wizard'}
                </button>
                .
              </>
            )}
          </p>

          {showMessages && generalizedMessages && generalizedMessages.length > 0 && (
            <div className="mt-3 p-3 bg-gray-50 rounded border border-gray-200 max-h-48 overflow-y-auto">
              <p className="text-xs font-semibold text-gray-700 mb-2">Messaggi suggeriti:</p>
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
            onClick={async () => {
              try {
                if (!onSaveToFactory) {
                  console.error('[SaveLocationDialog] onSaveToFactory is not defined');
                  return;
                }
                await onSaveToFactory();
              } catch (error) {
                console.error('[SaveLocationDialog] Error saving to factory:', error);
              }
            }}
            disabled={isSaving}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSaving ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Sto salvando...</span>
              </>
            ) : (
              <span>Pubblica in Factory</span>
            )}
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
