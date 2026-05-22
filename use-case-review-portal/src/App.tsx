/**

 * Portale review: elenco pubblicazioni Omnia, workspace con composer identico.

 */



import React from 'react';

import { useReviewStore } from './reviewStore';

import type { ReviewChannelListItem } from './reviewApi';

import { ReviewUseCaseWorkspace } from './ReviewUseCaseWorkspace';
import { isReviewTokenError } from './reviewAuth';



function ReviewHome() {

  const catalog = useReviewStore((s) => s.catalog);

  const loading = useReviewStore((s) => s.catalogLoading);

  const error = useReviewStore((s) => s.catalogError);

  const loadCatalog = useReviewStore((s) => s.loadCatalog);

  const openSession = useReviewStore((s) => s.openSession);

  const accessError = Boolean(error && isReviewTokenError(error));



  React.useEffect(() => {

    void loadCatalog();

  }, [loadCatalog]);



  const formatDate = (iso: string | null) => {

    if (!iso) return '—';

    try {

      return new Date(iso).toLocaleString('it-IT');

    } catch {

      return iso;

    }

  };



  return (

    <div className="mx-auto max-w-2xl p-6">

      <header className="mb-6">

        <h1 className="text-2xl font-bold text-white">Review use case</h1>

        <p className="mt-1 text-sm text-slate-400">

          Scegli una review pubblicata da Omnia. Nessun ID da ricordare.

        </p>

      </header>



      <div className="mb-4 flex items-center gap-2">

        <button

          type="button"

          onClick={() => void loadCatalog()}

          disabled={loading}

          className="rounded border border-slate-600 px-3 py-1.5 text-sm hover:bg-slate-800 disabled:opacity-50"

        >

          {loading ? 'Aggiorno…' : 'Aggiorna elenco'}

        </button>

      </div>



      {error && !accessError ? <p className="mb-4 text-sm text-rose-300">{error}</p> : null}

      {accessError ? (
        <div className="mb-4 rounded-lg border border-amber-600/50 bg-amber-950/40 p-4">
          <p className="text-sm text-amber-100">
            Non è possibile accedere alle review in questo momento. Verifica che Omnia sia avviato
            (<code className="text-amber-200">npm run dev:beNew</code>) e riprova tra qualche secondo.
          </p>
          <button
            type="button"
            className="mt-3 rounded border border-amber-500/60 px-3 py-1.5 text-sm text-amber-100 hover:bg-amber-900/40"
            onClick={() => void loadCatalog()}
          >
            Riprova
          </button>
        </div>
      ) : null}

      {catalog.length === 0 && !loading && !accessError ? (

        <p className="rounded-lg border border-dashed border-slate-600 p-8 text-center text-slate-500">

          Nessuna review pubblicata. In Omnia apri il task agente e premi <strong>Pubblica</strong>.

        </p>

      ) : null}



      <ul className="space-y-2">

        {catalog.map((item) => (

          <ReviewListCard key={`${item.projectId}:${item.taskInstanceId}`} item={item} onOpen={() => openSession(item)} />

        ))}

      </ul>

    </div>

  );



  function ReviewListCard({

    item,

    onOpen,

  }: {

    item: ReviewChannelListItem;

    onOpen: () => void;

  }) {

    return (

      <li>

        <button

          type="button"

          onClick={onOpen}

          className="w-full rounded-lg border border-slate-700 bg-slate-900/60 px-4 py-3 text-left transition hover:border-violet-500/50 hover:bg-slate-800/80"

        >

          <div className="font-medium text-slate-100">{item.taskLabel || 'Task agente'}</div>

          <div className="mt-1 text-sm text-slate-400">{item.projectLabel}</div>

          <div className="mt-2 flex gap-3 text-xs text-slate-500">

            <span>{item.useCaseCount} use case</span>

            <span>{formatDate(item.updatedAt)}</span>

          </div>

        </button>

      </li>

    );

  }

}



/** Deep link opzionale: ?projectId=&taskId= apre direttamente la sessione. */

function useDeepLinkSession() {

  const openSession = useReviewStore((s) => s.openSession);

  const session = useReviewStore((s) => s.session);

  const ran = React.useRef(false);



  React.useEffect(() => {

    if (ran.current || session) return;

    const q = new URLSearchParams(window.location.search);

    const projectId = q.get('projectId')?.trim();

    const taskId = q.get('taskId')?.trim();

    if (!projectId || !taskId) return;

    ran.current = true;

    openSession({

      projectId,

      taskInstanceId: taskId,

      taskLabel: q.get('taskLabel')?.trim() || taskId,

      projectLabel: q.get('projectLabel')?.trim() || projectId,

      updatedAt: null,

      useCaseCount: 0,

    });

  }, [openSession, session]);

}



export default function App() {

  const session = useReviewStore((s) => s.session);

  useDeepLinkSession();



  if (session) return <ReviewUseCaseWorkspace />;

  return <ReviewHome />;

}

