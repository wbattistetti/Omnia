/**

 * UI condivisa per scegliere il modello LLM designer — usata dentro {@link DesignerLlmSetupPanel}.

 */



import React from 'react';

import { ModelTreePicker } from '@components/common/ModelTreePicker';

import { LockPasswordPromptForm } from '@components/common/LockPasswordPromptForm';

import { designerLlmProviderSpecs } from './designerLlmProviders';

import {

  useDesignerLlmModelSelection,

  type DesignerLlmModelSelectionState,

  type UseDesignerLlmModelSelectionParams,

} from './useDesignerLlmModelSelection';



export interface DesignerLlmModelPickerUiProps {

  selection: DesignerLlmModelSelectionState;

  className?: string;

}



/** Solo UI — usa con {@link useDesignerLlmModelSelection} nel parent (Omnia Tutor + cost table). */

export function DesignerLlmModelPickerUi({

  selection,

  className = '',

}: DesignerLlmModelPickerUiProps): React.ReactElement {

  const providerSpecs = React.useMemo(() => designerLlmProviderSpecs(), []);



  const picker = (

    <>

      <ModelTreePicker

        value={selection.model}

        options={selection.modelOptions}

        providers={providerSpecs.map((p) => ({ id: p.id, label: p.displayLabel }))}

        disabled={selection.modelsLoading && !selection.hasModelOptions}

        placeholder={

          selection.modelsLoading && !selection.hasModelOptions

            ? 'Caricamento modelli…'

            : 'Scegli un modello'

        }

        onChange={(modelId) => selection.requestSelectModel(modelId)}

      />

      {selection.model && !selection.modelOptions.some((o) => o.id === selection.model) ? (

        <span className="block text-[10px] leading-tight text-amber-300">

          Modello salvato {`"${selection.model}"`} non nel catalogo live — selezionane uno disponibile.

        </span>

      ) : null}

      {selection.errorSummary ? (

        <span className="block text-[10px] leading-tight text-red-300">

          Catalogo incompleto — {selection.errorSummary}

        </span>

      ) : null}

      {!selection.modelsLoading && !selection.hasModelOptions && !selection.errorSummary ? (

        <span className="block text-[10px] leading-tight text-amber-300">

          Catalogo vuoto: verifica le API key sul backend.

        </span>

      ) : null}

      {selection.pendingUnlock ? (

        <div

          role="region"

          aria-label="Sblocco modello premium"

          className="sm:col-span-12 rounded-md border border-amber-700/60 bg-amber-950/25 px-3 py-2"

        >

          <LockPasswordPromptForm

            modelId={selection.pendingUnlock.modelId}

            providerId={selection.pendingUnlock.providerId}

            onSubmit={selection.handlePendingUnlockSubmit}

            onCancel={selection.handlePendingUnlockCancel}

          />

        </div>

      ) : null}

    </>

  );



  return (

    <label className={`space-y-1 sm:col-span-6 ${className}`.trim()}>

      <span className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-slate-500">

        <span>

          Modello {selection.hasModelOptions ? `(${selection.modelOptions.length})` : ''}

        </span>

        <button

          type="button"

          onClick={selection.reloadModels}

          className="rounded border border-slate-700 bg-slate-800 px-2 py-0.5 text-[10px] text-slate-200 hover:bg-slate-700 disabled:opacity-50"

          disabled={selection.modelsLoading}

          title="Ricarica la lista live dal catalogo backend"

        >

          {selection.modelsLoading ? 'Caricamento…' : 'Ricarica'}

        </button>

      </span>

      {picker}

    </label>

  );

}



export interface DesignerLlmModelSelectorProps extends UseDesignerLlmModelSelectionParams {

  className?: string;

}



/** Hook + UI in un componente (legacy — preferire {@link DesignerLlmSetupPanel}). */

export function DesignerLlmModelSelector({

  className = '',

  ...selectionParams

}: DesignerLlmModelSelectorProps): React.ReactElement {

  const selection = useDesignerLlmModelSelection(selectionParams);

  return <DesignerLlmModelPickerUi selection={selection} className={className} />;

}



export {

  useDesignerLlmModelSelection,

  DESIGNER_LLM_COST_LOCK_THRESHOLD_EUR,

} from './useDesignerLlmModelSelection';

