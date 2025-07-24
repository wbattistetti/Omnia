import React from 'react';

interface StepFinalReviewProps {
  typeInfo: { type: string; description: string };
  constraints: string[];
  prompts: {
    noInput: string;
    noMatch: string;
    explicitConfirmation: string;
    success: string;
    violations: { [constraintKey: string]: string };
  };
  onConfirm: () => void;
}

const StepFinalReview: React.FC<StepFinalReviewProps> = ({ typeInfo, constraints, prompts, onConfirm }) => {
  return (
    <div>
      <h3>Riepilogo DDT</h3>
      <div style={{ marginBottom: 16 }}>
        <strong>Tipo:</strong> {typeInfo.type}<br />
        <strong>Descrizione:</strong> {typeInfo.description}
      </div>
      <div style={{ marginBottom: 16 }}>
        <strong>Constraint:</strong>
        <ul>
          {constraints.map((c, i) => <li key={i}>{c}</li>)}
        </ul>
      </div>
      <div style={{ marginBottom: 16 }}>
        <strong>Prompt:</strong>
        <ul>
          <li>noInput: {prompts.noInput}</li>
          <li>noMatch: {prompts.noMatch}</li>
          <li>explicitConfirmation: {prompts.explicitConfirmation}</li>
          <li>success: {prompts.success}</li>
          {Object.entries(prompts.violations).map(([k, v]) => (
            <li key={k}>violation ({k}): {v}</li>
          ))}
        </ul>
      </div>
      <button onClick={onConfirm} style={{ marginTop: 16 }}>
        Crea DDT
      </button>
    </div>
  );
};

export default StepFinalReview; 