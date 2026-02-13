import React, { useEffect, useLayoutEffect, useCallback } from 'react';
import { VoiceTextbox } from '../common/VoiceTextbox';

interface NodeRowEditorProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  inputRef: React.RefObject<HTMLTextAreaElement>;
  placeholder?: string;
  fontStyles?: {
    fontSize: string;
    fontFamily: string;
    fontWeight: string;
    lineHeight: string;
  } | null;
  onWidthChange?: (width: number) => void;
}

export const NodeRowEditor: React.FC<NodeRowEditorProps> = ({
  value,
  onChange,
  onKeyDown,
  inputRef,
  placeholder,
  fontStyles,
  onWidthChange
}) => {
  const DEBUG_FOCUS = (() => { try { return localStorage.getItem('debug.focus') === '1'; } catch { return false; } })();
  const log = (...args: any[]) => { if (DEBUG_FOCUS) { try { console.log('[Focus][RowEditor]', ...args); } catch {} } };

  // ✅ Calcola e aggiorna la larghezza usando scrollWidth (Regola 1)
  const updateWidth = useCallback(() => {
    const el = inputRef.current;
    if (!el || !onWidthChange) {
      return;
    }

    // ✅ Punto 3: Doppio requestAnimationFrame per aspettare i reflow di React Flow
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const el = inputRef.current;
        if (!el || !onWidthChange) {
          return;
        }

        // ✅ Regola 1: Usa scrollWidth (l'unico valore affidabile)
        const scrollWidth = el.scrollWidth;

        // Calcola larghezza totale: scrollWidth + margine di sicurezza
        const totalWidth = Math.max(scrollWidth + 20, 140); // Larghezza minima 140px

        onWidthChange(totalWidth);

        // ✅ Blocca lo scroll orizzontale - mantiene il testo sempre allineato a sinistra
        el.scrollLeft = 0;
      });
    });
  }, [inputRef, onWidthChange]);

  // Apply font styles directly to DOM element to override CSS classes
  useEffect(() => {
    const el = inputRef.current;
    if (!el || !fontStyles) return;

    // Apply font styles directly to override any CSS classes
    el.style.setProperty('font-size', fontStyles.fontSize, 'important');
    el.style.setProperty('font-family', fontStyles.fontFamily, 'important');
    el.style.setProperty('font-weight', fontStyles.fontWeight, 'important');
    el.style.setProperty('line-height', fontStyles.lineHeight, 'important');

    // ✅ Aggiorna larghezza quando cambiano i font styles
    updateWidth();
  }, [fontStyles, inputRef, updateWidth]);

  // Auto-resize the textarea on value change
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 400)}px`;
    log('autosize', { h: el.scrollHeight });

    // ✅ Regola 3: Aggiorna larghezza quando cambia il valore
    updateWidth();
  }, [value, inputRef, updateWidth]);

  // Ensure focus on mount in a layout effect to win against parent reflows
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    try {
      el.focus({ preventScroll: true } as any);
      el.select();
      log('focused on mount');
      // ✅ Aggiorna larghezza al mount
      updateWidth();
    } catch { log('focus error on mount'); }
  }, [updateWidth]);

  // Determine if textbox is empty
  const isEmpty = !value || value.trim() === '';

  // ✅ Handler onChange che chiama anche updateWidth
  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e);
    // ✅ Regola 3: Aggiorna larghezza su ogni cambio (updateWidth già usa doppio RAF internamente)
    updateWidth();
  }, [onChange, updateWidth]);

  return (
    <VoiceTextbox
      ref={inputRef}
      value={value}
      onChange={handleChange}
      onKeyDown={(e) => {
        onKeyDown(e);
      }}
      autoStartWhenEmpty={isEmpty}
      onFocus={(e) => {
        log('onFocus', { valueLength: String(value||'').length });
        // ✅ Aggiorna larghezza al focus
        updateWidth();
      }}
      onBlur={(e) => {
        log('onBlur');
        const rt = e.relatedTarget as HTMLElement | null;
        const toNode = rt && (rt.classList?.contains('react-flow__node') || rt.classList?.contains('react-flow'));

        // ✅ Non rifocalizzare se la riga è vuota (permette l'eliminazione automatica)
        const isEmpty = !value || value.trim() === '';
        if (isEmpty) {
          log('onBlur: row is empty, allowing deletion');
          return;
        }

        if (toNode || !rt) {
          // Use requestAnimationFrame instead of setTimeout
          requestAnimationFrame(() => {
            const ae = document.activeElement as HTMLElement | null;
            const tag = ae?.tagName?.toLowerCase();
            const shouldRefocus = !ae || (tag !== 'input' && tag !== 'textarea' && ae?.getAttribute('contenteditable') !== 'true');
            if (shouldRefocus) {
              try { inputRef.current?.focus(); inputRef.current?.select(); log('refocus after blur safety'); } catch { log('refocus error'); }
            }
          });
        }
      }}
      onInput={(e) => {
        const el = inputRef.current;
        if (!el) {
          return;
        }

        el.style.height = 'auto';
        el.style.height = `${Math.min(el.scrollHeight, 400)}px`;

        // ✅ Regola 3: Aggiorna larghezza su ogni input
        updateWidth();

        // ✅ Blocca lo scroll orizzontale anche su input diretto
        el.scrollLeft = 0;
      }}
      onPointerDown={(e) => { log('onPointerDown stop'); e.stopPropagation(); }}
      onMouseDown={(e) => { log('onMouseDown stop'); e.stopPropagation(); }}
      onClick={(e) => { log('onClick stop'); e.stopPropagation(); }}
      autoFocus
      rows={1}
      className="w-full bg-slate-600 text-white px-1.5 py-1 rounded-md border border-slate-500 focus:outline-none focus:ring-0 nodrag node-row-input"
      style={{
        width: 'auto',        // ✅ Punto 1: Permette espansione
        minWidth: '100%',     // ✅ Punto 1: Non collassa mai
        maxWidth: 'none',     // ✅ Punto 1: Rimuovi maxWidth per permettere espansione illimitata
        marginTop: 0,
        marginBottom: 0,
        display: 'inline-block', // ✅ Punto 2: Migliora il comportamento, non subisce vincoli flex
        resize: 'none',
        overflow: 'hidden',
        overflowX: 'hidden',  // ✅ Punto 1: Fondamentale - evita scrollbar, forza espansione
        overflowY: 'hidden', // ✅ Punto 1: Nasconde overflow verticale
        whiteSpace: 'nowrap',
        wordBreak: 'normal',
        lineHeight: fontStyles?.lineHeight || '1.1'
      }}
      placeholder={placeholder}
    />
  );
};