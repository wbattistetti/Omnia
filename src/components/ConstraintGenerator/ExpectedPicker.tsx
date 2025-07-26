import React from 'react';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import { COLOR_VALID, COLOR_INVALID, PLACEHOLDER_TEST_DESC } from './constants';

interface ExpectedPickerProps {
  value?: boolean;
  onChange: (v: boolean) => void;
  placeholder?: string;
}

const ExpectedPicker: React.FC<ExpectedPickerProps> = ({ value, onChange, placeholder = PLACEHOLDER_TEST_DESC }) => {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);
  let label = placeholder || '';
  if (value === true) label = 'Valore valido';
  if (value === false) label = 'Valore non valido';
  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block', minWidth: 120 }}>
      <span
        onClick={() => setOpen(o => !o)}
        style={{
          cursor: 'pointer',
          color: value === undefined ? '#888' : '#222',
          fontSize: 15,
          userSelect: 'none',
          padding: '2px 0',
          borderRadius: 4,
          display: 'flex',
          alignItems: 'center',
          gap: 8
        }}
      >
        {value === true && <ThumbsUp size={18} color={COLOR_VALID} strokeWidth={2.2} />}
        {value === false && <ThumbsDown size={18} color={COLOR_INVALID} strokeWidth={2.2} />}
        {label}
      </span>
      {open && (
        <div style={{
          position: 'absolute',
          top: 24,
          left: 0,
          background: '#fff',
          border: '1px solid #ddd',
          borderRadius: 8,
          boxShadow: '0 2px 8px #0002',
          zIndex: 10,
          minWidth: 140,
          padding: 4
        }}>
          <div
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 8, borderRadius: 6, cursor: 'pointer', background: value === true ? COLOR_VALID + '22' : 'transparent' }}
            onClick={() => { onChange(true); setOpen(false); }}
          >
            <ThumbsUp size={18} color={COLOR_VALID} strokeWidth={2.2} />
            <span style={{ color: '#222', fontSize: 15 }}>Valore valido</span>
          </div>
          <div
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 8, borderRadius: 6, cursor: 'pointer', background: value === false ? COLOR_INVALID + '22' : 'transparent' }}
            onClick={() => { onChange(false); setOpen(false); }}
          >
            <ThumbsDown size={18} color={COLOR_INVALID} strokeWidth={2.2} />
            <span style={{ color: '#222', fontSize: 15 }}>Valore non valido</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExpectedPicker; 