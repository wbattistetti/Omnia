import React, { useState, useRef } from 'react';
import { ConstraintTestCase, ConstraintTestTableProps, EditableCellProps } from './types';
import { ThumbsUp, ThumbsDown, Check, X } from 'lucide-react';
import { PLACEHOLDER_TEST_INPUT, PLACEHOLDER_TEST_DESC, COLOR_VALID, COLOR_INVALID } from './constants';
import LoadingSpinner from './LoadingSpinner';
import ExpectedPicker from './ExpectedPicker';
import TestRow from './TestRow';
import EditableCell from './EditableCell';
import PanelHeader from './PanelHeader';

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
            <ThumbsUp size={18} color={COLOR_VALID} strokeWidth={2.2} />
            <span style={{ color: '#222', fontSize: 15 }}>Valore valido</span>
          </div>
          <div
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 8, borderRadius: 6, cursor: 'pointer', background: !value ? '#ef444422' : 'transparent' }}
            onClick={() => { onChange(false); setOpen(false); }}
          >
            <ThumbsDown size={18} color={COLOR_INVALID} strokeWidth={2.2} />
            <span style={{ color: '#222', fontSize: 15 }}>Valore non valido</span>
          </div>
        </div>
      )}
    </div>
  );
}

const ConstraintTestTable: React.FC<ConstraintTestTableProps> = ({ script, variable, type, testCases, onChange, newRow, onNewRowChange, onAddRow }) => {
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

  return (
    <div style={{
      marginTop: 0,
      border: '1.5px solid #a3a3a3',
      borderRadius: 14,
      background: '#f3f4f6',
      padding: 0
    }}>
      <PanelHeader color={'#e5e7eb'} style={{ borderTopLeftRadius: 14, borderTopRightRadius: 14, borderBottom: '1px solid #d1d5db', color: '#222', fontWeight: 700, fontSize: 16, padding: '4px 18px 4px 18px', marginBottom: 0 }}>
        Test
      </PanelHeader>
      <div style={{ padding: '10px 18px 12px 18px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', background: '#f3f4f6', borderRadius: 8, overflow: 'hidden' }}>
        <thead>
          <tr style={{ background: '#e5e7eb', color: '#222' }}>
            <th style={{ padding: 6, fontWeight: 700 }}>Valore</th>
            <th style={{ padding: 6, fontWeight: 700 }}>Esito</th>
            <th style={{ padding: 6, fontWeight: 700 }}>Descrizione</th>
            <th style={{ padding: 6, fontWeight: 700 }}>Risultato</th>
            <th style={{ padding: 6, fontWeight: 700 }}></th>
          </tr>
        </thead>
        <tbody>
          {testCases.map((tc, i) => (
            <TestRow
              key={i}
              testCase={tc}
              onChange={(field, value) => {
                if (!onChange) return;
                const updated = testCases.map((t, idx) => idx === i ? { ...t, [field]: value } : t);
                onChange(updated);
              }}
              onRemove={() => {
                if (!onChange) return;
                const updated = testCases.filter((_, idx) => idx !== i);
                onChange(updated);
              }}
              isNew={false}
              variable={variable}
              script={script}
              index={i}
            />
          ))}
          {/* Riga di inserimento nuova */}
          <TestRow
            testCase={newRow}
            onChange={onNewRowChange}
            isNew={true}
            variable={variable}
            script={script}
            index={testCases.length}
          />
        </tbody>
      </table>
      </div>
    </div>
  );
};

export default ConstraintTestTable; 