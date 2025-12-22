# Verifica TaskTemplatesV2

## Come verificare se il nuovo sistema è attivo

### 1. Attiva il Feature Flag

```javascript
localStorage.setItem('USE_TASK_TEMPLATES_V2', 'true');
```

Poi ricarica la pagina.

### 2. Verifica nella Console del Browser

Quando apri un progetto, dovresti vedere questi log:

#### ✅ Se il nuovo sistema è ATTIVO:

```
═══════════════════════════════════════════════════════════════════════════
⭐ [ProjectDataService] ⭐ NUOVO SISTEMA ATTIVO ⭐
═══════════════════════════════════════════════════════════════════════════
[ProjectDataService] Feature flag: USE_TASK_TEMPLATES_V2 = true
[ProjectDataService] Industry: ...
[ProjectDataService] Scopes to load: ['general', ...]

═══════════════════════════════════════════════════════════════════════════
🚀 [TaskTemplateServiceV2] ⭐ NUOVO SISTEMA ATTIVO ⭐
═══════════════════════════════════════════════════════════════════════════
[TaskTemplateServiceV2] 🌐 Fetching from: http://localhost:3100/api/factory/task-templates-v2?...
[TaskTemplateServiceV2] 📡 Full URL: ...

═══════════════════════════════════════════════════════════════════════════
✅ [TaskTemplateServiceV2] SUCCESS! Loaded X templates in Yms
═══════════════════════════════════════════════════════════════════════════
[TaskTemplateServiceV2] ✅ All templates from new system (task_templates collection)
```

#### ⚠️ Se il vecchio sistema è ATTIVO:

```
═══════════════════════════════════════════════════════════════════════════
⚠️ [ProjectDataService] ⚠️ VECCHIO SISTEMA (AgentActs) ⚠️
═══════════════════════════════════════════════════════════════════════════
[ProjectDataService] Feature flag: USE_TASK_TEMPLATES_V2 = false (or not set)
[ProjectDataService] Using legacy AgentActs system
```

### 3. Usa le Utility di Debug

Nella console del browser, puoi eseguire:

```javascript
// Verifica rapida
window.checkTaskTemplatesV2()

// Report completo
window.showTaskTemplatesV2Status()
```

### 4. Verifica Network Tab

Nel Network tab del DevTools, cerca:

- **Nuovo sistema**: `GET /api/factory/task-templates-v2?...`
- **Vecchio sistema**: `GET http://localhost:8000/api/agent-acts-from-cache`

### 5. Verifica Intellisense

1. Apri un progetto
2. Clicca su un nodo nel flowchart
3. Aggiungi una nuova row
4. Apri l'Intellisense (Ctrl+Space o click sull'icona)
5. Verifica che i template siano caricati

Se vedi i template nell'Intellisense, il sistema funziona!

### 6. Verifica Backend

Controlla i log del backend Express (`backend/server.js`):

```
[TaskTemplatesV2] Query: { scope: { $in: ['general', ...] } }
[TaskTemplatesV2] Found X templates
```

### 7. Troubleshooting

#### Problema: Nessun log del nuovo sistema

**Causa**: Feature flag non attivo

**Soluzione**:
```javascript
localStorage.setItem('USE_TASK_TEMPLATES_V2', 'true');
location.reload();
```

#### Problema: Errori 500

**Causa**: Backend Express non in esecuzione o endpoint non disponibile

**Soluzione**:
1. Verifica che `backend/server.js` sia in esecuzione su `localhost:3100`
2. Verifica che gli endpoint `/api/factory/task-templates-v2` esistano
3. Controlla i log del backend per errori

#### Problema: 0 templates caricati

**Causa**: Nessun template nella collection `task_templates`

**Soluzione**:
1. Esegui gli script di migrazione:
   ```bash
   cd backend/migrations
   node step1_setup_collections.js
   node step2_copy_data.js
   node step3_seed_builtins.js
   ```
2. Verifica nel MongoDB che la collection `task_templates` contenga documenti

#### Problema: Templates con `_fallback: true`

**Causa**: Il sistema sta usando il fallback su AgentActs

**Soluzione**:
- Verifica che la migrazione sia stata eseguita correttamente
- Controlla che i template nella collection `task_templates` abbiano scope corretto

### 8. Confronto Vecchio vs Nuovo

| Aspetto | Vecchio Sistema | Nuovo Sistema |
|---------|----------------|---------------|
| Collection | `AgentActs` | `task_templates` |
| Endpoint | `/api/factory/agent-acts` | `/api/factory/task-templates-v2` |
| Scope | Nessuno | `general`, `industry:xxx`, `client:xxx` |
| DDT | Embedded in AgentAct | Separato in `ddt_library` |
| Log Console | Nessun log speciale | Log dettagliati con emoji |

### 9. Disattivare il Nuovo Sistema

```javascript
localStorage.removeItem('USE_TASK_TEMPLATES_V2');
location.reload();
```

Il sistema tornerà automaticamente al vecchio sistema (AgentActs).




