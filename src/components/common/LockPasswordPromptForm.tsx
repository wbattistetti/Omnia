/**
 * `LockPasswordPromptForm` — form inline per sbloccare un'azione gated da password.
 *
 * Componente puramente di presentazione: non conosce il "perché" del lock né dove
 * vive nello stato applicativo. Riceve un callback `onSubmit(password)` che valida
 * la password e restituisce `true` solo in caso di successo. Su successo il form
 * non si chiude da solo: la chiusura è responsabilità del parent (che a sua volta
 * sa cosa fare dopo lo sblocco — selezionare un modello, abilitare un bottone, ecc.).
 *
 * Decisioni UX (designer 2026-05-13):
 *  - Auto-focus sull'input alla mount: il prompt è transitorio, non costringere a click extra.
 *  - Enter → submit, Esc → cancel: pattern standard per piccoli prompt modali.
 *  - Errore "Password errata" inline accanto ai bottoni, non in popup.
 *  - Bottoni: "Sblocca" (primary, ambra) + "Annulla" (secondary, slate).
 *
 * Riutilizzato da:
 *  - `CostComparatorTable` come sub-row sotto la riga premium.
 *  - `OmniaTutorSetup` come gate del `ModelTreePicker` (selezione di modelli > soglia).
 */

import React from 'react';
import { Lock, Unlock } from 'lucide-react';

export interface LockPasswordPromptFormProps {
  /** Etichetta breve del modello sbloccando, mostrata nel testo guida. */
  readonly modelId: string;
  /** Provider del modello, usato solo per `aria-label` del form. */
  readonly providerId: string;
  /**
   * Validatore della password. Restituisce `true` per sblocco riuscito (il parent
   * dovrebbe poi smontare il prompt o resettare lo stato che lo ha aperto).
   * Restituendo `false` il form mostra "Password errata" inline senza chiudersi.
   */
  readonly onSubmit: (password: string) => boolean;
  /** Chiude il prompt senza sblocco (Esc o click "Annulla"). */
  readonly onCancel: () => void;
}

export function LockPasswordPromptForm({
  modelId,
  providerId,
  onSubmit,
  onCancel,
}: LockPasswordPromptFormProps): React.ReactElement {
  const [value, setValue] = React.useState<string>('');
  const [error, setError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = React.useCallback((): void => {
    const ok = onSubmit(value);
    if (!ok) setError('Password errata.');
  }, [onSubmit, value]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        handleSubmit();
      }}
      className="flex flex-wrap items-center gap-2"
      aria-label={`Sblocca ${providerId}/${modelId}`}
    >
      <Lock size={12} className="shrink-0 text-amber-300" aria-hidden />
      <span className="text-[11px] text-amber-100">
        Per sbloccare <span className="font-mono">{modelId}</span> inserisci la password:
      </span>
      <input
        ref={inputRef}
        type="password"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          if (error) setError(null);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            onCancel();
          }
        }}
        aria-label="Password di sblocco"
        aria-invalid={error !== null}
        className="h-7 w-40 rounded-md border border-amber-700/60 bg-slate-950 px-2 text-[12px] text-slate-100 focus:border-amber-400/70 focus:outline-none focus:ring-1 focus:ring-amber-400/50"
        placeholder="password"
      />
      <button
        type="submit"
        className="inline-flex h-7 items-center gap-1.5 rounded-md border border-amber-600 bg-amber-700/40 px-2 text-[11px] font-semibold text-amber-50 hover:bg-amber-700/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60"
      >
        <Unlock size={12} aria-hidden />
        Sblocca
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="inline-flex h-7 items-center rounded-md border border-slate-600 bg-slate-800 px-2 text-[11px] text-slate-200 hover:bg-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
      >
        Annulla
      </button>
      {error ? (
        <span role="alert" className="text-[11px] font-semibold text-rose-300">
          {error}
        </span>
      ) : null}
    </form>
  );
}
