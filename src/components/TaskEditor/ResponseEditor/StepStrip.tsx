import React from 'react';
import SmartTooltip from '../../SmartTooltip';

interface StepStripProps {
  steps: string[];
  stepMeta: Record<string, { icon: React.ReactNode; label: string; border: string; bg: string; color: string; bgActive: string }>;
  selectedStep: string;
  onStepChange: (step: string) => void;
}

const STEP_TOOLTIPS: Record<string, string> = {
  start: 'Fase iniziale in cui il bot chiede il dato all’utente.\nPuoi configurare il testo della domanda e le azioni associate.',
  noMatch: 'Il bot entra qui quando non capisce la risposta dell’utente.\nPuoi modificare i messaggi e impostare il numero massimo di tentativi.',
  noInput: 'Fase analoga a NoMatch, ma attivata quando l’utente non risponde.\nAnche qui puoi gestire messaggi e tentativi.',
  confirmation: 'Il bot chiede all’utente di confermare il dato inserito.\nPuoi modificare i messaggi e aggiungere eventuali azioni.',
  success: 'Fase finale, quando il dato è stato acquisito con successo.\nIl bot può ringraziare o attivare altre azioni post-acquisizione.'
};

const StepStrip: React.FC<StepStripProps> = ({ steps, stepMeta, selectedStep, onStepChange }) => {
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
      {steps.map((step) => {
        const meta = stepMeta[step] || {};
        const isActive = selectedStep === step;
        return (
          <SmartTooltip
            key={step}
            text={STEP_TOOLTIPS[step] || 'Qui sotto vedere come il bot si comporta nelle varie situazioni.'}
            tutorId={`step_${step}`}
          >
            <button
              onClick={() => onStepChange(step)}
              style={{
                fontWeight: isActive ? 700 : 400,
                background: isActive ? meta.bgActive || meta.bg : meta.bg,
                color: isActive ? meta.color : (meta.color ? meta.color + '99' : '#a21caf99'),
                border: isActive ? `2px solid ${meta.border}` : `1px solid ${meta.border ? meta.border + '55' : '#a21caf55'}`,
                borderBottom: isActive ? `3px solid ${meta.border}` : `1px solid transparent`,
                borderRadius: 8,
                padding: '6px 18px 6px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                boxShadow: isActive ? `0 2px 8px 0 ${meta.border}22` : undefined,
                cursor: 'pointer',
                transition: 'background 0.15s, border 0.15s',
              }}
            >
              {meta.icon}
              {meta.label || step}
            </button>
          </SmartTooltip>
        );
      })}
    </div>
  );
};

export default StepStrip;