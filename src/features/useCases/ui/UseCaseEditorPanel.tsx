import React from 'react';
import type { UseCase, UseCaseRunResult } from '../model';
import { UseCaseTree } from './UseCaseTree';
import { UseCaseRunResultView } from './UseCaseRunResultView';
import { UseCaseToolbar } from '../toolbar/UseCaseToolbar';

/**
 * Side panel that hosts use-case tree and run results.
 */
export function UseCaseEditorPanel(props: {
  useCases: UseCase[];
  selectedUseCaseId: string | null;
  onSelectUseCase: (id: string) => void;
  onCreateUseCase: () => void;
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
  onClosePanel: () => void;
}) {
  return (
    <div className="h-full flex flex-col bg-slate-950 text-slate-100">
      <UseCaseToolbar onCreateUseCase={props.onCreateUseCase} onClosePanel={props.onClosePanel} />
      <div className="flex-1 min-h-0 overflow-auto p-2">
        <UseCaseTree
          useCases={props.useCases}
          selectedId={props.selectedUseCaseId}
          onSelect={props.onSelectUseCase}
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

