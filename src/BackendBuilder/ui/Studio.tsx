import React from 'react';
import { BackendBuilderProvider, useBackendBuilder, type StepKey } from '../state/BackendBuilderContext';
import { OmniaTutorSetup } from '@components/settings/OmniaTutorSetup';
import { IAAgentSetup } from '@components/settings/IAAgentSetup';
import { EditorFontPanel } from '@components/settings/EditorFontPanel';
import { EditorColorsPanel } from '@components/settings/EditorColorsPanel';
import { saveGlobalIaAgentConfig } from '@utils/iaAgentRuntime/globalIaAgentPersistence';
import { getDefaultConfig } from '@utils/iaAgentRuntime/platformHelpers';
import {
  normalizeIAAgentConfig,
  serializeIaAgentConfigForTaskPersistence,
} from '@utils/iaAgentRuntime/iaAgentConfigNormalize';
import { conversationConfigFragmentFromIaAgentConfig } from '@utils/iaAgentRuntime/convaiAgentCreatePayload';
import { createConvaiAgentViaOmniaServer } from '@services/convaiProvisionApi';
import { fetchIaAgentGlobalConfig, putIaAgentGlobalConfig } from '@services/iaAgentGlobalConfigApi';
import type { IAAgentConfig } from 'types/iaAgentRuntimeSetup';

/** Progetto senza blob salvato: partiamo da ElevenLabs così TTS, combo e mapping sono in vista (Omnia ConvAI). */
const STUDIO_IA_EMPTY_DEFAULT: IAAgentConfig['platform'] = 'elevenlabs';

interface StudioProps {
  onClose?: () => void;
  /** Progetto aperto: richiesto per salvare i default IA su Mongo (`project_meta`). */
  projectId?: string;
}

type SaveUi = 'idle' | 'saving' | 'saved' | 'error';
type LoadUi = 'loading' | 'ready' | 'error';

function SaveSpinner() {
  return (
    <span
      aria-hidden
      style={{
        display: 'inline-block',
        width: 16,
        height: 16,
        marginRight: 8,
        border: '2px solid rgba(255,255,255,0.25)',
        borderTopColor: '#fff',
        borderRadius: '50%',
        verticalAlign: 'middle',
        animation: 'omniaStudioSpin 0.7s linear infinite',
      }}
    />
  );
}

function RuntimeIaAgentSettingsTab(props: {
  projectId?: string;
  cfg: IAAgentConfig;
  onChange: (next: IAAgentConfig) => void;
  onSave: () => void | Promise<void>;
  loadState: LoadUi;
  loadError: string | null;
  dirty: boolean;
  saveState: SaveUi;
  saveError: string | null;
}) {
  const {
    projectId,
    cfg,
    onChange,
    onSave,
    loadState,
    loadError,
    dirty,
    saveState,
    saveError,
  } = props;

  const handleProvisionConvaiAgent = React.useCallback(async () => {
    if (cfg.convaiAgentId?.trim()) return;
    let fragment: Record<string, unknown>;
    try {
      fragment = conversationConfigFragmentFromIaAgentConfig(cfg)!;
    } catch (e) {
      console.error('[Studio] ConvAI createAgent: impossibile costruire il payload (prompt runtime vuoto)', e);
      return;
    }
    const { agentId } = await createConvaiAgentViaOmniaServer({
      name: 'Omnia · global IA defaults',
      conversation_config: fragment,
    });
    const next = { ...cfg, platform: 'elevenlabs' as const, convaiAgentId: agentId };
    onChange(next);
    const json = serializeIaAgentConfigForTaskPersistence(next);
    if (projectId?.trim()) {
      const put = await putIaAgentGlobalConfig(projectId, json);
      if (!put.ok) {
        console.error('[Studio] persist dopo createAgent:', put.error);
        return;
      }
    }
    try {
      saveGlobalIaAgentConfig(next);
    } catch (e) {
      console.error('[Studio] cache locale dopo createAgent:', e);
    }
  }, [cfg, onChange, projectId]);

  const statusColor = saveState === 'error' ? '#f87171' : saveState === 'saved' ? '#34d399' : dirty ? '#fbbf24' : '#94a3b8';
  const statusText =
    saveState === 'saving'
      ? 'Salvataggio sul database in corso…'
      : saveState === 'saved'
        ? 'Salvato nel progetto (Mongo).'
        : saveState === 'error'
          ? saveError ?? 'Errore salvataggio'
          : dirty
            ? 'Modifiche non salvate — clicca Salva configurazione.'
            : projectId
              ? 'Allineato al database di progetto.'
              : 'Nessun progetto aperto: il salvataggio scrive solo nella cache browser.';

  if (loadState === 'loading') {
    return (
      <div style={{ maxWidth: 960, color: '#94a3b8', fontSize: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
        <SaveSpinner />
        Caricamento configurazione dal database…
      </div>
    );
  }

  if (loadState === 'error') {
    return (
      <div style={{ maxWidth: 960 }}>
        <div style={{ color: '#f87171', fontSize: 13, lineHeight: 1.6, padding: '16px', borderRadius: 8, border: '1px solid #7f1d1d', background: '#450a0a' }}>
          <strong>Impossibile caricare la configurazione dal database.</strong><br />
          {loadError}<br /><br />
          Assicurati che Express sia in esecuzione:<br />
          <code style={{ background: '#1e293b', padding: '2px 6px', borderRadius: 3 }}>npm run be:express</code>
          <br /><br />
          Poi chiudi e riapri questo pannello.
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 960 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 16,
          paddingBottom: 12,
          borderBottom: '1px solid #334155',
        }}
      >
        <div style={{ fontSize: 12, color: statusColor, flex: 1, minWidth: 0 }}>
          {statusText}
        </div>
        <button
          type="button"
          onClick={() => void onSave()}
          disabled={saveState === 'saving' || loadState !== 'ready'}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            flexShrink: 0,
            padding: '8px 16px',
            borderRadius: 8,
            border: 'none',
            fontWeight: 600,
            fontSize: 13,
            cursor: saveState === 'saving' ? 'wait' : 'pointer',
            background: saveState === 'error' ? '#b91c1c' : '#7c3aed',
            color: '#fff',
            opacity: saveState === 'saving' ? 0.85 : 1,
            minWidth: 200,
            justifyContent: 'center',
          }}
        >
          {saveState === 'saving' ? (
            <>
              <SaveSpinner />
              Salvataggio…
            </>
          ) : (
            'Salva configurazione'
          )}
        </button>
      </div>
      <p style={{ color: '#94a3b8', fontSize: 13, marginBottom: 16 }}>
        Default runtime per gli agenti IA. Con un progetto aperto, valore e salvataggio sono nel database del
        progetto; al riaprire le impostazioni si rileggono da lì. Override per task nel Response Editor → tab IA
        Agent.
      </p>
      <div
        style={{
          pointerEvents: saveState === 'saving' ? 'none' : 'auto',
          opacity: saveState === 'saving' ? 0.55 : 1,
          transition: 'opacity 0.15s',
        }}
      >
        <IAAgentSetup
          mode="global"
          listenConvaiTtsFix
          value={cfg}
          onChange={onChange}
          onProvisionConvaiAgent={handleProvisionConvaiAgent}
        />
      </div>
    </div>
  );
}

function StudioContent({ onClose, projectId }: StudioProps) {
  const { currentStep, setCurrentStep } = useBackendBuilder();
  const [iaCfg, setIaCfg] = React.useState<IAAgentConfig>(() => getDefaultConfig(STUDIO_IA_EMPTY_DEFAULT));
  const [iaDirty, setIaDirty] = React.useState(false);
  const [iaLoad, setIaLoad] = React.useState<LoadUi>('loading');
  const [iaLoadErr, setIaLoadErr] = React.useState<string | null>(null);
  const [saveState, setSaveState] = React.useState<SaveUi>('idle');
  const [saveErr, setSaveErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!projectId?.trim()) {
        setIaLoadErr('Nessun progetto aperto. Apri un progetto per caricare la configurazione.');
        setIaLoad('error');
        return;
      }
      setIaLoad('loading');
      setIaLoadErr(null);
      const r = await fetchIaAgentGlobalConfig(projectId);
      if (cancelled) return;
      if (!r.ok) {
        setIaLoadErr(r.error);
        setIaLoad('error');
        return;
      }
      if (r.configJson?.trim()) {
        try {
          const parsed = JSON.parse(r.configJson) as unknown;
          setIaCfg(normalizeIAAgentConfig(parsed));
        } catch {
          setIaCfg(getDefaultConfig(STUDIO_IA_EMPTY_DEFAULT));
        }
      } else {
        setIaCfg(getDefaultConfig(STUDIO_IA_EMPTY_DEFAULT));
      }
      setIaDirty(false);
      setIaLoad('ready');
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const handleSaveIaGlobal = React.useCallback(async () => {
    setSaveState('saving');
    setSaveErr(null);
    const json = serializeIaAgentConfigForTaskPersistence(iaCfg);
    if (projectId?.trim()) {
      const put = await putIaAgentGlobalConfig(projectId, json);
      if (!put.ok) {
        setSaveErr(
          `${put.error} — Verifica che il backend Express sia su porta 3100 (dev: npm run be:express).`
        );
        setSaveState('error');
        return;
      }
      try {
        saveGlobalIaAgentConfig(iaCfg);
      } catch (e) {
        setSaveErr(e instanceof Error ? e.message : String(e));
        setSaveState('error');
        return;
      }
    } else {
      try {
        saveGlobalIaAgentConfig(iaCfg);
      } catch (e) {
        setSaveErr(e instanceof Error ? e.message : String(e));
        setSaveState('error');
        return;
      }
    }
    setIaDirty(false);
    setSaveState('saved');
    window.setTimeout(() => setSaveState('idle'), 2800);
  }, [projectId, iaCfg]);

  const steps: Array<{ key: StepKey; label: string }> = [
    { key: 'omniaTutor', label: 'Omnia Tutor (IA interna)' },
    { key: 'iaAgentRuntime', label: 'Runtime IA Agent' },
    { key: 'font', label: 'Font' },
    { key: 'colors', label: 'Colors' },
  ];

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', display: 'grid', gridTemplateRows: '56px 1fr', background: '#0f1115' }}>
      <style>{`@keyframes omniaStudioSpin { to { transform: rotate(360deg); } }`}</style>
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
          {currentStep === 'iaAgentRuntime' && (
            <RuntimeIaAgentSettingsTab
              projectId={projectId}
              cfg={iaCfg}
              onChange={(next) => {
                setIaCfg(next);
                setIaDirty(true);
                setSaveState('idle');
              }}
              onSave={handleSaveIaGlobal}
              loadState={iaLoad}
              loadError={iaLoadErr}
              dirty={iaDirty}
              saveState={saveState}
              saveError={saveErr}
            />
          )}
          {currentStep === 'font' && <EditorFontPanel />}
          {currentStep === 'colors' && <EditorColorsPanel />}
        </main>
      </div>
    </div>
  );
}

export default function BackendBuilderStudio({ onClose, projectId }: StudioProps) {
  return (
    <BackendBuilderProvider>
      <StudioContent onClose={onClose} projectId={projectId} />
    </BackendBuilderProvider>
  );
}
