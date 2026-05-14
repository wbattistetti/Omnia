# AI Agent editor module (design-time)

Self-contained UI and logic for editing **AI Agent** tasks: repository sync, LLM generation, proposed fields table, and **use case composer** (per-scenario dialogue via `AIAgentPreviewChatPanel` + `useCaseDialogueBridge`). There is no separate global “anteprima dialogo” tab: chat is always tied to the selected use case. `agentPreviewByStyle` from design generation is still persisted for compatibility. Flow variable bulk-link / **Implement** was removed from the UI (linking TBD); `agentDesignFrozen` is cleared on save (`false`).

## Layout (Construction Wizard)

Post-unificazione layout: il Task Editor AI Agent ha un **unico shell**, il
`AIAgentConstructionWizardShell` (vedi `constructionWizard/`). Il vecchio
`AIAgentEditorDockShell` (Dockview classic) è stato rimosso: tutti i task — sia nuovi
sia legacy con `hasAgentGeneration=true` — sono renderizzati nel wizard.

- **Stepper**: 5 step lineari (Task → Prompts → Backend → Dati → Voce) + bottone
  "Costi" e slot opzionale "Deploy" a destra.
- **Pannelli interni**: i `Editor*Panel` di `AIAgentEditorDockPanels.tsx` sono ancora
  usati, ma istanziati direttamente dal renderer dello step (non più tramite Dockview).
  Ricevono i dati dal `AIAgentEditorDockProvider` (single source of truth).
- **Backward-compat**: `agentConstructionPhase === 'edit'` sui dati storici viene
  normalizzato a `'wizard'` dal resolver (vedi
  `domain/aiAgentConstruction/agentConstructionPhase.ts`).
- **Veterani**: per `hasAgentGeneration === true` lo stepper passa `bypassGating=true`,
  quindi tutti gli step sono cliccabili senza vincolo di ordine.

`useAgentStructuredDockSlice` + `AIAgentStructuredSectionsDockPanels` leggono lo stato
strutturato sia dal contesto editor unificato sia dal vecchio
`AIAgentStructuredSectionsDockProvider` (usato da `AIAgentStructuredSectionsPanel` se
riutilizzato altrove, es. `AIAgentLeftColumn`).

`AIAgentStructuredSectionsDockview` resta solo per quel percorso legacy annidato, non
per `AIAgentEditor.tsx`.

Legacy column components (`AIAgentLeftColumn`, `AIAgentRightPanel`, …) non sono
collegati a `AIAgentEditor.tsx`.

## Phases

1. **Create**: single natural-language description + **Create Agent**.
2. **Structured**: dockable section editors; **Prompt finale** as a dock panel; composed Markdown read-only.
3. **Refine**: **Refine comportamento** sends `sectionRefinements` in `/design/ai-agent-generate`; IA can return per-section diffs.

## Persistence

- `agentStructuredSectionsJson`: per-section `{ base, deletedMask, inserts }`.
- `agentPrompt`: composed Markdown snapshot for runtime (kept in sync with structured state).
- `agentDesignDescription`: refine context; editable after create.

## Files

- **Shell**: `../AIAgentEditor.tsx` composes wizard shell and hooks only.
- **Wizard shell + stepper**: `constructionWizard/AIAgentConstructionWizardShell`, `constructionWizard/AIAgentConstructionStepper`, `constructionWizard/AIAgentWelcomeTutor`, `constructionWizard/AIAgentDeployMenu`.
- **Step panels** (riusabili): `AIAgentEditorDockContext`, `AIAgentEditorDockPanels` (Editor*Panel).
- **Pure/domain**: `buildTaskSnapshot`, `mergeDesignFromApi`, `structuredSectionPersist`, `composeRuntimePromptMarkdown`, `revisionStateToPersisted`, `buildPersistPatch`.
- **Hooks**: `useAIAgentEditorController`, `useStructuredAgentSectionsRevision`, `useAIAgentToolbarController`.
