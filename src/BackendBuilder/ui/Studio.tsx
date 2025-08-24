import React from 'react';
import { BackendBuilderProvider, useBackendBuilder } from '../state/BackendBuilderContext';
import StepDesign from './steps/StepDesign';
import SourcesEditor from './steps/SourcesEditor/Index';
import BackendInterfaceEditor from './steps/BackendInterfaceEditor/Index';

interface StudioProps {
  onClose?: () => void;
}

function StudioContent({ onClose }: StudioProps) {
  const { currentStep, setCurrentStep } = useBackendBuilder();
  const steps: Array<{ key: string; label: string }> = [
    { key: 'design', label: 'Design Studio' },
    { key: 'sources', label: 'Sources' },
    { key: 'backendInterface', label: 'Backend Interface' },
    { key: 'plan', label: 'PlanGraph' },
    { key: 'policies', label: 'Policies' },
    { key: 'usecases', label: 'UseCases' },
    { key: 'codegen', label: 'Codegen' },
  ];

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', display: 'grid', gridTemplateRows: '56px 1fr', background: '#0f1115' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', borderBottom: '1px solid #222', color: '#fff' }}>
        <div style={{ fontWeight: 700 }}>Backend Builder</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{ padding: '6px 10px' }}>Close</button>
        </div>
      </header>
      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', minHeight: 0 }}>
        <aside style={{ borderRight: '1px solid #222', overflow: 'auto', padding: 12, color: '#ddd' }}>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 6 }}>
            {steps.map(s => (
              <li key={s.key}>
                <button
                  onClick={() => setCurrentStep(s.key)}
                  style={{
                    width: '100%', textAlign: 'left', padding: '8px 10px', borderRadius: 6,
                    background: currentStep === s.key ? '#1f2937' : 'transparent', color: '#ddd', border: '1px solid #222'
                  }}
                >
                  {s.label}
                </button>
              </li>
            ))}
          </ul>
        </aside>
        <main style={{ overflow: 'auto', padding: 16, color: '#eee' }}>
          {currentStep === 'design' && <StepDesign />}
          {currentStep === 'sources' && <SourcesEditor />}
          {currentStep === 'backendInterface' && <BackendInterfaceEditor />}
          {currentStep !== 'design' && currentStep !== 'sources' && (
            <div style={{ border: '1px dashed #333', borderRadius: 8, padding: 16 }}>
              Step "{currentStep}" coming soon…
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default function BackendBuilderStudio({ onClose }: StudioProps) {
  return (
    <BackendBuilderProvider>
      <StudioContent onClose={onClose} />
    </BackendBuilderProvider>
  );
}


