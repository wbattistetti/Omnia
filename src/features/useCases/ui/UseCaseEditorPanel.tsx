import React from 'react';
import type { UseCase, UseCaseRunResult } from '../model';
import { UseCaseTree } from './UseCaseTree';
import { UseCaseRunResultView } from './UseCaseRunResultView';
import { UseCaseToolbar } from '../toolbar/UseCaseToolbar';
import { type UseCaseGlobalStyleId } from './useCaseGlobalStyles';

/**
 * Side panel that hosts use-case tree and run results.
 */
export function UseCaseEditorPanel(props: {
  useCases: UseCase[];
  selectedUseCaseId: string | null;
  onSelectUseCase: (id: string) => void;
  onCreateRootUseCase: (title: string) => Promise<void>;
  onCreateChildUseCase: (parentPath: string, title: string) => Promise<void>;
  onRenameUseCase: (id: string, nextKey: string) => void;
  onRenameFolder: (folderPath: string, nextSegment: string) => void;
  onDeleteNode: (fullPath: string, useCaseId?: string) => void;
  onMoveUseCaseToFolder: (id: string, folderPath: string) => void;
  onCreateRelativeUseCase: (targetPath: string, mode: 'before' | 'after' | 'child') => void;
  editIntentUseCaseId?: string | null;
  onConsumeEditIntentUseCaseId?: () => void;
  onRunUseCase: (id: string) => void;
  onSaveNote: (id: string, note: string) => void;
  runResults: UseCaseRunResult[];
  globalStyleId: UseCaseGlobalStyleId;
  onGlobalStyleIdChange: (styleId: UseCaseGlobalStyleId) => void;
  isGenerating: boolean;
  generationMessage: string;
  generationError: string | null;
  onDismissGenerationError: () => void;
  onClosePanel: () => void;
}) {
  const [rootDraft, setRootDraft] = React.useState('');

  return (
    <div className="h-full flex flex-col bg-slate-950 text-slate-100">
      <UseCaseToolbar
        globalStyleId={props.globalStyleId}
        onGlobalStyleIdChange={props.onGlobalStyleIdChange}
        onClosePanel={props.onClosePanel}
      />
      <div className="px-2 py-2 border-b border-slate-800">
        <input
          type="text"
          value={rootDraft}
          onChange={(e) => setRootDraft(e.target.value)}
          disabled={props.isGenerating}
          placeholder="Nuovo use case radice... (ENTER per creare)"
          className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-100 placeholder:text-slate-500"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              const value = rootDraft.trim();
              if (!value) return;
              void props.onCreateRootUseCase(value).then(() => setRootDraft('')).catch(() => {});
            } else if (e.key === 'Escape') {
              setRootDraft('');
            }
          }}
        />
      </div>
      {props.isGenerating ? (
        <div className="px-2 py-2 text-xs text-violet-200 border-b border-violet-800/60 bg-violet-950/35">
          {props.generationMessage}
        </div>
      ) : null}
      {props.generationError ? (
        <div className="px-2 py-2 text-xs text-red-200 border-b border-red-800/60 bg-red-950/35 flex items-center justify-between gap-2">
          <span className="break-words">{props.generationError}</span>
          <button
            type="button"
            onClick={props.onDismissGenerationError}
            className="underline text-red-200 hover:text-red-100"
          >
            Chiudi
          </button>
        </div>
      ) : null}
      <div className="flex-1 min-h-0 overflow-auto p-2">
        <UseCaseTree
          useCases={props.useCases}
          selectedId={props.selectedUseCaseId}
          onSelect={props.onSelectUseCase}
          onCreateChildUseCase={props.onCreateChildUseCase}
          onRenameUseCase={props.onRenameUseCase}
          onRenameFolder={props.onRenameFolder}
          onDeleteNode={props.onDeleteNode}
          onMoveToFolder={props.onMoveUseCaseToFolder}
          onCreateRelativeUseCase={props.onCreateRelativeUseCase}
          editIntentUseCaseId={props.editIntentUseCaseId}
          onConsumeEditIntentUseCaseId={props.onConsumeEditIntentUseCaseId}
          onRun={(id) => props.onRunUseCase(id)}
          onSaveNote={props.onSaveNote}
        />
      </div>
      <div className="border-t border-slate-800 p-2 space-y-2 max-h-[44%] overflow-auto">
        <UseCaseRunResultView results={props.runResults} />
      </div>
    </div>
  );
}

