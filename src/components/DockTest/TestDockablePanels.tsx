import React, { useState } from 'react';

interface PanelData {
  id: string;
  title: string;
}

const TestDockablePanels: React.FC = () => {
  const [panels, setPanels] = useState<PanelData[]>([
    { id: 'canvas', title: 'Canvas (Flow placeholder)' }
  ]);
  const [panelCount, setPanelCount] = useState(1);

  const addPanel = () => {
    const newId = `panel-${panelCount}`;
    setPanels([...panels, { id: newId, title: `Panel ${panelCount}` }]);
    setPanelCount(panelCount + 1);
  };

  const removePanel = (id: string) => {
    setPanels(panels.filter(p => p.id !== id && p.id !== 'canvas'));
  };

  return (
    <div style={{ padding: 24, height: '100vh', background: '#f5f5f5' }}>
      <h2>Test Dockable Panels</h2>
      <button onClick={addPanel} style={{ marginBottom: 16 }}>Aggiungi Panel</button>
      <div style={{ display: 'flex', gap: 16, height: '80vh' }}>
        {panels.map(panel => (
          <div key={panel.id} style={{ border: '1px solid #aaa', borderRadius: 8, background: '#fff', flex: 1, minWidth: 200, position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ fontWeight: 'bold', marginBottom: 8 }}>{panel.title}</div>
            {panel.id !== 'canvas' && (
              <button onClick={() => removePanel(panel.id)} style={{ position: 'absolute', top: 8, right: 8 }}>X</button>
            )}
            {panel.id === 'canvas' && (
              <div style={{ width: '100%', height: '100%', border: '2px dashed #888', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888' }}>
                FlowEditor Placeholder
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default TestDockablePanels; 