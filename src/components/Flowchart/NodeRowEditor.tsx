import React, { useEffect } from 'react';

interface NodeRowEditorProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  inputRef: React.RefObject<HTMLTextAreaElement>;
  placeholder?: string;
}

export const NodeRowEditor: React.FC<NodeRowEditorProps> = ({
  value,
  onChange,
  onKeyDown,
  inputRef,
  placeholder
}) => {
  // Auto-resize the textarea on value change
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 400)}px`;
  }, [value, inputRef]);

  return (
    <textarea
      ref={inputRef}
      value={value}
      onChange={onChange}
      onKeyDown={onKeyDown}
      onFocus={(e) => { /* gated logs removed */ }}
      onBlur={(e) => {
        const rt = e.relatedTarget as HTMLElement | null;
        const toNode = rt && (rt.classList?.contains('react-flow__node') || rt.classList?.contains('react-flow'));
        if (toNode || !rt) {
          setTimeout(() => {
            const ae = document.activeElement as HTMLElement | null;
            const tag = ae?.tagName?.toLowerCase();
            const shouldRefocus = !ae || (tag !== 'input' && tag !== 'textarea' && ae?.getAttribute('contenteditable') !== 'true');
            if (shouldRefocus) {
              try { inputRef.current?.focus(); inputRef.current?.select(); } catch {}
            }
          }, 0);
        }
      }}
      onInput={() => {
        const el = inputRef.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = `${Math.min(el.scrollHeight, 400)}px`;
      }}
      onPointerDown={(e) => { e.stopPropagation(); }}
      onMouseDown={(e) => { e.stopPropagation(); }}
      onClick={(e) => { e.stopPropagation(); }}
      autoFocus
      rows={1}
      className="w-full bg-slate-600 text-white text-[8px] px-1.5 py-1 rounded-md border border-slate-500 focus:outline-none focus:ring-0 nodrag node-row-input"
      style={{
        width: '100%',
        maxWidth: '100%',
        marginTop: 0,
        marginBottom: 0,
        display: 'block',
        resize: 'none',
        overflow: 'hidden',
        lineHeight: 1.2,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word'
      }}
      placeholder={placeholder}
    />
  );
};