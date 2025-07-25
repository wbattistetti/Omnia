import React, { useState } from 'react';
import { ConstraintTestCase } from './types';

interface ConstraintTestTableProps {
  script: string;
  variable: string;
  type: string;
  testCases: ConstraintTestCase[];
  onChange?: (testCases: ConstraintTestCase[]) => void;
}

const ConstraintTestTable: React.FC<ConstraintTestTableProps> = ({ script, variable, type, testCases, onChange }) => {
  const [customInput, setCustomInput] = useState('');
  const [customExpected, setCustomExpected] = useState(true);
  const [customDesc, setCustomDesc] = useState('');

  // Funzione per valutare lo script JS in modo sicuro
  function runTest(input: any): boolean | string {
    try {
      // eslint-disable-next-line no-new-func
      const fn = new Function(variable, `return (${script});`);
      return !!fn(input);
    } catch (e) {
      return 'Errore nello script';
    }
  }

  function handleAddTest() {
    if (!onChange) return;
    onChange([
      ...testCases,
      { input: customInput, expected: customExpected, description: customDesc }
    ]);
    setCustomInput('');
    setCustomDesc('');
  }

  return (
    <div style={{ marginTop: 12 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 15 }}>
        <thead>
          <tr style={{ background: '#18181b', color: '#fff' }}>
            <th style={{ padding: 6 }}>Input</th>
            <th style={{ padding: 6 }}>Atteso</th>
            <th style={{ padding: 6 }}>Risultato</th>
            <th style={{ padding: 6 }}>Descrizione</th>
          </tr>
        </thead>
        <tbody>
          {testCases.map((tc, i) => {
            const result = runTest(tc.input);
            const pass = result === tc.expected;
            return (
              <tr key={i} style={{ background: pass ? '#1e293b' : '#7f1d1d', color: pass ? '#fff' : '#fff' }}>
                <td style={{ padding: 6 }}>{String(tc.input)}</td>
                <td style={{ padding: 6 }}>{String(tc.expected)}</td>
                <td style={{ padding: 6 }}>{String(result)}</td>
                <td style={{ padding: 6 }}>{tc.description}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {onChange && (
        <div style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            value={customInput}
            onChange={e => setCustomInput(e.target.value)}
            placeholder="Valore di test"
            style={{ padding: 6, borderRadius: 6, border: '1px solid #888', width: 120 }}
          />
          <select value={customExpected ? 'true' : 'false'} onChange={e => setCustomExpected(e.target.value === 'true')} style={{ padding: 6, borderRadius: 6 }}>
            <option value="true">Valido</option>
            <option value="false">Non valido</option>
          </select>
          <input
            value={customDesc}
            onChange={e => setCustomDesc(e.target.value)}
            placeholder="Descrizione"
            style={{ padding: 6, borderRadius: 6, border: '1px solid #888', width: 180 }}
          />
          <button onClick={handleAddTest} style={{ padding: '6px 16px', borderRadius: 6, background: '#a21caf', color: '#fff', fontWeight: 700, border: 'none' }}>Aggiungi test</button>
        </div>
      )}
    </div>
  );
};

export default ConstraintTestTable; 