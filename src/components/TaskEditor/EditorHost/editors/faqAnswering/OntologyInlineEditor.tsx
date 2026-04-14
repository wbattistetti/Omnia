/**
 * Inline text field for new node name or rename; Enter confirm, Escape cancel, blur-safe with confirmedRef.
 */

import React, { useEffect, useRef, useState } from 'react';

type Props = {
  initialValue?: string;
  placeholder?: string;
  validate?: (v: string) => string | null;
  onConfirm: (value: string) => void;
  onCancel: () => void;
  className?: string;
};

export default function OntologyInlineEditor({
  initialValue = '',
  placeholder,
  validate,
  onConfirm,
  onCancel,
  className = '',
}: Props) {
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);
  const confirmedRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const commit = (raw: string) => {
    const err = validate?.(raw) ?? null;
    if (err) {
      setError(err);
      return;
    }
    confirmedRef.current = true;
    onConfirm(raw.trim());
  };

  return (
    <div className={className}>
      <input
        ref={inputRef}
        value={value}
        placeholder={placeholder}
        onChange={(e) => {
          setValue(e.target.value);
          setError(null);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit(value);
          }
          if (e.key === 'Escape') {
            e.preventDefault();
            confirmedRef.current = true;
            onCancel();
          }
        }}
        onBlur={() => {
          if (confirmedRef.current) return;
          onCancel();
        }}
        className={`w-full rounded border bg-slate-950 px-2 py-1 text-sm text-slate-100 ${
          error ? 'border-red-500' : 'border-slate-600'
        }`}
      />
      {error ? <p className="mt-1 text-xs text-red-400">{error}</p> : null}
    </div>
  );
}
