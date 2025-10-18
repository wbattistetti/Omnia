import { useState, useEffect } from 'react';

/**
 * Calcola un'area hover estesa che copre:
 * - L'intera riga del nodo
 * - La toolbar delle azioni (FUORI dal nodo, a destra)
 * - 7px di padding intorno a tutto
 * 
 * Questo garantisce che la toolbar rimanga visibile anche con movimento lento del mouse
 */
export function useOverlayBuffer(
  labelRef: React.RefObject<HTMLSpanElement>,
  iconPos: { top: number; left: number } | null,
  showIcons: boolean,
  overlayRef?: React.RefObject<HTMLDivElement> // Riferimento alla toolbar per dimensioni precise
) {
  const [bufferRect, setBufferRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (showIcons && labelRef.current && iconPos) {
      const labelRect = labelRef.current.getBoundingClientRect();
      
      // Trova il nodo per ottenere i confini della riga
      const nodeEl = labelRef.current.closest('.node-row-outer') as HTMLElement | null;
      const rowRect = nodeEl ? nodeEl.getBoundingClientRect() : labelRect;
      
      // Calcola dimensioni toolbar (stimata o precisa se abbiamo overlayRef)
      let toolbarWidth = 160; // Stima: 4 icone * 20px + gap
      let toolbarHeight = labelRect.height;
      
      if (overlayRef?.current) {
        const toolbarRect = overlayRef.current.getBoundingClientRect();
        toolbarWidth = toolbarRect.width + 10; // +10px margine extra per sicurezza
        toolbarHeight = toolbarRect.height;
      }
      
      // Padding di 7px su TUTTI i lati (sopra, sotto, sinistra, destra)
      const PADDING = 7;
      
      // Area hover estesa: riga + toolbar + 7px padding su tutti i lati
      // IMPORTANTE: usa labelRect (non rowRect) per altezza precisa della riga
      const extendedRect = {
        top: labelRect.top - PADDING,                    // 7px SOPRA la label
        left: rowRect.left - PADDING,                    // 7px SINISTRA della riga
        right: iconPos.left + toolbarWidth + PADDING,    // 7px DESTRA dopo toolbar
        bottom: labelRect.bottom + PADDING,              // 7px SOTTO la label
      };
      
      setBufferRect({
        top: extendedRect.top,
        left: extendedRect.left,
        width: extendedRect.right - extendedRect.left,
        height: extendedRect.bottom - extendedRect.top,
        right: extendedRect.right,
        bottom: extendedRect.bottom,
        x: extendedRect.left,
        y: extendedRect.top,
        toJSON: () => ({})
      } as DOMRect);
    } else {
      setBufferRect(null);
    }
  }, [showIcons, labelRef, iconPos, overlayRef]);

  return bufferRect;
} 