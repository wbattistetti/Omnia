import React, { Suspense } from 'react';
import { registry } from './editorRegistry';
import { resolveEditorKind } from './resolveKind';
import type { EditorProps } from './types';
import { HeaderToolbarProvider } from '../ResponseEditor/context/HeaderToolbarContext';
// ✅ RIMOSSO: getAgentActVisualsByType - non più usato in questo file

export default function TaskEditorHost({ task, dockTabId, onClose, onToolbarUpdate, hideHeader, registerOnClose, setDockTree }: EditorProps) {
  const kind = resolveEditorKind(task);

  // ✅ LOG DISABILITATO - troppo rumoroso (si attiva ad ogni render)
  // console.log('[TaskEditorHost] Resolving editor', {
  //   taskId: task?.id,
  //   taskType: task?.type,
  //   taskLabel: task?.label,
  //   editorKind: kind
  // });

  const Comp = registry[kind];

  if (!Comp) {
    console.error('❌ [TaskEditorHost] No component registered for kind:', kind, {
      taskType: task?.type,
      availableKinds: Object.keys(registry)
    });
    return <div>No editor registered for {kind}</div>;
  }

  // ✅ LOG DISABILITATO - troppo rumoroso (si attiva ad ogni render)
  // console.log('[TaskEditorHost] Rendering component', {
  //   kind,
  //   componentName: Comp.displayName || Comp.name || 'Unknown'
  // });

  // DDTEditor, IntentEditor, TextMessageEditor e BackendCallEditor sono importati direttamente, quindi non hanno bisogno di Suspense
  // Gli altri editori (problem, simple, aiagent, summarizer, negotiation) usano lazy loading, quindi hanno bisogno di Suspense
  const isLazy = kind !== 'ddt' && kind !== 'intent' && kind !== 'message' && kind !== 'backend' && kind !== 'problem' && kind !== 'aiagent' && kind !== 'summarizer' && kind !== 'negotiation';

  // Prefer dock tab id when docked: avoids remount + key collision when task is briefly empty during dock layout updates.
  const editorInstanceKey = dockTabId ?? task?.id ?? 'unknown';

  // ✅ ARCHITECTURE: Wrap with HeaderToolbarProvider to support header injection from editors
  const editorContent = !isLazy ? (
    // ✅ SOLUZIONE ESPERTO: Rimuovere h-full, usare solo flex-1 min-h-0
    <div className="w-full bg-slate-900 flex flex-col flex-1 min-h-0 h-full">
      <div className="min-h-0 flex-1 h-full">
        {/* @ts-expect-error registry type */}
        <Comp
          key={editorInstanceKey}
          task={task}
          dockTabId={dockTabId}
          onClose={onClose}
          onToolbarUpdate={onToolbarUpdate}
          hideHeader={hideHeader}
          registerOnClose={registerOnClose}
          setDockTree={setDockTree}
        />
      </div>
    </div>
  ) : (
    // Suspense per lazy components
    // ✅ SOLUZIONE ESPERTO: Rimuovere h-full, usare solo flex-1 min-h-0
    <div className="w-full bg-slate-900 flex flex-col flex-1 min-h-0 h-full">
      <div className="min-h-0 flex-1 h-full">
        <Suspense fallback={
          <div className="flex items-center justify-center bg-slate-900 flex-1 min-h-0">
            <div className="text-white text-sm">
              <div className="animate-pulse">Loading editor...</div>
            </div>
          </div>
        }>
          {/* @ts-expect-error lazy component */}
          <Comp
            key={editorInstanceKey}
            task={task}
            dockTabId={dockTabId}
            onClose={onClose}
            onToolbarUpdate={onToolbarUpdate}
            hideHeader={hideHeader}
            registerOnClose={registerOnClose}
            setDockTree={setDockTree}
          />
        </Suspense>
      </div>
    </div>
  );

  // ✅ ARCHITECTURE: Provide HeaderToolbarContext for editors that need to inject header content
  // Note: This is only for editors opened via TaskEditorHost (not ResponseEditorLayout which already has the provider)
  return (
    <HeaderToolbarProvider>
      {editorContent}
    </HeaderToolbarProvider>
  );
}


