// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { useRef } from 'react';
import type { TaskTree } from '../../../../types/taskTypes';

export interface UseResponseEditorRefsParams {
  taskTree: TaskTree | null | undefined;
  task: any;
}

export interface UseResponseEditorRefsResult {
  // ✅ FASE 2.3: taskTreeRef rimosso - non più necessario (store è single source of truth)
  prevInstanceRef: React.MutableRefObject<string | undefined>;
  contractChangeRef: React.MutableRefObject<{
    hasUnsavedChanges: boolean;
    modifiedContract: any;
    originalContract: any;
    nodeTemplateId: string | undefined;
    nodeLabel: string | undefined;
  }>;
  rootRef: React.RefObject<HTMLDivElement>;
  preAssembledTaskTreeCache: React.MutableRefObject<Map<string, { taskTree: any; _templateTranslations: Record<string, { en: string; it: string; pt: string }> }>>;
  wizardOwnsDataRef: React.MutableRefObject<boolean>;
  sidebarStartWidthRef: React.MutableRefObject<number>;
  sidebarStartXRef: React.MutableRefObject<number>;
  tasksStartWidthRef: React.MutableRefObject<number>;
  tasksStartXRef: React.MutableRefObject<number>;
}

/**
 * Hook that provides all refs for ResponseEditor.
 */
export function useResponseEditorRefs(params: UseResponseEditorRefsParams): UseResponseEditorRefsResult {
  // ✅ FASE 2.3: taskTreeRef rimosso - non più necessario (store è single source of truth)

  // Inizializza prevInstanceRef per tracciare cambio istanza
  const prevInstanceRef = useRef<string | undefined>(undefined);

  // Ref per accedere allo stato delle modifiche da RecognitionEditor
  const contractChangeRef = useRef<{
    hasUnsavedChanges: boolean;
    modifiedContract: any;
    originalContract: any;
    nodeTemplateId: string | undefined;
    nodeLabel: string | undefined;
  }>({
    hasUnsavedChanges: false,
    modifiedContract: null,
    originalContract: null,
    nodeTemplateId: undefined,
    nodeLabel: undefined
  });

  const rootRef = useRef<HTMLDivElement>(null);

  // Cache globale per TaskTree pre-assemblati (per templateId)
  // Key: templateId (es. "723a1aa9-a904-4b55-82f3-a501dfbe0351")
  // Value: { taskTree, _templateTranslations }
  const preAssembledTaskTreeCache = useRef<Map<string, { taskTree: any; _templateTranslations: Record<string, { en: string; it: string; pt: string }> }>>(new Map());

  // Ref per controllare ownership del wizard sui dati (creato prima per essere passato a entrambi gli hook)
  const wizardOwnsDataRef = useRef(false);

  // Sidebar drag state
  const sidebarStartWidthRef = useRef<number>(0);
  const sidebarStartXRef = useRef<number>(0);
  const tasksStartWidthRef = useRef<number>(0);
  const tasksStartXRef = useRef<number>(0);

  return {
    prevInstanceRef,
    contractChangeRef,
    rootRef,
    preAssembledTaskTreeCache,
    wizardOwnsDataRef,
    sidebarStartWidthRef,
    sidebarStartXRef,
    tasksStartWidthRef,
    tasksStartXRef,
  };
}
