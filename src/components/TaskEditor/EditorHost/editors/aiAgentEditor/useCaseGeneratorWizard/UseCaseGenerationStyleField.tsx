/**
 * Campo stile per la generazione use case (pannello DX passo 1): mostra il contratto
 * effettivo inviato alle API e consente modifiche prima di «Crea altri use case».
 */

import React from 'react';

export type UseCaseGenerationStyleFieldProps = {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
};

export function UseCaseGenerationStyleField({
  value,
  onChange,
  disabled = false,
}: UseCaseGenerationStyleFieldProps): React.ReactElement {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor="uc-wizard-generation-style-contract"
        className="block text-[11px] font-medium text-slate-400"
      >
        Stile per la prossima generazione
      </label>
      <p className="text-[10px] leading-snug text-slate-500">
        Usato per creare o estendere gli use case. Modifica prima di premere «Crea altri use case».
      </p>
      <textarea
        id="uc-wizard-generation-style-contract"
        rows={4}
        spellCheck
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full min-h-[88px] resize-y rounded-md border border-slate-600/80 bg-slate-950/90 px-2.5 py-2 text-xs leading-relaxed text-slate-200 placeholder:text-slate-600 focus:border-transparent focus:ring-2 focus:ring-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
        aria-label="Stile per la generazione use case"
      />
    </div>
  );
}
