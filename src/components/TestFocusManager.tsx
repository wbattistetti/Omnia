import React from 'react';
import { useFocusManager } from '../hooks/useFocusManager';
import { useRowManager } from '../hooks/useRowManager';
import { useNodeManager } from '../hooks/useNodeManager';
import { useIntellisenseManager } from '../hooks/useIntellisenseManager';

/**
 * Componente di test temporaneo per verificare useFocusManager
 * Da rimuovere dopo i test
 */
export const TestFocusManager: React.FC = () => {
  const { focusState, focusActions, focusEvents } = useFocusManager('1', true);
  const { rowState, rowActions, rowEvents } = useRowManager([
    { id: '1', text: 'Test row 1', included: true, mode: 'Message' },
    { id: '2', text: 'Test row 2', included: true, mode: 'Message' }
  ]);
  const { nodeState, nodeActions, nodeEvents } = useNodeManager('Test Node', false, false, false, false);
  const { intellisenseState, intellisenseActions, intellisenseEvents } = useIntellisenseManager();

  const handleCreateNewRow = () => {
    const newId = rowActions.createRow('New row from Enter');
    return newId;
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    focusEvents.onKeyDown(e, 'current-row', handleCreateNewRow);
    intellisenseEvents.onKeyDown(e, (item) => {
      console.log('Selected intellisense item:', item);
    });
  };

  const handleCanvasClick = () => {
    const mockDeleteEmptyNode = () => {
      console.log('Deleting empty node');
    };
    nodeEvents.onCanvasClick(rowState.rows, focusState.activeRowId, mockDeleteEmptyNode);
  };

  return (
    <div style={{ padding: '20px', border: '1px solid #ccc', margin: '10px' }}>
      <h3>Test FocusManager</h3>
      <div>
        <strong>Focus State:</strong>
        <pre>{JSON.stringify(focusState, null, 2)}</pre>
      </div>
      
      <div style={{ marginTop: '10px' }}>
        <strong>Row State:</strong>
        <pre>{JSON.stringify(rowState, null, 2)}</pre>
      </div>
      
      <div style={{ marginTop: '10px' }}>
        <strong>Node State:</strong>
        <pre>{JSON.stringify(nodeState, null, 2)}</pre>
      </div>
      
      <div style={{ marginTop: '10px' }}>
        <strong>Intellisense State:</strong>
        <pre>{JSON.stringify(intellisenseState, null, 2)}</pre>
      </div>
      
      <div style={{ marginTop: '10px' }}>
        <button onClick={() => focusActions.setFocus('row-1')}>
          Set Focus Row 1
        </button>
        <button onClick={() => focusActions.setFocus('row-2')}>
          Set Focus Row 2
        </button>
        <button onClick={focusActions.clearFocus}>
          Clear Focus
        </button>
      </div>

      <div style={{ marginTop: '10px' }}>
        <button onClick={() => rowActions.createRow('New row')}>
          Create Row
        </button>
        <button onClick={() => rowActions.updateRow('1', 'Updated text')}>
          Update Row 1
        </button>
        <button onClick={() => rowActions.deleteRow('2')}>
          Delete Row 2
        </button>
        <button onClick={() => rowActions.moveRow(0, 1)}>
          Move Row 0→1
        </button>
      </div>

      <div style={{ marginTop: '10px' }}>
        <button onClick={() => nodeActions.setTitle('New Node Title')}>
          Set Title
        </button>
        <button onClick={() => nodeActions.setEditing(!nodeState.isEditing)}>
          Toggle Editing
        </button>
        <button onClick={() => nodeActions.setHidden(!nodeState.hidden)}>
          Toggle Hidden
        </button>
        <button onClick={() => nodeActions.createEmptyNode()}>
          Create Empty Node
        </button>
      </div>

      <div style={{ marginTop: '10px' }}>
        <button onClick={() => intellisenseActions.openIntellisense('test query', { x: 100, y: 200 })}>
          Open Intellisense
        </button>
        <button onClick={intellisenseActions.closeIntellisense}>
          Close Intellisense
        </button>
        <button onClick={() => intellisenseActions.setItems([
          { id: '1', name: 'Test Item 1', categoryType: 'agentActs', type: 'agentAct' },
          { id: '2', name: 'Test Item 2', categoryType: 'backendActions', type: 'backendCall' }
        ])}>
          Set Test Items
        </button>
        <button onClick={intellisenseActions.navigateUp}>
          Navigate Up
        </button>
        <button onClick={intellisenseActions.navigateDown}>
          Navigate Down
        </button>
      </div>

      <div style={{ marginTop: '10px' }}>
        <input
          placeholder="Test keyboard events (Enter, Escape)"
          onKeyDown={handleKeyDown}
          style={{ padding: '5px', width: '300px' }}
        />
      </div>

      <div style={{ marginTop: '10px' }}>
        <button onClick={handleCanvasClick}>
          Simulate Canvas Click
        </button>
      </div>

      <div style={{ marginTop: '10px', fontSize: '12px', color: '#666' }}>
        Check console for focus logs
      </div>

      <div style={{ marginTop: '20px', border: '2px solid #007acc', padding: '10px' }}>
        <h3>✅ CustomNodeRefactored Created Successfully!</h3>
        <p style={{ color: '#666', fontSize: '14px' }}>
          The refactored component has been created and is ready for integration into the main FlowEditor.
          <br />
          <strong>Note:</strong> It cannot be tested in isolation because it requires React Flow context.
        </p>
      </div>
    </div>
  );
};
