/**

 * Aggiorna agente ConvAI ElevenLabs: prompt completo, tool webhook catalogo, documenti KB.

 */



import React from 'react';

import { Bot, Loader2, RefreshCw, Trash2 } from 'lucide-react';

import Modal from '@components/Modal';

import type { ConvaiAgentSyncParams } from '@domain/convai/convaiAgentSyncTypes';

import { syncConvaiAgentFromOmnia } from '@services/syncConvaiAgentFromOmnia';

import { deleteConvaiAgentViaOmniaServer } from '@services/convaiProvisionApi';

import { listConvaiAgentsForWorkspace } from '@workspaces/elevenlabs/api/convaiAgentApi';

import { planKbDocumentsForConvaiUpload } from '@domain/convai/resolveKbTextForConvaiUpload';
import type { ConvaiAgentSyncResult } from '@domain/convai/convaiAgentSyncTypes';



export type SyncElevenLabsAgentDialogProps = {

  open: boolean;

  onClose: () => void;

  /** Parametri sync (agente, use case, catalogo, KB). */

  syncParams: ConvaiAgentSyncParams | null;

  onSynced?: (result: ConvaiAgentSyncResult) => void;

  elevatedOverlay?: boolean;

};



export function SyncElevenLabsAgentDialog({

  open,

  onClose,

  syncParams,

  onSynced,

  elevatedOverlay = false,

}: SyncElevenLabsAgentDialogProps): React.ReactElement {

  const [agents, setAgents] = React.useState<readonly { agentId: string; name: string }[]>([]);

  const [selectedAgentId, setSelectedAgentId] = React.useState('');

  const [newAgentName, setNewAgentName] = React.useState('');

  const [loadingAgents, setLoadingAgents] = React.useState(false);

  const [deletingAgent, setDeletingAgent] = React.useState(false);

  const [syncing, setSyncing] = React.useState(false);

  const [error, setError] = React.useState<string | null>(null);

  const [compileErrors, setCompileErrors] = React.useState<string[]>([]);



  const backendCount =

    syncParams?.manualCatalogBackendTaskIds?.length ??

    syncParams?.backendCatalog?.manualEntries?.length ??

    0;

  const kbPlan = React.useMemo(
    () => planKbDocumentsForConvaiUpload(syncParams?.knowledgeBaseDocuments),
    [syncParams?.knowledgeBaseDocuments]
  );
  const kbCandidateCount = kbPlan.length;
  const kbLocalTextCount = kbPlan.filter((p) => p.hasLocalText).length;

  const useNewAgent = newAgentName.trim().length > 0;

  const canSync = Boolean(syncParams) && (useNewAgent || Boolean(selectedAgentId.trim()));



  const loadAgents = React.useCallback(async () => {

    setLoadingAgents(true);

    setError(null);

    try {

      const page = await listConvaiAgentsForWorkspace({ pageSize: 100 });

      setAgents(page.agents);

      if (page.agents.length === 1) {

        setSelectedAgentId((prev) => prev || page.agents[0].agentId);

      }

    } catch (e) {

      setAgents([]);

      setError(e instanceof Error ? e.message : String(e));

    } finally {

      setLoadingAgents(false);

    }

  }, []);



  const wasOpenRef = React.useRef(false);

  React.useEffect(() => {

    const justOpened = open && !wasOpenRef.current;

    wasOpenRef.current = open;

    if (!justOpened) return;



    setError(null);

    setCompileErrors([]);

    setSyncing(false);

    setNewAgentName('');

    setSelectedAgentId('');

    void loadAgents();

  }, [open, loadAgents]);



  const handleSync = React.useCallback(async () => {

    if (!syncParams) return;

    setSyncing(true);

    setError(null);

    setCompileErrors([]);

    try {

      const trimmedNew = newAgentName.trim();

      const out = await syncConvaiAgentFromOmnia({

        ...syncParams,

        ...(trimmedNew ? { newAgentName: trimmedNew } : { agentId: selectedAgentId }),

      });

      if (!out.ok) {

        setError(out.failure.message);

        if (out.failure.compileErrors?.length) {

          setCompileErrors(out.failure.compileErrors);

        }

        return;

      }

      onSynced?.(out.result);

      onClose();

    } finally {

      setSyncing(false);

    }

  }, [newAgentName, onClose, onSynced, selectedAgentId, syncParams]);



  const handleDeleteSelectedAgent = React.useCallback(async () => {

    const agentId = selectedAgentId.trim();

    if (!agentId) return;

    const agent = agents.find((a) => a.agentId === agentId);

    const label = agent?.name?.trim() ? `${agent.name} (${agentId})` : agentId;

    if (

      !window.confirm(

        `Eliminare l’agente ConvAI «${label}» da ElevenLabs?\n\nL’operazione è irreversibile.`

      )

    ) {

      return;

    }

    setDeletingAgent(true);

    setError(null);

    try {

      await deleteConvaiAgentViaOmniaServer(agentId);

      setAgents((prev) => prev.filter((a) => a.agentId !== agentId));

      setSelectedAgentId('');

    } catch (e) {

      setError(e instanceof Error ? e.message : String(e));

    } finally {

      setDeletingAgent(false);

    }

  }, [agents, selectedAgentId]);



  return (

    <Modal

      isOpen={open}

      onClose={onClose}

      title="Aggiorna agente ElevenLabs"

      isLoading={syncing}

      overlayClassName={elevatedOverlay ? 'z-[70]' : 'z-50'}

    >

      <div className="space-y-4">

        {!syncParams ? (

          <p className="rounded-lg border border-amber-800/50 bg-amber-950/35 px-3 py-2 text-sm text-amber-100">

            Apri il dialog dal task AI Agent (Prompt completo o tab Backends) per sincronizzare prompt,

            webhook e knowledge base.

          </p>

        ) : (

          <p className="text-sm text-slate-300">

            Scrive su ElevenLabs il <span className="text-violet-200">prompt completo</span> (use case +

            backend + KB),{' '}

            <span className="text-violet-200">

              {backendCount > 0 ? `${backendCount} webhook` : 'webhook catalogo'}

            </span>

            {kbCandidateCount > 0 ? (

              <>

                {' '}

                e{' '}

                <span className="text-violet-200">

                  {kbCandidateCount} documenti KB

                  {kbLocalTextCount < kbCandidateCount

                    ? ` (${kbLocalTextCount} in memoria, altri dal repository al sync)`

                    : ''}

                </span>

              </>

            ) : null}

            . Su agente esistente: refresh completo (prompt, tool_ids, knowledge_base).

          </p>

        )}



        <label className="block text-xs font-semibold text-violet-200/95">

          Crea nuovo agente

          <input

            type="text"

            value={newAgentName}

            onChange={(e) => setNewAgentName(e.target.value)}

            disabled={syncing || !syncParams}

            placeholder="Nome del nuovo agente ConvAI"

            className="mt-1 w-full rounded-lg border border-violet-500/45 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-violet-400 focus:outline-none focus:ring-1 focus:ring-violet-500/40 disabled:opacity-50"

          />

        </label>

        {useNewAgent ? (

          <p className="text-[11px] text-violet-200/80">

            Verrà creato un agente nuovo con prompt, tool e KB già configurati.

          </p>

        ) : null}



        <div className="border-t border-slate-700/80 pt-3">

          <div className="mb-2 flex items-center justify-between gap-2">

            <span className="text-xs font-semibold text-slate-400">Agenti esistenti</span>

            <button

              type="button"

              onClick={() => void loadAgents()}

              disabled={loadingAgents || syncing || deletingAgent}

              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-700 disabled:opacity-50"

            >

              {loadingAgents ? (

                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />

              ) : (

                <RefreshCw className="h-3.5 w-3.5" aria-hidden />

              )}

              Aggiorna elenco

            </button>

          </div>

          <label className="block text-xs font-medium text-slate-400">

            Agente ConvAI

            <div className="mt-1 flex gap-2">

              <select

                value={selectedAgentId}

                onChange={(e) => setSelectedAgentId(e.target.value)}

                disabled={syncing || loadingAgents || deletingAgent || useNewAgent || !syncParams}

                className="min-w-0 flex-1 rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100 disabled:opacity-50"

              >

                <option value="">— Seleziona agente —</option>

                {agents.map((a) => (

                  <option key={a.agentId} value={a.agentId}>

                    {a.name?.trim() ? `${a.name} (${a.agentId})` : a.agentId}

                  </option>

                ))}

              </select>

              <button

                type="button"

                title="Elimina agente selezionato"

                aria-label="Elimina agente selezionato"

                disabled={

                  !selectedAgentId.trim() ||

                  syncing ||

                  loadingAgents ||

                  deletingAgent ||

                  useNewAgent

                }

                onClick={() => void handleDeleteSelectedAgent()}

                className="inline-flex shrink-0 items-center justify-center rounded-lg border border-rose-800/60 px-3 py-2 text-rose-300 hover:bg-rose-950/40 disabled:opacity-50"

              >

                {deletingAgent ? (

                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />

                ) : (

                  <Trash2 className="h-4 w-4" aria-hidden />

                )}

              </button>

            </div>

          </label>

          {useNewAgent ? (

            <p className="mt-1 text-[11px] text-slate-500">

              Il menu è disattivato finché è valorizzato il nome del nuovo agente.

            </p>

          ) : null}

        </div>



        {error ? (

          <p className="rounded-lg border border-rose-800/60 bg-rose-950/50 px-3 py-2 text-xs text-rose-200">

            {error}

          </p>

        ) : null}



        {compileErrors.length > 0 ? (

          <ul className="max-h-32 overflow-y-auto rounded-lg border border-amber-800/50 bg-amber-950/30 px-3 py-2 text-xs text-amber-100">

            {compileErrors.slice(0, 12).map((line) => (

              <li key={line} className="font-mono">

                {line}

              </li>

            ))}

            {compileErrors.length > 12 ? (

              <li className="text-amber-300/80">…altri {compileErrors.length - 12} errori</li>

            ) : null}

          </ul>

        ) : null}



        <div className="flex justify-end gap-2 border-t border-slate-700/80 pt-3">

          <button

            type="button"

            onClick={onClose}

            disabled={syncing}

            className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-50"

          >

            Annulla

          </button>

          <button

            type="button"

            disabled={!canSync || syncing || loadingAgents || deletingAgent}

            onClick={() => void handleSync()}

            className="inline-flex items-center gap-2 rounded-lg border border-violet-600/70 bg-violet-950/50 px-4 py-2 text-sm font-medium text-violet-100 hover:bg-violet-900/60 disabled:opacity-50"

          >

            {syncing ? (

              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />

            ) : (

              <Bot className="h-4 w-4" aria-hidden />

            )}

            Aggiorna agente

          </button>

        </div>

      </div>

    </Modal>

  );

}



/** @deprecated Usare {@link SyncElevenLabsAgentDialog}. */

export { SyncElevenLabsAgentDialog as PublishElevenLabsWebhookDialog };


