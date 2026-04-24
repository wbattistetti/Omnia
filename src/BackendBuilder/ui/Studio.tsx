import React from 'react';
import { BackendBuilderProvider, useBackendBuilder, type StepKey } from '../state/BackendBuilderContext';
import { OmniaTutorSetup } from '@components/settings/OmniaTutorSetup';
import { IAAgentSetup } from '@components/settings/IAAgentSetup';
import { EditorFontPanel } from '@components/settings/EditorFontPanel';
import { EditorColorsPanel } from '@components/settings/EditorColorsPanel';
import {
  loadGlobalIaAgentConfig,
  saveGlobalIaAgentConfig,
} from '@utils/iaAgentRuntime/globalIaAgentPersistence';
import { conversationConfigFragmentFromIaAgentConfig } from '@utils/iaAgentRuntime/convaiAgentCreatePayload';
import { createConvaiAgentViaOmniaServer } from '@services/convaiProvisionApi';

interface StudioProps {
  onClose?: () => void;
}

function RuntimeIaAgentSettingsTab() {
  const [cfg, setCfg] = React.useState(() => loadGlobalIaAgentConfig());

  const handleProvisionConvaiAgent = React.useCallback(async () => {
    if (cfg.convaiAgentId?.trim()) return;
    const fragment = conversationConfigFragmentFromIaAgentConfig(cfg);
    const { agentId } = await createConvaiAgentViaOmniaServer({
      name: 'Omnia · global IA defaults',
      ...(fragment ? { conversation_config: fragment } : {}),
    });
    const next = { ...cfg, platform: 'elevenlabs' as const, convaiAgentId: agentId };
    setCfg(next);
    saveGlobalIaAgentConfig(next);
  }, [cfg]);

  return (
    <div style={{ maxWidth: 960 }}>
      <p style={{ color: '#94a3b8', fontSize: 13, marginBottom: 16 }}>
        Default runtime motor for all IA agents in flows. Per-task overrides are configured in the Response
        Editor → tab &quot;IA Agent (runtime)&quot; on each AI Agent task.
      </p>
      <IAAgentSetup
        mode="global"
        listenConvaiTtsFix
        value={cfg}
        onChange={(next) => {
          setCfg(next);
          saveGlobalIaAgentConfig(next);
        }}
        onProvisionConvaiAgent={handleProvisionConvaiAgent}
      />
    </div>
  );
}

function StudioContent({ onClose }: StudioProps) {
  const { currentStep, setCurrentStep } = useBackendBuilder();
  const steps: Array<{ key: StepKey; label: string }> = [
    { key: 'omniaTutor', label: 'Omnia Tutor (IA interna)' },
    { key: 'iaAgentRuntime', label: 'Runtime IA Agent' },
    { key: 'font', label: 'Font' },
    { key: 'colors', label: 'Colors' },
  ];

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', display: 'grid', gridTemplateRows: '56px 1fr', background: '#0f1115' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', borderBottom: '1px solid #222', color: '#fff' }}>
        <div style={{ fontWeight: 700 }}>Impostazioni Omnia</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={onClose} style={{ padding: '6px 10px' }}>Close</button>
        </div>
      </header>
      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', minHeight: 0 }}>
        <aside style={{ borderRight: '1px solid #222', overflow: 'auto', padding: 12, color: '#ddd' }}>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 6 }}>
            {steps.map((s) => (
              <li key={s.key}>
                <button
                  type="button"
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
          {currentStep === 'omniaTutor' && <OmniaTutorSetup />}
          {currentStep === 'iaAgentRuntime' && <RuntimeIaAgentSettingsTab />}
          {currentStep === 'font' && <EditorFontPanel />}
          {currentStep === 'colors' && <EditorColorsPanel />}
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
