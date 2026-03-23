# AI Agent editor module (design-time)

Self-contained UI and logic for editing **AI Agent** tasks: repository sync, LLM generation, proposed fields table, and **use case composer** (per-scenario dialogue via `AIAgentPreviewChatPanel` + `useCaseDialogueBridge`). There is no separate global “anteprima dialogo” tab: chat is always tied to the selected use case. `agentPreviewByStyle` from design generation is still persisted for compatibility. Flow variable bulk-link / **Implement** was removed from the UI (linking TBD); `agentDesignFrozen` is cleared on save (`false`).

## Layout (Dockview)

**Single** Dockview in `AIAgentEditorDockShell`: tutti i pannelli restano peer e trascinabili; il layout **iniziale** è a due gruppi dopo la creazione.

- **Pre-generazione**: **solo** la tab **Descrizione · designer** (nessun dato / use case / sezioni IA finché non si crea l’agent).
- **Post-generazione**: **gruppo sinistro** — un’unica strip di tab: descrizione designer (refine, bordo/teal nel corpo pannello) + Behavior, vincoli, … + Prompt finale. **Gruppo destro** — tab **Dati da raccogliere** e **Use case** (visibile solo se `showRightPanel`).

Changing phase or right-column visibility **remounts** the dock (`layoutKey`), so custom splits reset on phase change (by design for now).

`useAgentStructuredDockSlice` + `AIAgentStructuredSectionsDockPanels` leggono lo stato strutturato sia dal contesto editor unificato sia dal vecchio `AIAgentStructuredSectionsDockProvider` (usato da `AIAgentStructuredSectionsPanel` se riutilizzato altrove, es. `AIAgentLeftColumn`).

`AIAgentStructuredSectionsDockview` resta solo per quel percorso legacy annidato, non per `AIAgentEditor.tsx`.

Legacy column components (`AIAgentLeftColumn`, `AIAgentRightPanel`, …) non sono collegati a `AIAgentEditor.tsx`.

## Phases

1. **Create**: single natural-language description + **Create Agent**.
2. **Structured**: dockable section editors; **Prompt finale** as a dock panel; composed Markdown read-only.
3. **Refine**: **Refine comportamento** sends `sectionRefinements` in `/design/ai-agent-generate`; IA can return per-section diffs.

## Persistence

- `agentStructuredSectionsJson`: per-section `{ base, deletedMask, inserts }`.
- `agentPrompt`: composed Markdown snapshot for runtime (kept in sync with structured state).
- `agentDesignDescription`: refine context; editable after create.

## Files

- **Shell**: `../AIAgentEditor.tsx` composes dock shell and hooks only.
- **Outer dock**: `AIAgentEditorDockShell`, `AIAgentEditorDockContext`, `AIAgentEditorDockPanels`.
- **Pure/domain**: `buildTaskSnapshot`, `mergeDesignFromApi`, `structuredSectionPersist`, `composeRuntimePromptMarkdown`, `revisionStateToPersisted`, `buildPersistPatch`.
- **Hooks**: `useAIAgentEditorController`, `useStructuredAgentSectionsRevision`, `useAIAgentToolbarController`.
