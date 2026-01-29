/**
 * Script: Analizza e documenta migrazione endpoint Task_Templates → Tasks
 *
 * Questo script identifica tutti gli endpoint che usano Task_Templates
 * e documenta come migrarli a Tasks
 */

console.log(`
📋 ANALISI ENDPOINT DA MIGRARE:

1. loadTemplatesFromDB() (linea ~245)
   - Uso: Cache template per risolvere reference
   - Migrazione: Usa Tasks invece di Task_Templates
   - Note: Cerca anche in task_templates (lowercase) per backward compatibility

2. Bootstrap (linea ~700)
   - Uso: Clona template dalla factory al progetto
   - Migrazione: Clona da Tasks invece di Task_Templates
   - Note: Crea Task_Templates nel progetto - deve creare tasks

3. GET /api/projects/:pid/task-templates (linea ~815)
   - Uso: Lista template del progetto
   - Migrazione: Legge da tasks invece di Task_Templates
   - Note: Restituisce template catalog del progetto

4. POST /api/projects/:pid/task-templates (linea ~838)
   - Uso: Crea/aggiorna template nel progetto
   - Migrazione: Salva in tasks invece di Task_Templates
   - Note: Template catalog del progetto

5. GET /api/factory/actions (linea ~2754)
   - Uso: Lista actions per palette
   - Migrazione: Cerca in Tasks con type=Action (enum 6-19)
   - Note: Filtra per taskType='Action' o type enum 6-19

6. GET /api/factory/dialogue-templates (linea ~2790)
   - Uso: Carica tutti i template per cache
   - Migrazione: Legge da Tasks invece di Task_Templates
   - Note: Cache completa per risolvere reference

7. POST /api/factory/dialogue-templates (linea ~3221)
   - Uso: Salva template nella factory
   - Migrazione: Salva in Tasks invece di Task_Templates
   - Note: Template catalog factory

8. DELETE /api/factory/dialogue-templates/:id (linea ~3262)
   - Uso: Elimina template dalla factory
   - Migrazione: Elimina da Tasks invece di Task_Templates
   - Note: Eliminazione template catalog

9. GET /api/factory/task-templates (linea ~3474)
   - Uso: Lista template con filtri (scope, industry, taskType)
   - Migrazione: Legge da Tasks invece di Task_Templates
   - Note: Filtra per scope/industry/taskType

10. POST /api/factory/task-templates (linea ~3542)
    - Uso: Crea template nella factory
    - Migrazione: Salva in Tasks invece di Task_Templates
    - Note: Template catalog factory

11. PUT /api/factory/task-templates/:id (linea ~3589)
    - Uso: Aggiorna template nella factory
    - Migrazione: Aggiorna Tasks invece di Task_Templates
    - Note: Aggiornamento template catalog

12. DELETE /api/factory/task-templates/:id (linea ~3629)
    - Uso: Elimina template dalla factory
    - Migrazione: Elimina da Tasks invece di Task_Templates
    - Note: Eliminazione template catalog

13. Template matching (linea ~5631)
    - Uso: Cerca template per matching
    - Migrazione: Cerca in Tasks invece di Task_Templates
    - Note: Usato per euristiche

⚠️  PROBLEMA IDENTIFICATO:
- Task_Templates ha più campi di Tasks (dataContracts, subDataIds, patterns, steps, contexts)
- Prima di migrare, bisogna verificare che Tasks abbia tutti i campi necessari
- Oppure aggiungere questi campi durante la migrazione

✅ STRATEGIA:
1. Verificare che Tasks abbia tutti i campi necessari
2. Se mancano, aggiungerli durante la migrazione
3. Migrare tutti gli endpoint a Tasks
4. Testare
5. Rimuovere Task_Templates
`);

