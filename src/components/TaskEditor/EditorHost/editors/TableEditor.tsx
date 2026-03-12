import React from 'react';
import { Plus, X, Trash2, Check } from 'lucide-react';

interface TableEditorProps {
  inputs: Array<{ internalName: string; variable?: string }>;
  outputs: Array<{ internalName: string; variable?: string }>;
  rows: Array<{
    id: string;
    inputs: Record<string, any>;
    outputs: Record<string, any>;
  }>;
  columns?: Array<{ name: string; type: 'input' | 'output'; isActive: boolean }>;
  onChange: (rows: Array<{ id: string; inputs: Record<string, any>; outputs: Record<string, any> }>) => void;
  onColumnsChange?: (columns: Array<{ name: string; type: 'input' | 'output'; isActive: boolean }>) => void;
}

export default function TableEditor({ inputs, outputs, rows, columns, onChange, onColumnsChange }: TableEditorProps) {
  const [editingCell, setEditingCell] = React.useState<{ rowId: string; type: 'input' | 'output'; param: string } | null>(null);
  const [cellValue, setCellValue] = React.useState<string>('');
  const [showParkedColumns, setShowParkedColumns] = React.useState(false);

  // ✅ Get all columns (active + parked) if columns prop is provided
  const allColumns = React.useMemo(() => {
    if (!columns || columns.length === 0) {
      // ✅ Fallback: use inputs/outputs if columns not provided (backward compatibility)
      const inputCols = inputs.map(inp => ({ name: inp.internalName, type: 'input' as const, isActive: true }));
      const outputCols = outputs.map(out => ({ name: out.internalName, type: 'output' as const, isActive: true }));
      return [...inputCols, ...outputCols];
    }
    return columns;
  }, [columns, inputs, outputs]);

  // ✅ Filter columns based on showParkedColumns
  const visibleColumns = React.useMemo(() => {
    if (showParkedColumns) {
      return allColumns;
    }
    return allColumns.filter(col => col.isActive);
  }, [allColumns, showParkedColumns]);

  // ✅ Separate visible columns by type
  const visibleInputColumns = visibleColumns.filter(col => col.type === 'input');
  const visibleOutputColumns = visibleColumns.filter(col => col.type === 'output');

  // ✅ Clean parked columns (remove permanently)
  const cleanParkedColumns = React.useCallback(() => {
    if (!columns || !onColumnsChange) return;

    const parkedColumns = columns.filter(col => !col.isActive);
    if (parkedColumns.length === 0) return;

    const parkedColumnNames = new Set(parkedColumns.map(col => col.name));

    // ✅ Remove parked columns from column definitions
    const updatedColumns = columns.filter(col => col.isActive);
    onColumnsChange(updatedColumns);

    // ✅ Remove parked column data from rows
    const updatedRows = rows.map(row => {
      const newInputs: Record<string, any> = {};
      const newOutputs: Record<string, any> = {};

      if (row.inputs) {
        for (const [key, value] of Object.entries(row.inputs)) {
          if (!parkedColumnNames.has(key)) {
            newInputs[key] = value;
          }
        }
      }

      if (row.outputs) {
        for (const [key, value] of Object.entries(row.outputs)) {
          if (!parkedColumnNames.has(key)) {
            newOutputs[key] = value;
          }
        }
      }

      return {
        ...row,
        inputs: newInputs,
        outputs: newOutputs
      };
    });

    onChange(updatedRows);
  }, [columns, onColumnsChange, rows, onChange]);

  // Add new row
  const addRow = () => {
    const newRow = {
      id: `row_${Date.now()}`,
      inputs: {} as Record<string, any>,
      outputs: {} as Record<string, any>
    };
    onChange([...rows, newRow]);
  };

  // Delete row
  const deleteRow = (rowId: string) => {
    onChange(rows.filter(r => r.id !== rowId));
  };

  // Start editing cell
  const startEditing = (rowId: string, type: 'input' | 'output', param: string) => {
    const row = rows.find(r => r.id === rowId);
    if (row) {
      const value = type === 'input' ? row.inputs[param] : row.outputs[param];
      setCellValue(value !== undefined ? String(value) : '');
      setEditingCell({ rowId, type, param });
    }
  };

  // Save cell edit
  const saveCellEdit = () => {
    if (!editingCell) return;

    const currentRowIndex = rows.findIndex(r => r.id === editingCell.rowId);
    const isLastRow = currentRowIndex === rows.length - 1;

    const updatedRows = rows.map(row => {
      if (row.id === editingCell.rowId) {
        const updated = { ...row };
        if (editingCell.type === 'input') {
          updated.inputs = { ...updated.inputs, [editingCell.param]: cellValue };
        } else {
          updated.outputs = { ...updated.outputs, [editingCell.param]: cellValue };
        }
        return updated;
      }
      return row;
    });

    // Auto-append: if this was the last row, add a new empty row
    if (isLastRow) {
      const newRow = {
        id: `row_${Date.now()}`,
        inputs: {} as Record<string, any>,
        outputs: {} as Record<string, any>
      };
      onChange([...updatedRows, newRow]);
    } else {
      onChange(updatedRows);
    }

    setEditingCell(null);
    setCellValue('');
  };

  // Cancel cell edit
  const cancelCellEdit = () => {
    setEditingCell(null);
    setCellValue('');
  };

  // Get cell value
  const getCellValue = (rowId: string, type: 'input' | 'output', param: string): string => {
    const row = rows.find(r => r.id === rowId);
    if (!row) return '';
    const value = type === 'input' ? row.inputs[param] : row.outputs[param];
    return value !== undefined ? String(value) : '';
  };

  // Check if cell is being edited
  const isEditing = (rowId: string, type: 'input' | 'output', param: string): boolean => {
    return editingCell?.rowId === rowId && editingCell?.type === type && editingCell?.param === param;
  };

  // Initialize with empty row if table is empty
  React.useEffect(() => {
    if (rows.length === 0) {
      const newRow = {
        id: `row_${Date.now()}`,
        inputs: {} as Record<string, any>,
        outputs: {} as Record<string, any>
      };
      onChange([newRow]);
    }
  }, []); // Only on mount

  // ✅ Get variable name for a column (from inputs/outputs)
  const getVariableForColumn = React.useCallback((columnName: string, type: 'input' | 'output'): string | undefined => {
    if (type === 'input') {
      const input = inputs.find(inp => inp.internalName === columnName);
      return input?.variable;
    } else {
      const output = outputs.find(out => out.internalName === columnName);
      return output?.variable;
    }
  }, [inputs, outputs]);

  const parkedColumnsCount = allColumns.filter(col => !col.isActive).length;

  return (
    <div className="h-full flex flex-col">
      {/* ✅ Toolbar: Show parked columns toggle + Clean parked columns button */}
      {columns && columns.length > 0 && parkedColumnsCount > 0 && (
        <div className="flex items-center gap-2 p-2 border-b border-slate-700 bg-slate-800">
          <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={showParkedColumns}
              onChange={(e) => setShowParkedColumns(e.target.checked)}
              className="w-3 h-3"
            />
            <span>Show parked columns ({parkedColumnsCount})</span>
          </label>
          {showParkedColumns && (
            <button
              onClick={cleanParkedColumns}
              className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded flex items-center gap-1"
              title="Permanently remove all parked columns and their data"
            >
              <Trash2 size={12} />
              Clean parked columns
            </button>
          )}
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-auto p-4 space-y-4">
        {/* Table */}
        <div className="overflow-x-auto">
          <table className="border-collapse" style={{ tableLayout: 'auto', width: 'auto' }}>
            <thead>
              <tr className="border-b border-slate-700">
                <th className="px-2 py-2 text-left text-xs font-semibold text-slate-400 bg-slate-800 sticky left-0 z-10" style={{ width: 'auto', minWidth: '40px', maxWidth: '50px' }}>
                </th>
                {/* SEND columns (active + parked if shown) */}
                {visibleInputColumns.length > 0 && (
                  <>
                    {visibleInputColumns.map((col) => {
                      const isParked = !col.isActive;
                      const variable = getVariableForColumn(col.name, 'input');
                      return (
                        <th
                          key={`input_${col.name}`}
                          className={`px-2 py-2 text-left text-xs font-semibold border-l border-slate-700 border-t-2 border-b-2 whitespace-nowrap ${
                            isParked
                              ? 'text-slate-500 bg-slate-800/50 border-slate-600'
                              : 'text-cyan-500 bg-cyan-500/20 border-cyan-500'
                          }`}
                          style={{ width: 'auto' }}
                          title={isParked ? 'Parked column (not in current signature)' : undefined}
                        >
                          <div className="flex flex-col">
                            <span>{col.name}</span>
                            {variable && (
                              <span className={`text-[10px] font-normal mt-0.5 ${isParked ? 'text-slate-500' : 'text-cyan-400/70'}`}>
                                {variable}
                              </span>
                            )}
                            {isParked && (
                              <span className="text-[9px] text-slate-500 italic mt-0.5">(parked)</span>
                            )}
                          </div>
                        </th>
                      );
                    })}
                  </>
                )}
                {/* RECEIVE columns (active + parked if shown) */}
                {visibleOutputColumns.map((col) => {
                  const isParked = !col.isActive;
                  const variable = getVariableForColumn(col.name, 'output');
                  return (
                    <th
                      key={`output_${col.name}`}
                      className={`px-2 py-2 text-left text-xs font-semibold border-l border-slate-700 border-t-2 border-b-2 whitespace-nowrap ${
                        isParked
                          ? 'text-slate-500 bg-slate-800/50 border-slate-600'
                          : 'text-green-500 bg-green-500/20 border-green-500'
                      }`}
                      style={{ width: 'auto' }}
                      title={isParked ? 'Parked column (not in current signature)' : undefined}
                    >
                      <div className="flex flex-col">
                        <span>{col.name}</span>
                        {variable && (
                          <span className={`text-[10px] font-normal mt-0.5 ${isParked ? 'text-slate-500' : 'text-green-400/70'}`}>
                            {variable}
                          </span>
                        )}
                        {isParked && (
                          <span className="text-[9px] text-slate-500 italic mt-0.5">(parked)</span>
                        )}
                      </div>
                    </th>
                  );
                })}
                <th className="px-2 py-2 text-center text-xs font-semibold text-slate-400 bg-slate-800 border-l border-slate-700" style={{ width: 'auto', minWidth: '50px' }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                  <tr key={row.id} className="border-b border-slate-700 hover:bg-slate-800/50">
                    <td className="px-2 py-2 text-xs text-slate-400 bg-slate-900 sticky left-0 z-10 text-center" style={{ width: 'auto', minWidth: '40px', maxWidth: '50px' }}>
                      {rowIndex + 1}
                    </td>
                    {/* SEND cells (active + parked if shown) */}
                    {visibleInputColumns.map((col) => {
                      const isParked = !col.isActive;
                      const isEditingCell = isEditing(row.id, 'input', col.name);
                      const cellValueStr = getCellValue(row.id, 'input', col.name);
                      return (
                        <td
                          key={`input_${col.name}_${row.id}`}
                          className={`px-2 py-2 border-l border-slate-700 ${isParked ? 'bg-slate-800/30' : ''}`}
                        >
                          {isParked ? (
                            // ✅ Parked column: read-only, grayed out
                            <div className="w-full px-1.5 py-1 text-xs text-slate-500 italic truncate" title="Parked column (not editable)">
                              {cellValueStr || 'empty'}
                            </div>
                          ) : isEditingCell ? (
                            <div className="flex items-center gap-1">
                              <input
                                type="text"
                                value={cellValue}
                                onChange={(e) => setCellValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    saveCellEdit();
                                  } else if (e.key === 'Escape') {
                                    e.preventDefault();
                                    cancelCellEdit();
                                  }
                                }}
                                className="w-full px-1.5 py-1 bg-slate-800 border border-cyan-500 rounded text-xs text-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                                autoFocus
                              />
                              <button
                                onClick={saveCellEdit}
                                className="p-0.5 hover:bg-green-600 rounded text-green-400"
                                title="Save"
                              >
                                <Check size={12} />
                              </button>
                              <button
                                onClick={cancelCellEdit}
                                className="p-0.5 hover:bg-red-600 rounded text-red-400"
                                title="Cancel"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => startEditing(row.id, 'input', col.name)}
                              className="w-full px-1.5 py-1 text-left text-xs text-slate-300 hover:bg-slate-700 rounded truncate"
                              title="Click to edit"
                            >
                              {cellValueStr || <span className="text-slate-500 italic">empty</span>}
                            </button>
                          )}
                        </td>
                      );
                    })}
                    {/* RECEIVE cells (active + parked if shown) */}
                    {visibleOutputColumns.map((col) => {
                      const isParked = !col.isActive;
                      const isEditingCell = isEditing(row.id, 'output', col.name);
                      const cellValueStr = getCellValue(row.id, 'output', col.name);
                      return (
                        <td
                          key={`output_${col.name}_${row.id}`}
                          className={`px-2 py-2 border-l border-slate-700 ${isParked ? 'bg-slate-800/30' : ''}`}
                        >
                          {isParked ? (
                            // ✅ Parked column: read-only, grayed out
                            <div className="w-full px-1.5 py-1 text-xs text-slate-500 italic truncate" title="Parked column (not editable)">
                              {cellValueStr || 'empty'}
                            </div>
                          ) : isEditingCell ? (
                            <div className="flex items-center gap-1">
                              <input
                                type="text"
                                value={cellValue}
                                onChange={(e) => setCellValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    saveCellEdit();
                                  } else if (e.key === 'Escape') {
                                    e.preventDefault();
                                    cancelCellEdit();
                                  }
                                }}
                                className="w-full px-1.5 py-1 bg-slate-800 border border-green-500 rounded text-xs text-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                                autoFocus
                              />
                              <button
                                onClick={saveCellEdit}
                                className="p-0.5 hover:bg-green-600 rounded text-green-400"
                                title="Save"
                              >
                                <Check size={12} />
                              </button>
                              <button
                                onClick={cancelCellEdit}
                                className="p-0.5 hover:bg-red-600 rounded text-red-400"
                                title="Cancel"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => startEditing(row.id, 'output', col.name)}
                              className="w-full px-1.5 py-1 text-left text-xs text-slate-300 hover:bg-slate-700 rounded truncate"
                              title="Click to edit"
                            >
                              {cellValueStr || <span className="text-slate-500 italic">empty</span>}
                            </button>
                          )}
                        </td>
                      );
                    })}
                    {/* Actions */}
                    <td className="px-2 py-2 text-center border-l border-slate-700">
                      <button
                        onClick={() => deleteRow(row.id)}
                        className="p-1 hover:bg-red-600 rounded text-red-400"
                        title="Delete row"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* Add Row button */}
        <div className="flex justify-end">
          <button
            onClick={addRow}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded flex items-center gap-1.5"
          >
            <Plus size={14} />
            Add Row
          </button>
        </div>
      </div>
    </div>
  );
}

