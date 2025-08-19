import React from 'react';

interface NodeRowEditorProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  inputRef: React.RefObject<HTMLInputElement>;
  placeholder?: string;
}

export const NodeRowEditor: React.FC<NodeRowEditorProps> = ({
  value,
  onChange,
  onKeyDown,
  inputRef,
  placeholder
}) => (
  <input
    ref={inputRef}
    type="text"
    value={value}
    onChange={onChange}
    onKeyDown={onKeyDown}
    onFocus={(e) => { try { console.log('[Focus][Input] focus', { active: (document.activeElement as any)?.className || (document.activeElement as any)?.tagName }); } catch {} }}
    onBlur={(e) => {
      try { console.log('[Focus][Input] blur', { related: (e.relatedTarget as any)?.className || (e.relatedTarget as any)?.tagName }); } catch {}
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
    onPointerDown={(e) => { e.stopPropagation(); }}
    onMouseDown={(e) => { e.stopPropagation(); }}
    onClick={(e) => { e.stopPropagation(); }}
    autoFocus
    className="w-full bg-slate-600 text-white text-[8px] px-1.5 py-1 rounded-md border border-slate-500 focus:outline-none focus:ring-0 nodrag node-row-input"
    style={{ width: '100%', maxWidth: '100%', marginTop: 2, marginBottom: 2, display: 'block' }}
    placeholder={placeholder}
  />
); 