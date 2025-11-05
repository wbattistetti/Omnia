import React, { useEffect, useLayoutEffect } from 'react';
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
}

export const NodeRowEditor: React.FC<NodeRowEditorProps> = ({
  value,
  onChange,
  onKeyDown,
  inputRef,
  placeholder,
  fontStyles
}) => {
  const DEBUG_FOCUS = (() => { try { return localStorage.getItem('debug.focus') === '1'; } catch { return false; } })();
  const log = (...args: any[]) => { if (DEBUG_FOCUS) { try { console.log('[Focus][RowEditor]', ...args); } catch {} } };

  // Apply font styles directly to DOM element to override CSS classes
  useEffect(() => {
    const el = inputRef.current;
    if (!el || !fontStyles) return;

    // Apply font styles directly to override any CSS classes
    el.style.setProperty('font-size', fontStyles.fontSize, 'important');
    el.style.setProperty('font-family', fontStyles.fontFamily, 'important');
    el.style.setProperty('font-weight', fontStyles.fontWeight, 'important');
    el.style.setProperty('line-height', fontStyles.lineHeight, 'important');

    console.log('[NodeRowEditor][FONT_APPLY] Font styles applied directly to DOM', {
      fontSize: fontStyles.fontSize,
      fontFamily: fontStyles.fontFamily,
      fontWeight: fontStyles.fontWeight,
      lineHeight: fontStyles.lineHeight
    });
  }, [fontStyles, inputRef]);

  // Auto-resize the textarea on value change
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 400)}px`;
    log('autosize', { h: el.scrollHeight });
  }, [value, inputRef]);

  // Ensure focus on mount in a layout effect to win against parent reflows
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    try { el.focus({ preventScroll: true } as any); el.select(); log('focused on mount'); } catch { log('focus error on mount'); }
  }, []);

  return (
    <VoiceTextbox
      ref={inputRef}
      value={value}
      onChange={onChange}
      onKeyDown={(e) => {
        onKeyDown(e);
      }}
      onFocus={(e) => { log('onFocus', { valueLength: String(value||'').length }); }}
      onBlur={(e) => {
        log('onBlur');
        const rt = e.relatedTarget as HTMLElement | null;
        const toNode = rt && (rt.classList?.contains('react-flow__node') || rt.classList?.contains('react-flow'));
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
      onInput={() => {
        const el = inputRef.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = `${Math.min(el.scrollHeight, 400)}px`;
        log('onInput resize', { h: el.scrollHeight });
      }}
      onPointerDown={(e) => { log('onPointerDown stop'); e.stopPropagation(); }}
      onMouseDown={(e) => { log('onMouseDown stop'); e.stopPropagation(); }}
      onClick={(e) => { log('onClick stop'); e.stopPropagation(); }}
      autoFocus
      rows={1}
      className="w-full bg-slate-600 text-white px-1.5 py-1 rounded-md border border-slate-500 focus:outline-none focus:ring-0 nodrag node-row-input"
      style={{
        width: '100%',
        maxWidth: '100%',
        marginTop: 0,
        marginBottom: 0,
        display: 'block',
        resize: 'none',
        overflow: 'hidden',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        lineHeight: fontStyles?.lineHeight || '1.1'
      }}
      placeholder={placeholder}
    />
  );
};