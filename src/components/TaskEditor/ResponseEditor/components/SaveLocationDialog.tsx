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
  onSaveToProject: () => void;
  onCancel: () => void;
  // ✅ REMOVED: originalLabel, generalizedLabel, generalizationReason, generalizedMessages - now from contexts
  anchorRef?: React.RefObject<HTMLElement> | null;
  isSaving?: boolean; // ✅ NEW: State for saving operation
  responseEditorRef?: React.RefObject<HTMLElement> | null; // ✅ NEW: Ref to ResponseEditor container for positioning
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
  // ✅ REMOVED: originalLabel, generalizedLabel, generalizationReason, generalizedMessages - now from contexts
  anchorRef,
  isSaving = false, // ✅ NEW: Default to false
  responseEditorRef // ✅ NEW: Ref to ResponseEditor container
}: SaveLocationDialogProps) {
  // ✅ REMOVED: Log rumoroso - verrà ripristinato se necessario durante refactoring

  // ✅ ARCHITECTURE: Read from contexts (single source of truth)
  const { taskLabel } = useResponseEditorContext();
  const wizardContext = useWizardContext();
  const generalizedLabel = wizardContext?.generalizedLabel ?? null;
  const generalizationReason = wizardContext?.generalizationReason ?? null;
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
  }, [isOpen, anchorRef, responseEditorRef]); // ✅ Added responseEditorRef dependency

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
          {/* ✅ FIX: Testo introduttivo con link cliccabile */}
          <p className="text-sm text-gray-700 mb-3">
            "<span className="font-semibold">{taskLabel}</span>" può essere generalizzato per contesti diversi.
            <br />
            Consiglio di salvarlo nella libreria generale.
            {generalizedMessages && generalizedMessages.length > 0 && (
              <>
                {' '}
                <button
                  type="button"
                  onClick={() => setShowMessages(!showMessages)}
                  className="text-blue-600 hover:text-blue-800 underline cursor-pointer font-medium"
                  style={{ background: 'none', border: 'none', padding: 0 }}
                >
                  {showMessages ? 'Nascondi messaggi generalizzati' : 'Clicca qui per vedere i messaggi generalizzati'}
                </button>
                .
              </>
            )}
          </p>

          {/* ✅ FIX: Lista messaggi generalizzati - visibile solo dopo click */}
          {showMessages && generalizedMessages && generalizedMessages.length > 0 && (
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
            onClick={async () => {
              console.log('[SaveLocationDialog] 🔍 CLICK su "Salva nella libreria generale"', {
                isSavingBeforeClick: isSaving,
                hasOnSaveToFactory: !!onSaveToFactory,
                onSaveToFactoryType: typeof onSaveToFactory
              });
              // ✅ FIX: await the async function to ensure isSaving state updates correctly
              try {
                if (!onSaveToFactory) {
                  console.error('[SaveLocationDialog] ❌ onSaveToFactory is not defined!');
                  return;
                }
                console.log('[SaveLocationDialog] 🚀 Calling onSaveToFactory...');
                await onSaveToFactory();
                console.log('[SaveLocationDialog] ✅ onSaveToFactory completed');
                // ✅ onClose viene chiamato dopo il salvataggio in handleSaveToFactory
                // Non chiamare onClose qui perché handleSaveToFactory lo gestisce
              } catch (error) {
                console.error('[SaveLocationDialog] ❌ Error saving to factory:', error);
                // ✅ Don't close dialog on error - let user see what happened
                // handleSaveToFactory will set isSaving(false) in its catch block
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
              <span>Salva nella libreria generale</span>
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
