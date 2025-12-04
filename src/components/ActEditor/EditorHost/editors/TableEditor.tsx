import React from 'react';
import { Plus, X, Trash2, Check } from 'lucide-react';

interface TableEditorProps {
  inputs: Array<{ internalName: string }>;
  outputs: Array<{ internalName: string }>;
  rows: Array<{
    id: string;
    inputs: Record<string, any>;
    outputs: Record<string, any>;
  }>;
  onChange: (rows: Array<{ id: string; inputs: Record<string, any>; outputs: Record<string, any> }>) => void;
}

export default function TableEditor({ inputs, outputs, rows, onChange }: TableEditorProps) {
  const [editingCell, setEditingCell] = React.useState<{ rowId: string; type: 'input' | 'output'; param: string } | null>(null);
  const [cellValue, setCellValue] = React.useState<string>('');

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

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 min-h-0 overflow-auto p-4 space-y-4">
        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="px-2 py-2 text-left text-xs font-semibold text-slate-400 bg-slate-800 sticky left-0 z-10 min-w-[80px]">
                  Row
                </th>
                {/* SEND columns */}
                {inputs.length > 0 && (
                  <>
                    {inputs.map((input) => (
                      <th
                        key={`input_${input.internalName}`}
                        className="px-2 py-2 text-left text-xs font-semibold text-cyan-500 bg-cyan-500/20 border-l border-slate-700 border-t-2 border-b-2 border-cyan-500 min-w-[120px]"
                      >
                        {input.internalName}
                      </th>
                    ))}
                  </>
                )}
                {/* RECEIVE columns */}
                {outputs.map((output) => (
                  <th
                    key={`output_${output.internalName}`}
                    className="px-2 py-2 text-left text-xs font-semibold text-green-500 bg-green-500/20 border-l border-slate-700 border-t-2 border-b-2 border-green-500 min-w-[120px]"
                  >
                    {output.internalName}
                  </th>
                ))}
                <th className="px-2 py-2 text-center text-xs font-semibold text-slate-400 bg-slate-800 border-l border-slate-700 min-w-[60px]">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                  <tr key={row.id} className="border-b border-slate-700 hover:bg-slate-800/50">
                    <td className="px-2 py-2 text-xs text-slate-400 bg-slate-900 sticky left-0 z-10">
                      {rowIndex + 1}
                    </td>
                    {/* SEND cells */}
                    {inputs.map((input) => {
                      const isEditingCell = isEditing(row.id, 'input', input.internalName);
                      return (
                        <td key={`input_${input.internalName}_${row.id}`} className="px-2 py-2 border-l border-slate-700">
                          {isEditingCell ? (
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
                              onClick={() => startEditing(row.id, 'input', input.internalName)}
                              className="w-full px-1.5 py-1 text-left text-xs text-slate-300 hover:bg-slate-700 rounded truncate"
                              title="Click to edit"
                            >
                              {getCellValue(row.id, 'input', input.internalName) || <span className="text-slate-500 italic">empty</span>}
                            </button>
                          )}
                        </td>
                      );
                    })}
                    {/* RECEIVE cells */}
                    {outputs.map((output) => {
                      const isEditingCell = isEditing(row.id, 'output', output.internalName);
                      return (
                        <td key={`output_${output.internalName}_${row.id}`} className="px-2 py-2 border-l border-slate-700">
                          {isEditingCell ? (
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
                              onClick={() => startEditing(row.id, 'output', output.internalName)}
                              className="w-full px-1.5 py-1 text-left text-xs text-slate-300 hover:bg-slate-700 rounded truncate"
                              title="Click to edit"
                            >
                              {getCellValue(row.id, 'output', output.internalName) || <span className="text-slate-500 italic">empty</span>}
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

