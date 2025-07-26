import React from 'react';
import { ConstraintTestCase } from './types';
import { Check, X, Trash2 } from 'lucide-react';
import EditableCell from './EditableCell'; // Assicurati che sia estratto se non lo è già
import ExpectedPicker from './ExpectedPicker';
import { COLOR_VALID, COLOR_INVALID, PLACEHOLDER_TEST_INPUT, PLACEHOLDER_TEST_DESC } from './constants';

interface TestRowProps {
  testCase: ConstraintTestCase;
  onChange: (field: keyof ConstraintTestCase, value: any) => void;
  onRemove?: () => void;
  isNew?: boolean;
  variable: string;
  script: string;
  index: number;
}

function runTest(script: string, variable: string, input: any): boolean | string {
  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function(variable, `return (${script});`);
    return !!fn(input);
  } catch (e) {
    return 'Errore nello script';
  }
}

const TestRow: React.FC<TestRowProps> = ({ testCase, onChange, onRemove, isNew, variable, script, index }) => {
  const pass = !isNew ? runTest(script, variable, testCase.input) : undefined;
  return (
    <tr style={{ background: 'transparent', color: '#fff' }}>
      <td style={{ padding: 6, border: '1px solid #a3a3a3' }}>
        <EditableCell value={String(testCase.input)} onChange={v => onChange('input', v)} placeholder={PLACEHOLDER_TEST_INPUT} />
      </td>
      <td style={{ padding: 6, border: '1px solid #a3a3a3' }}>
        <ExpectedPicker value={testCase.expected} onChange={v => onChange('expected', v)} />
      </td>
      <td style={{ padding: 6, border: '1px solid #a3a3a3' }}>
        <EditableCell value={testCase.description} onChange={v => onChange('description', v)} placeholder={PLACEHOLDER_TEST_DESC} />
      </td>
      {!isNew && (
        <td style={{ padding: 6, border: '1px solid #a3a3a3', textAlign: 'center' }}>
          {pass === true ? <Check size={18} color={COLOR_VALID} /> : pass === false ? <X size={18} color={COLOR_INVALID} /> : null}
        </td>
      )}
      {onRemove && !isNew && (
        <td style={{ padding: 6, border: '1px solid #a3a3a3', textAlign: 'center' }}>
          <button onClick={onRemove} style={{ background: 'none', border: 'none', cursor: 'pointer' }} title="Rimuovi test">
            <Trash2 size={16} color="#888" />
          </button>
        </td>
      )}
    </tr>
  );
};

export default TestRow; 