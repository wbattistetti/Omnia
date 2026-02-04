# Layer Architecture Diagram

## Complete System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           PRESENTATION LAYER                            │
│                                                                         │
│  ┌──────────────────────┐  ┌──────────────────────┐                    │
│  │   TaskTreeWizard     │  │    ResponseEditor    │                    │
│  │   (UI Component)     │  │   (Editor Component) │                    │
│  └──────────┬───────────┘  └──────────┬───────────┘                    │
│             │                          │                                │
│             │ User Input               │ Edit & Refine                  │
│             │                          │                                │
└─────────────┼──────────────────────────┼────────────────────────────────┘
              │                          │
              │                          │
┌─────────────▼──────────────────────────▼────────────────────────────────┐
│                        ORCHESTRATOR LAYER                               │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │         executeGenerationPlan.ts                                 │  │
│  │                                                                  │  │
│  │  - Coordinates all generation steps                             │  │
│  │  - Manages progress reporting                                    │  │
│  │  - Handles errors and retries                                    │  │
│  │  - ONLY layer with side effects (API calls, persistence)          │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                         │
└─────────────┬───────────────────────────────────────────────────────────┘
              │
              │ Delegates to specialized layers
              │
    ┌─────────┼─────────┬──────────┬──────────┬──────────┐
    │         │         │          │          │          │
┌───▼───┐ ┌──▼───┐ ┌───▼───┐ ┌───▼───┐ ┌───▼───┐ ┌───▼───┐
│CONTRACT│ │ENGINE│ │ESCALAT│ │CONSTR │ │ TEST  │ │MESSAG │
│ LAYER  │ │LAYER │ │ LAYER │ │ LAYER │ │ LAYER │ │ LAYER │
└───┬───┘ └──┬───┘ └───┬───┘ └───┬───┘ └───┬───┘ └───┬───┘
    │        │         │         │         │         │
    │        │         │         │         │         │
┌───▼───────────────────────────────────────────────────▼───┐
│                    CONTRACT BUILDING                      │
│                                                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │readEntity    │  │readSubgroup │  │buildSubgroups│   │
│  │Properties    │  │Properties   │  │              │   │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘   │
│         │                 │                  │            │
│         └─────────────────┼──────────────────┘            │
│                           │                               │
│                  ┌────────▼────────┐                      │
│                  │  buildEntity.ts │                      │
│                  │  (Orchestrator)  │                      │
│                  └──────────────────┘                      │
└────────────────────────────────────────────────────────────┘
```

## Layer Details

### 1. Presentation Layer

**Components:**
- `TaskTreeWizard`: Main UI for creating TaskTrees
- `ResponseEditor`: Editor for refining generated TaskTrees

**Responsibilities:**
- User interaction
- UI state management
- Progress visualization

**No Business Logic**: Pure presentation

---

### 2. Orchestrator Layer

**File:** `src/utils/wizard/executeGenerationPlan.ts`

**Responsibilities:**
- Coordinates all generation steps
- Manages execution order
- Handles errors and retries
- Reports progress
- **ONLY layer with side effects**

**Dependencies:**
- All other layers (Contract, Engine, Test, etc.)

**Functions:**
```typescript
executeGenerationPlan(
  plan: GenerationPlan,
  tree: TaskTreeNode[],
  progressCallback?: (progress: GenerationProgress) => void
): Promise<NodeGenerationResult[]>
```

---

### 3. Contract Layer

**Files:**
- `src/utils/contract/readEntityProperties.ts`
- `src/utils/contract/readSubgroupProperties.ts`
- `src/utils/contract/buildSubgroups.ts`
- `src/utils/contract/buildEntity.ts`

**Responsibilities:**
- Extract properties from TaskTree nodes
- Build semantic contract structures
- Handle canonical formats
- Maintain stable ordering

**Pure Functions**: No side effects

**Flow:**
```
TaskTreeNode
  → readEntityProperties()
  → readSubgroupProperties()
  → buildSubgroups()
  → buildEntity()
  → SemanticContract
```

---

### 4. Engine Layer

**Files:**
- `src/utils/wizard/proposeEngines.ts`
- `src/utils/wizard/generateEngines.ts`

**Responsibilities:**
- Propose appropriate engines for nodes
- Generate engine configurations
- Handle engine types (Regex, NER, LLM, Heuristic)

**Engine Types:**
- `regex`: Pattern-based matching
- `ner`: Named Entity Recognition
- `llm`: Large Language Model inference
- `heuristic`: Rule-based matching

---

### 5. Escalation Layer

**Files:** Integrated in `generateEngines.ts`

**Responsibilities:**
- Generate escalation strategies
- Provide fallback when no engine matches
- Handle escalation levels

---

### 6. Constraint Layer

**Files:** `src/utils/wizard/generateContract.ts` (includes constraints)

**Responsibilities:**
- Generate validation constraints
- Create constraint rules
- AI-powered constraint generation

---

### 7. Test Layer

**Files:** `src/utils/wizard/generateTestExamples.ts`

**Responsibilities:**
- Generate positive test examples
- Generate negative test examples
- Create validation test suite

---

### 8. Messaging Layer

**Files:** Integrated in wizard pipeline

**Responsibilities:**
- Generate user-facing messages
- Handle translations
- Multi-language support

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    USER INPUT                                │
│              "Chiedi la data di nascita"                     │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│              TaskTreeWizard (UI)                            │
│  - Captures user input                                      │
│  - Shows progress                                            │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│              analyzeTree()                                   │
│  - Analyzes TaskTree structure                              │
│  - Identifies nodes needing generation                       │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│              buildGenerationPlan()                           │
│  - Creates execution plan                                    │
│  - Orders generation steps                                   │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│         executeGenerationPlan() (ORCHESTRATOR)              │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │  For each node in plan:                            │    │
│  │                                                     │    │
│  │  1. generateContract() → Contract Layer            │    │
│  │  2. generateEngines() → Engine Layer               │    │
│  │  3. generateTestExamples() → Test Layer           │    │
│  │  4. Generate messages → Messaging Layer            │    │
│  └────────────────────────────────────────────────────┘    │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│              Complete TaskTree                              │
│  - Contract                                                 │
│  - Engines                                                  │
│  - Tests                                                    │
│  - Messages                                                 │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│              ResponseEditor                                │
│  - Edit and refine                                          │
│  - Save to database                                         │
└─────────────────────────────────────────────────────────────┘
```

---

## Layer Interaction Rules

### Rules

1. **Orchestrator is the only entry point** for generation
2. **Layers don't call each other directly** (except Orchestrator)
3. **Pure functions** in all layers except Orchestrator
4. **Side effects** only in Orchestrator layer
5. **Testability** - each layer can be tested independently

### Dependency Flow

```
Orchestrator
  ↓
  ├─→ Contract Layer (independent)
  ├─→ Engine Layer (independent)
  ├─→ Test Layer (independent)
  └─→ Messaging Layer (independent)
```

**No cross-layer dependencies** - layers are independent

---

## Module Size Limits

Following architectural rules:

- **Max 200 lines per file**
- **Max 40 lines per function**
- **Single responsibility per module**

Current status:
- ✅ All wizard modules: < 200 lines
- ✅ All contract modules: < 200 lines
- ✅ All functions: < 40 lines

---

## Future Architecture

### Planned Enhancements

```
┌─────────────────────────────────────────────────────────────┐
│                    API GATEWAY                                │
│  - Rate limiting                                             │
│  - Authentication                                            │
└───────────────────────┬─────────────────────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        │               │               │
┌───────▼──────┐ ┌──────▼──────┐ ┌──────▼──────┐
│  GENERATION  │ │   CONTRACT   │ │   ENGINE    │
│   SERVICE    │ │   SERVICE    │ │   SERVICE   │
└──────────────┘ └──────────────┘ └─────────────┘
```

Each layer can be extracted to a microservice.
