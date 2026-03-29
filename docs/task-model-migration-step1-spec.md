# Task model migration — Step 1: data model & invariants (SPEC only)

This document fixes the **contract** for the gradual migration toward standalone instances, instance+template, promotion, and `MaterializationOrchestrator`.  
**No implementation** is required for Step 1; later steps introduce `kind`, persistence fields, and orchestration code.

---

## 1.1 Grounding in current code (summary)

| Area | Current behavior relevant to migration |
|------|----------------------------------------|
| **`Task` (`taskTypes.ts`)** | `templateId: string \| null`; comments state structure/constraints/dataContract come from template; `steps` on instance; `source?: TemplateSource`; `subTasksIds?` for templates. No `kind`, no persisted `nodes` on instance. |
| **`TaskRepository`** | `createTask(type, templateId, …)` allows `templateId === null`. Bulk save filters: rows with truthy `templateId` = treated as instances; `templateId === null` + `source !== Factory` = project template rows; Factory-sourced templates excluded from project bulk. |
| **`DialogueTaskService`** | In-memory template cache: Factory load + `registerExternalTemplates` for project. `getTemplate(id)` required for materialization paths. |
| **`buildTaskTree` / `taskUtils.ts`** | If instance has no `templateId`, `ensureTemplateExists` creates a project template and sets `instance.templateId`. Materialized `TaskTree` takes **nodes** from template, **steps** from instance or clone; **constraints/dataContract** from template. Comments describe instance-only nodes as future/alternate wording. |
| **Wizard** | Creates per-node templates in cache (`createTemplatesFromStructures` + `addTemplate`), then instance with `templateId = rootTemplate.id`. |
| **ResponseEditor** | Consumes `TaskTree` from materialization; save flows use task + template cache (e.g. save to Factory). |

The target model **extends** persistence and semantics; it does not claim the current DB already stores standalone `nodes` on instances.

---

## 1.2 Four row roles (`kind`)

`kind` is the **primary discriminator** for validation and materialization. Values:

| `kind` | Meaning |
|--------|---------|
| `standalone` | Design-time / runtime task row that owns local schema and behavior **without** referencing a project template aggregate. |
| `instance` | Task row that **references** a template root via `templateId` (clone/adapt/promotion result). |
| `projectTemplate` | Reusable definition row stored in the **project** (persisted with project tasks). |
| `factoryTemplate` | Definition living in the **Factory** catalog (may exist only in `DialogueTaskService` cache + Factory DB, not necessarily as a project task row). |

### A. `kind = "standalone"`

| Invariant | Spec |
|-----------|------|
| `templateId` | **`null`** (must not reference a template root). |
| `nodes` | **Persisted on the row** under a dedicated field (see §1.4), e.g. `instanceNodes` / JSON tree aligned with `TaskTreeNode[]` shape. |
| `steps` | **Persisted** (`Task.steps` dictionary); keys are **stable node ids** from the instance tree (not template ids until after promotion). |
| `contracts` / `constraints` | **Persisted on the row** (dedicated fields or nested under instance schema), not resolved from cache template. |
| `source` | Typically **unset** or `Project`; not `Factory` for this row’s role as an instance. |

**Explicit non-goals for standalone:** no automatic template creation; no generalization; no recursive template split until user runs **Save as template**.

### B. `kind = "instance"`

| Invariant | Spec |
|-----------|------|
| `templateId` | **Required GUID** — id of the **root** template row or root template document the instance follows. |
| `nodes` | **Not persisted** on the instance; **derived** from template(s) in cache / DB (`buildTaskTreeNodes` / equivalent). |
| `steps` | **Persisted** on the instance; override dictionary keyed by **template node id** (per-node template id in the resolved tree), consistent with today. |
| `contracts` / `constraints` | **Not** authoritative on the instance; **read from template** at materialization. |
| `kind` | **`instance`** after promotion or when creating “from template”. |

### C. `kind = "projectTemplate"`

| Invariant | Spec |
|-----------|------|
| `templateId` | **`null`** (row **is** the template definition, same convention as today for template rows). |
| `nodes` | **Persisted** (structure: `subTasksIds` + per-child template rows **or** aggregated tree + children templates — implementation detail, but **schema lives on template side**). |
| `steps` | **Optional** on template; used for defaults when cloning new instances; editor may show template steps. |
| `contracts` / `constraints` | **Persisted** on template (and/or on child template rows per node). |
| `source` | **`Project`** or omitted (legacy = project). |

### D. `kind = "factoryTemplate"`

Same persistence shape as `projectTemplate` where a row exists; **source** distinguishes catalog:

| Invariant | Spec |
|-----------|------|
| `source` | **`Factory`** when the definition is Factory-owned. |
| Persistence | May be **cache-only** for catalog entries not duplicated as project tasks; spec allows both **row in project** vs **cache-only** — **must be documented per deployment** when implementing save paths. |

---

## 1.3 Field → where it lives (authoritative source)

| Field / concern | `standalone` | `instance` | `projectTemplate` | `factoryTemplate` |
|-----------------|--------------|------------|---------------------|-------------------|
| **`kind`** | `standalone` | `instance` | `projectTemplate` | `factoryTemplate` |
| **`templateId`** | `null` | **GUID** (root) | `null` | `null` (for row-as-template) |
| **Structure (`nodes` / tree)** | **Instance row** (`instanceNodes` or agreed name) | **Derived from template** | **Template row(s)** | **Template** (Factory store/cache) |
| **`steps`** | **Instance** | **Instance** (overrides) | **Template** (optional defaults) | **Template** (optional) |
| **`constraints`** | **Instance** (until promotion) | **Template** | **Template** | **Template** |
| **`dataContract` / contracts** | **Instance** (until promotion) | **Template** | **Template** | **Template** |
| **`source`** | Project / unset | Project / unset | `Project` typical | **`Factory`** |
| **`subTasksIds`** | N/A or empty | **Undefined** on instance | **On root template row** | **On root template** |

**`kind` is mandatory** for all new writes once the migration is active; **legacy rows** may omit it and rely on **`inferTaskKind`** (Step 2) until backfilled.

---

## 1.4 New vs existing fields (contract)

### Already exist (no rename required for Step 1)

- `id`, `type`, `templateId`, `templateVersion`, `source`, `steps`, `labelKey`, `subTasksIds`, `createdAt`, `updatedAt`, AI-agent fields, etc.

### New (to be introduced in later steps — names indicative)

| Field | Purpose |
|-------|---------|
| **`kind`** | `'standalone' \| 'instance' \| 'projectTemplate' \| 'factoryTemplate'` |
| **`instanceNodes`** (or `instanceSchema`) | Persisted tree for **standalone** only (and optionally snapshot during migration). |
| **`instanceDataContracts`** / **`instanceConstraints`** | Per-node or flat map keyed by node id for **standalone** schema before promotion. |

Exact JSON shapes should match existing **`TaskTreeNode`** / `DataContract` types where possible to limit adapter code.

### Deprecated comments (conceptual)

- Comments in `taskTypes.ts` stating “every task must have templateId” and “no standalone” are **superseded** by this spec for **new** data; legacy data remains valid via inference rules.

---

## 1.5 Invariants at load / save

### Load

1. If `kind` **present**: validate consistency with `templateId` and `source` (see table below).  
2. If `kind` **absent**: infer via `inferTaskKind` (Step 2) — **read-only** until backfill.  
3. **`standalone`**: must have persisted instance schema fields if the editor opens structural UI; `templateId` must be `null`.  
4. **`instance`**: `templateId` must be non-null GUID; template root must be resolvable for materialization (cache or load).  
5. **`projectTemplate` / `factoryTemplate`**: `templateId === null` on the template row; structure on template side.

**Consistency matrix (validation)**

| kind | Allowed `templateId` | Allowed `source` (typical) |
|------|----------------------|----------------------------|
| `standalone` | `null` only | Project / omitted |
| `instance` | non-null GUID | Project / omitted |
| `projectTemplate` | `null` | Project / omitted |
| `factoryTemplate` | `null` (if row exists) | **`Factory`** |

### Save

1. **Reject** impossible combinations (e.g. `kind: standalone` + non-null `templateId` unless mid-transaction promotion uses a dedicated transaction flag — prefer **two-phase** promotion API).  
2. **Bulk save (`TaskRepository`)**: extend rules so **`standalone`** (`templateId === null` + `kind === standalone`) is **not** misclassified as `projectTemplate`. Current code uses `templateId` truthiness for “instance”; **new discriminator `kind` is required** to avoid collision.  
3. **Promotion (later step)**: atomic sequence: create template rows → update instance → clear instance-only schema fields → set `kind = instance` and `templateId = root`.

---

## 1.6 Relationship to `MaterializationOrchestrator` (preview)

| `kind` | Materialization branch (later) |
|--------|----------------------------------|
| `standalone` | Build `TaskTree` from **instance** schema + steps only (no `getTemplate` for structure). |
| `instance` | Current **`buildTaskTree`** / instance+template pipeline. |
| `projectTemplate` / `factoryTemplate` | Template editing / preview; may reuse same builder as template-opened-in-editor. |

---

## 1.7 Rollback / risk (Step 1 only)

- **Risk:** None for production code — this is documentation-only.  
- **Rollback:** N/A.  
- **Next step (Step 2):** Add optional `kind` + `inferTaskKind` + unit tests; still no change to save semantics.

---

*Document version: Step 1 — SPEC only. Implementation starts at Step 2 per migration plan.*

---

## Implementation status (incremental)

| Step | Status | Notes |
|------|--------|--------|
| 2 | Done | `Task.kind?`, `TaskKind`, `inferTaskKind` / `isStandalone` / `hasLocalSchema` in `src/utils/taskKind.ts`; tests in `src/utils/__tests__/taskKind.test.ts`. |
| 3 | Done (minimal) | `instanceNodes`, `instanceSchemaContracts` on `Task`; `buildStandaloneTaskTreeView` in `src/utils/buildStandaloneTaskTreeView.ts`; tests. |
| 4 | Done (minimal) | `materializeTask` in `src/utils/MaterializationOrchestrator.ts`; non-standalone paths still call `buildTaskTree`. |
| UI probe | Done | `TaskKindBadge` in ResponseEditor header (`TaskKindBadge.tsx`) shows inferred label (e.g. Instance, Project template). |
| Orchestrator wiring | Done | `materializeTaskFromRepository` in `MaterializationOrchestrator.ts`; `buildTaskTreeFromRepository` delegates to it; `DDTHostAdapter` loads via orchestrator. Dock (`hideHeader`): disabled toolbar pill with task kind before Manuale/Wizard. |
| Save → standalone snapshot | Done | `saveTask` + `standaloneInstanceSnapshot.ts`: persists `kind` + `instanceNodes` when `shouldPersistStandaloneInstanceSnapshot`. |
| buildTaskTree / extractTaskOverrides | Done | Standalone branch: no `ensureTemplateExists`; `extractTaskOverrides` writes `kind` + `instanceNodes`. Tests: `taskUtilsStandaloneBranch.test.ts`. |
| Wizard instance-first | Done | `persistWizardInstanceFirstRow` after wizard completion (orchestrator + legacy hooks). Flag `WIZARD_INSTANCE_FIRST`: **default on in dev**, overridable via `localStorage`; `WizardInstanceFirstBanner`. |
| Promote standalone → project template | Done (MVP) | `promoteStandaloneToProjectTemplate.ts`: POST templates post-order, `subTasksIds` for composites; instance row → `kind: instance`. UI: `PromoteStandaloneToTemplateButton` + dock toolbar. `TaskRepository.updateTask` option `allowClearTemplateId`. |
| Public barrel | Done | `src/utils/taskModelMigration.ts` re-exports orchestrator, kind helpers, standalone view, wizard persist, promotion. |

