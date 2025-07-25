import React, { useState, useRef } from 'react';
import { ConstraintTestCase } from './types';
import { ThumbsUp, ThumbsDown, Check, X } from 'lucide-react';

interface ConstraintTestTableProps {
  script: string;
  variable: string;
  type: string;
  testCases: ConstraintTestCase[];
  onChange?: (testCases: ConstraintTestCase[]) => void;
}

interface EditableCellProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}
const EditableCell: React.FC<EditableCellProps> = ({ value, onChange, placeholder }) => {
  const [editing, setEditing] = useState(false);
  const [temp, setTemp] = useState(value);
  return editing ? (
    <input
      autoFocus
      value={temp}
      onChange={e => setTemp(e.target.value)}
      onBlur={() => { setEditing(false); onChange(temp); }}
      onKeyDown={e => { if (e.key === 'Enter') { setEditing(false); onChange(temp); }}}
      style={{ width: '100%', border: 'none', background: 'transparent', color: '#fff', outline: 'none', fontSize: 15 }}
      placeholder={placeholder}
    />
  ) : (
    <span
      style={{ cursor: 'pointer', minHeight: 24, display: 'inline-block', color: value ? '#fff' : '#888' }}
      onClick={() => setEditing(true)}
    >
      {value || placeholder || '—'}
    </span>
  );
};

function ExpectedPicker({ value, onChange, placeholder }: { value?: boolean; onChange: (v: boolean) => void; placeholder?: string }) {
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
        {value === true && <ThumbsUp size={18} color="#22c55e" strokeWidth={2.2} />}
        {value === false && <ThumbsDown size={18} color="#ef4444" strokeWidth={2.2} />}
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
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 8, borderRadius: 6, cursor: 'pointer', background: value === true ? '#22c55e22' : 'transparent' }}
            onClick={() => { onChange(true); setOpen(false); }}
          >
            <ThumbsUp size={18} color="#22c55e" strokeWidth={2.2} />
            <span style={{ color: '#222', fontSize: 15 }}>Valore valido</span>
          </div>
          <div
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 8, borderRadius: 6, cursor: 'pointer', background: value === false ? '#ef444422' : 'transparent' }}
            onClick={() => { onChange(false); setOpen(false); }}
          >
            <ThumbsDown size={18} color="#ef4444" strokeWidth={2.2} />
            <span style={{ color: '#222', fontSize: 15 }}>Valore non valido</span>
          </div>
        </div>
      )}
    </div>
  );
}

function DropdownEsito({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);
  let label = 'Scegli l\'esito';
  if (value === true) label = 'Valore valido';
  if (value === false) label = 'Valore non valido';
  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <span
        onClick={() => setOpen(o => !o)}
        style={{
          cursor: 'pointer',
          color: value === undefined ? '#888' : '#222',
          fontSize: 15,
          userSelect: 'none',
          padding: '2px 0',
          borderRadius: 4
        }}
      >
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
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 8, borderRadius: 6, cursor: 'pointer', background: value ? '#22c55e22' : 'transparent' }}
            onClick={() => { onChange(true); setOpen(false); }}
          >
            <ThumbsUp size={18} color="#22c55e" strokeWidth={2.2} />
            <span style={{ color: '#222', fontSize: 15 }}>Valore valido</span>
          </div>
          <div
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 8, borderRadius: 6, cursor: 'pointer', background: !value ? '#ef444422' : 'transparent' }}
            onClick={() => { onChange(false); setOpen(false); }}
          >
            <ThumbsDown size={18} color="#ef4444" strokeWidth={2.2} />
            <span style={{ color: '#222', fontSize: 15 }}>Valore non valido</span>
          </div>
        </div>
      )}
    </div>
  );
}

const ConstraintTestTable: React.FC<ConstraintTestTableProps> = ({ script, variable, type, testCases, onChange }) => {
  // testCases: [{input, expected, description}]
  function runTest(input: any): boolean | string {
    try {
      // eslint-disable-next-line no-new-func
      const fn = new Function(variable, `return (${script});`);
      return !!fn(input);
    } catch (e) {
      return 'Errore nello script';
    }
  }

  function updateTestCase(idx: number, field: 'input' | 'description' | 'expected', value: any) {
    if (!onChange) return;
    const updated = testCases.map((tc, i) => i === idx ? { ...tc, [field]: value } : tc);
    onChange(updated);
  }
  function addRow(newInput: string, newDesc: string, newExpected: boolean) {
    if (!onChange) return;
    if (!newInput.trim()) return;
    onChange([
      ...testCases,
      { input: newInput, expected: newExpected, description: newDesc }
    ]);
  }

  // Stato per la riga di inserimento
  const [newInput, setNewInput] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newExpected, setNewExpected] = useState(true);

  return (
    <div style={{
      marginTop: 0,
      border: '1.5px solid #a3a3a3',
      borderRadius: 14,
      background: '#f3f4f6',
      padding: 0
    }}>
      <div style={{
        background: '#e5e7eb',
        borderTopLeftRadius: 14,
        borderTopRightRadius: 14,
        fontWeight: 700,
        fontSize: 16,
        color: '#222',
        padding: '4px 18px 4px 18px', // meno spazio sopra e sotto
        borderBottom: '1px solid #d1d5db',
        marginBottom: 0
      }}>
        Test
      </div>
      <div style={{ padding: '10px 18px 12px 18px' }}>
        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 15, background: 'transparent' }}>
        <thead>
          <tr style={{ background: 'transparent', color: '#fff' }}>
            <th style={{ padding: 6, borderBottom: '1px solid #a3a3a3', borderTopLeftRadius: 8 }}>Valore</th>
            <th style={{ padding: 6, borderBottom: '1px solid #a3a3a3' }}>Descrizione</th>
            <th style={{ padding: 6, borderBottom: '1px solid #a3a3a3', borderTopRightRadius: 8 }}>Risultato</th>
          </tr>
        </thead>
        <tbody>
          {testCases.map((tc, i) => {
            const result = runTest(tc.input);
            const pass = result === tc.expected;
            return (
              <tr key={i} style={{ background: 'transparent', color: '#fff' }}>
                <td style={{ padding: 6, border: '1px solid #a3a3a3' }}>
                  <EditableCell value={String(tc.input)} onChange={v => updateTestCase(i, 'input', v)} placeholder="Valore di test" />
                </td>
                <td style={{ padding: 6, border: '1px solid #a3a3a3', display: 'flex', alignItems: 'center', gap: 8 }}>
                  {tc.expected === true && <ThumbsUp size={18} color="#22c55e" strokeWidth={2.2} />}
                  {tc.expected === false && <ThumbsDown size={18} color="#ef4444" strokeWidth={2.2} />}
                  <span style={{ color: '#222', fontSize: 15 }}>{tc.description}</span>
                </td>
                <td style={{ padding: 6, border: '1px solid #a3a3a3', textAlign: 'center' }}>
                  {pass ? <Check size={18} color="#22c55e" /> : <X size={18} color="#ef4444" />}
                </td>
              </tr>
            );
          })}
          {/* Riga di inserimento sempre presente */}
          <tr style={{ background: 'transparent', color: '#fff' }}>
            <td style={{ padding: 6, border: '1px solid #a3a3a3' }}>
              <EditableCell value={newInput} onChange={setNewInput} placeholder="Aggiungi nuovo valore di test" />
            </td>
            <td style={{ padding: 6, border: '1px solid #a3a3a3' }}>
              <ExpectedPicker
                value={newDesc === 'Valore valido' ? true : newDesc === 'Valore non valido' ? false : undefined}
                onChange={v => setNewDesc(v ? 'Valore valido' : 'Valore non valido')}
                placeholder={!newDesc ? 'descrizione…' : ''}
              />
            </td>
            <td style={{ padding: 6, border: '1px solid #a3a3a3', textAlign: 'center', color: '#888' }}>attesa test...</td>
          </tr>
        </tbody>
      </table>
      </div>
    </div>
  );
};

export default ConstraintTestTable; 