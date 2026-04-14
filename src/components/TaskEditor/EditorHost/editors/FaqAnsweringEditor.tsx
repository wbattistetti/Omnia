/**
 * FAQ Answering: ontology tree editor (Grammar / Faqs) with debounced task persistence.
 */

import React, { useRef, useState } from 'react';
import { Check, Loader2, MessageCircleQuestion } from 'lucide-react';
import { useProjectDataUpdate } from '@context/ProjectDataContext';
import type { EditorProps } from '../types';
import { useHeaderToolbarContext } from '../../ResponseEditor/context/HeaderToolbarContext';
import { FaqOntologyProvider } from './faqAnswering/FaqOntologyContext';
import OntologyTreeView from './faqAnswering/OntologyTreeView';
import OntologySidePanel from './faqAnswering/OntologySidePanel';
import { useFaqOntology } from './faqAnswering/FaqOntologyContext';
import OntologyInlineEditor from './faqAnswering/OntologyInlineEditor';
import { useOntologyTreeKeyboard } from './faqAnswering/useOntologyTreeKeyboard';

function FaqAnsweringEditorInner({ taskLabel }: { taskLabel?: string }) {
  useOntologyTreeKeyboard();
  const {
    treeName,
    setTreeName,
    editMode,
    setEditMode,
    alphabetical,
    setAlphabetical,
    debouncing,
    saving,
    selectedNodeId,
    clearSelection,
  } = useFaqOntology();

  const [renamingTree, setRenamingTree] = useState(false);
  const boundsRef = useRef<HTMLDivElement>(null);

  const busy = debouncing || saving;

  return (
    <div className="flex h-full min-h-0 flex-col bg-slate-900">
      <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-700 px-3 py-2">
        {renamingTree ? (
          <div className="min-w-[180px] max-w-md flex-1">
            <OntologyInlineEditor
              initialValue={treeName}
              validate={(v) => (!v.trim() ? 'Nome obbligatorio' : null)}
              onConfirm={(v) => {
                setTreeName(v.trim());
                setRenamingTree(false);
              }}
              onCancel={() => setRenamingTree(false)}
            />
          </div>
        ) : (
          <button
            type="button"
            className="truncate text-left text-sm font-semibold text-slate-100 hover:text-amber-200"
            onClick={() => setRenamingTree(true)}
          >
            {treeName || taskLabel || 'Ontologia'}
          </button>
        )}
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          {busy ? (
            <>
              <Loader2 size={14} className="animate-spin text-amber-400" />
              <span>Salvataggio…</span>
            </>
          ) : (
            <>
              <Check size={14} className="text-emerald-500" />
              <span className="text-emerald-600/90">Salvato</span>
            </>
          )}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            className={`rounded-md px-2.5 py-1 text-xs font-medium ${
              editMode
                ? 'bg-blue-950/80 text-blue-300 ring-1 ring-blue-700'
                : 'text-slate-400 hover:bg-slate-800'
            }`}
            onClick={() => setEditMode(!editMode)}
          >
            Modifica
          </button>
          <button
            type="button"
            className={`rounded-md px-2.5 py-1 text-xs font-medium ${
              alphabetical
                ? 'bg-teal-950/80 text-teal-300 ring-1 ring-teal-700'
                : 'text-slate-400 hover:bg-slate-800'
            }`}
            onClick={() => setAlphabetical(!alphabetical)}
          >
            A‑Z
          </button>
        </div>
      </header>

      <div
        ref={boundsRef}
        className="relative flex min-h-0 flex-1"
        onClick={() => clearSelection()}
      >
        <div
          className="min-h-0 min-w-0 flex-1 overflow-hidden pl-2 pr-1"
          onClick={(e) => e.stopPropagation()}
        >
          <OntologyTreeView />
        </div>
        {selectedNodeId ? (
          <div onClick={(e) => e.stopPropagation()} className="h-full min-h-0">
            <OntologySidePanel boundsRef={boundsRef} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function FaqAnsweringEditor({ task }: EditorProps) {
  const headerContext = useHeaderToolbarContext();
  const setHeaderIcon = headerContext?.setIcon;
  const setHeaderTitle = headerContext?.setTitle;
  const pdUpdate = useProjectDataUpdate();
  const projectId = pdUpdate?.getCurrentProjectId() || undefined;

  React.useEffect(() => {
    if (!setHeaderIcon || !setHeaderTitle) return;
    setHeaderIcon(<MessageCircleQuestion size={18} className="text-amber-400" />);
    setHeaderTitle(String(task?.label || 'FAQ Answering'));

    return () => {
      setHeaderIcon(null);
      setHeaderTitle(null);
    };
  }, [setHeaderIcon, setHeaderTitle, task?.label]);

  if (!task?.id) {
    return (
      <div className="flex flex-1 items-center justify-center bg-slate-900 text-sm text-slate-500">
        Task non disponibile
      </div>
    );
  }

  return (
    <FaqOntologyProvider taskId={task.id} projectId={projectId} taskLabel={task.label}>
      <FaqAnsweringEditorInner taskLabel={task.label} />
    </FaqOntologyProvider>
  );
}
