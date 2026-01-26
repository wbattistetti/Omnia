import React from 'react';
import { flushSync } from 'react-dom';
import { Plus, ChevronsRight, BarChart2, Play } from 'lucide-react';
import * as testingState from '../../testingState';

interface TesterGridActionsColumnProps {
  rowIndex: number;
  newExample?: string;
  onAddExample?: () => void;
  runAllRows?: () => Promise<void>;
  testing?: boolean;
  examplesListLength?: number;
  reportOpen?: boolean;
  setReportOpen?: (open: boolean) => void;
  runRowTest?: (idx: number) => Promise<void>;
  phraseColumnWidth?: number; // ✅ FIX: Necessario per calcolare left per sticky
  rowBackground?: string; // ✅ FIX: Background della riga per mantenere coerenza
}

/**
 * Column component for action buttons (Add, Run All, Report, Run Row)
 */
export default function TesterGridActionsColumn({
  rowIndex,
  newExample,
  onAddExample,
  runAllRows,
  testing,
  examplesListLength = 0,
  reportOpen,
  setReportOpen,
  runRowTest,
  phraseColumnWidth = 280, // ✅ FIX: Default per calcolare left
  rowBackground = '#f9fafb', // ✅ FIX: Default background
}: TesterGridActionsColumnProps) {
  // Header: Add button
  if (rowIndex === -1) {
    return (
      <th style={{
        width: 46,
        background: '#f9fafb',
        padding: 8,
        textAlign: 'center',
        position: 'sticky', // ✅ FIX: Sticky per rimanere fissa
        left: phraseColumnWidth, // ✅ FIX: Posizionata subito dopo la colonna Frase
        zIndex: 1001, // ✅ FIX: zIndex alto ma inferiore alla colonna Frase
      }}>
        {onAddExample && (
          <button
            onClick={onAddExample}
            disabled={!newExample?.trim()}
            style={{
              padding: '4px 8px',
              border: '1px solid #334155',
              borderRadius: 4,
              background: newExample?.trim() ? '#10b981' : '#9ca3af',
              color: '#fff',
              cursor: newExample?.trim() ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
            }}
            title="Aggiungi frase di test"
          >
            <Plus size={14} />
          </button>
        )}
      </th>
    );
  }

  // Row 0: Run All button
  if (rowIndex === 0 && runAllRows) {
    return (
      <td style={{
        padding: 4,
        textAlign: 'center',
        verticalAlign: 'middle',
        background: rowBackground, // ✅ FIX: Usa il background della riga
        width: 46,
        position: 'sticky', // ✅ FIX: Sticky per rimanere fissa
        left: phraseColumnWidth, // ✅ FIX: Posizionata subito dopo la colonna Frase
        zIndex: 9, // ✅ FIX: zIndex per rimanere sopra le colonne scrollabili
      }}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            // ✅ CRITICAL: Attiva testing state PRIMA di qualsiasi operazione
            // Usa flushSync per forzare React a processare il cambio IMMEDIATAMENTE
            // Questo previene il feedback loop che parte prima che runAllRows venga eseguito
            testingState.startTesting();
            flushSync(() => {
              // Forza React a processare il cambio di getIsTesting() immediatamente
              // Questo assicura che DataExtractionEditor venga smontato PRIMA che runAllRows() venga chiamato
            });
            void runAllRows();
          }}
          disabled={testing || examplesListLength === 0}
          title="Prova tutte"
          style={{
            border: '1px solid #22c55e',
            background: testing ? '#eab308' : '#14532d',
            color: '#dcfce7',
            borderRadius: 8,
            padding: '8px 10px',
            cursor: testing || examplesListLength === 0 ? 'not-allowed' : 'pointer',
            width: '100%',
            opacity: testing || examplesListLength === 0 ? 0.5 : 1,
          }}
        >
          <ChevronsRight size={16} />
        </button>
      </td>
    );
  }

  // Row 1: Report button
  if (rowIndex === 1 && setReportOpen !== undefined) {
    return (
      <td style={{
        padding: 4,
        textAlign: 'center',
        verticalAlign: 'middle',
        background: rowBackground, // ✅ FIX: Usa il background della riga
        width: 46,
        position: 'sticky', // ✅ FIX: Sticky per rimanere fissa
        left: phraseColumnWidth, // ✅ FIX: Posizionata subito dopo la colonna Frase
        zIndex: 9, // ✅ FIX: zIndex per rimanere sopra le colonne scrollabili
      }}>
        <div style={{ position: 'relative', width: '100%' }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setReportOpen(!reportOpen);
            }}
            title="Report"
            style={{
              border: '1px solid #60a5fa',
              background: '#0c4a6e',
              color: '#dbeafe',
              borderRadius: 8,
              padding: '8px 10px',
              cursor: 'pointer',
              width: '100%',
            }}
          >
            <BarChart2 size={16} />
          </button>
        </div>
      </td>
    );
  }

  // Other rows: Run single row button
  return (
    <td style={{
      padding: 4,
      textAlign: 'center',
      verticalAlign: 'middle',
      background: rowBackground, // ✅ FIX: Usa il background della riga
      width: 46,
      position: 'sticky', // ✅ FIX: Sticky per rimanere fissa
      left: phraseColumnWidth, // ✅ FIX: Posizionata subito dopo la colonna Frase
      zIndex: 9, // ✅ FIX: zIndex per rimanere sopra le colonne scrollabili
    }}>
      {runRowTest && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            void runRowTest(rowIndex);
          }}
          title="Prova questa riga"
          style={{
            border: '1px solid #3b82f6',
            background: '#1e40af',
            color: '#dbeafe',
            borderRadius: 8,
            padding: '8px 10px',
            cursor: 'pointer',
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Play size={14} />
        </button>
      )}
    </td>
  );
}
