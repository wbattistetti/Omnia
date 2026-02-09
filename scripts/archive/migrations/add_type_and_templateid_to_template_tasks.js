/**
 * Migration: Add type and templateId to tasks in template escalations
 *
 * PROBLEMA:
 * I task nelle escalations dei template hanno actionId ma mancano type e templateId.
 * Questo causa errori quando cloneEscalationWithNewTaskIds cerca questi campi obbligatori.
 *
 * SOLUZIONE:
 * Aggiungere type (derivato da actionId) e templateId (null per task standalone) a tutti i task.
 *
 * ESECUZIONE:
 * node backend/migrations/add_type_and_templateid_to_template_tasks.js [--dry-run]
 *
 * Per confermare: node backend/migrations/add_type_and_templateid_to_template_tasks.js --confirm
 */

const { MongoClient } = require('mongodb');
const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbName = process.env.MONGODB_DB || 'factory';

// ✅ Mapping: actionId → TaskType enum (per migrazione database)
// ✅ IMPORTANT: actionId viene normalizzato in lowercase, quindi tutte le chiavi sono lowercase
const ACTION_ID_TO_TYPE = {
  'saymessage': 0,        // TaskType.SayMessage
  'closesession': 1,      // TaskType.CloseSession
  'transfer': 2,          // TaskType.Transfer
  'utteranceinterpretation': 3,  // TaskType.UtteranceInterpretation
  'backendcall': 4,       // TaskType.BackendCall
  'classifyproblem': 5,   // TaskType.ClassifyProblem
  'aiagent': 6,           // TaskType.AIAgent
  'summarizer': 7,        // TaskType.Summarizer
  'negotiation': 8,       // TaskType.Negotiation
  // Varianti comuni
  'say': 0,
  'message': 0,
  'close': 1,
  'end': 1,
  'datarequest': 3,
  'getdata': 3,
  'data': 3,
  'backend': 4,
  'callbackend': 4,
  'problem': 5,
  'classify': 5
};

/**
 * Determina TaskType da actionId
 */
function getTypeFromActionId(actionId) {
  if (!actionId || typeof actionId !== 'string') {
    return null;
  }
  const normalized = actionId.toLowerCase().trim();
  return ACTION_ID_TO_TYPE[normalized] ?? null;
}

async function addTypeAndTemplateIdToTemplateTasks() {
  const client = new MongoClient(uri);
  const dryRun = !process.argv.includes('--confirm');

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');

    const db = client.db(dbName);
    const tasksCollection = db.collection('tasks');

    // ✅ Trova tutti i template (templateId: null)
    const templates = await tasksCollection.find({ templateId: null }).toArray();
    console.log(`📋 Found ${templates.length} templates to check`);

    let totalFixed = 0;
    let totalTasksFixed = 0;

    for (const template of templates) {
      if (!template.steps || typeof template.steps !== 'object') {
        continue;
      }

      let templateModified = false;
      const updatedSteps = { ...template.steps };

      // ✅ Helper per fixare un task
      const fixTask = (task) => {
        if (!task || typeof task !== 'object') return false;

        let taskFixed = false;

        // ✅ Se manca type, derivalo da actionId
        if ((task.type === undefined || task.type === null) && task.actionId) {
          const derivedType = getTypeFromActionId(task.actionId);
          if (derivedType !== null) {
            task.type = derivedType;
            taskFixed = true;
            totalTasksFixed++;
            console.log(`  ✅ Fixed task type: ${task.id || 'unknown'} (actionId: ${task.actionId} → type: ${derivedType})`);
          } else {
            console.warn(`  ⚠️ Cannot derive type for task ${task.id || 'unknown'} (actionId: ${task.actionId})`);
          }
        }

        // ✅ Se manca templateId, imposta null (task standalone nel template)
        if (task.templateId === undefined) {
          task.templateId = null;
          taskFixed = true;
          if (!taskFixed) {
            totalTasksFixed++;
          }
          console.log(`  ✅ Fixed task templateId: ${task.id || 'unknown'} (→ null)`);
        }

        return taskFixed;
      };

      // ✅ Itera su tutti gli step types (start, noMatch, etc.)
      for (const stepType in updatedSteps) {
        const step = updatedSteps[stepType];
        if (!step || typeof step !== 'object') continue;

        // ✅ Case A: steps as object { start: { escalations: [...] } }
        if (!Array.isArray(step) && step.escalations && Array.isArray(step.escalations)) {
          for (const escalation of step.escalations) {
            if (!escalation || typeof escalation !== 'object') continue;

            // ✅ Fix tasks array
            if (escalation.tasks && Array.isArray(escalation.tasks)) {
              for (const task of escalation.tasks) {
                if (fixTask(task)) {
                  templateModified = true;
                }
              }
            }

            // ✅ Fix actions array (legacy)
            if (escalation.actions && Array.isArray(escalation.actions)) {
              for (const action of escalation.actions) {
                if (fixTask(action)) {
                  templateModified = true;
                }
              }
            }
          }
        }

        // ✅ Case B: steps as array [{ type: 'start', escalations: [...] }, ...]
        if (Array.isArray(step)) {
          for (const stepGroup of step) {
            if (!stepGroup || typeof stepGroup !== 'object' || !stepGroup.escalations) continue;

            for (const escalation of stepGroup.escalations) {
              if (!escalation || typeof escalation !== 'object') continue;

              // ✅ Fix tasks array
              if (escalation.tasks && Array.isArray(escalation.tasks)) {
                for (const task of escalation.tasks) {
                  if (fixTask(task)) {
                    templateModified = true;
                  }
                }
              }

              // ✅ Fix actions array (legacy)
              if (escalation.actions && Array.isArray(escalation.actions)) {
                for (const action of escalation.actions) {
                  if (fixTask(action)) {
                    templateModified = true;
                  }
                }
              }
            }
          }
        }
      }

      if (templateModified) {
        totalFixed++;
        if (dryRun) {
          console.log(`🔍 [DRY RUN] Would update template ${template.id || template._id}`);
        } else {
          await tasksCollection.updateOne(
            { _id: template._id },
            { $set: { steps: updatedSteps } }
          );
          console.log(`✅ Updated template ${template.id || template._id}`);
        }
      }
    }

    console.log('\n📊 Migration Summary:');
    console.log(`  Templates fixed: ${totalFixed}`);
    console.log(`  Tasks/Actions fixed: ${totalTasksFixed}`);

    if (dryRun) {
      console.log('\n⚠️  DRY RUN - No changes were made');
      console.log('   Run with --confirm to apply changes');
    } else {
      console.log('\n✅ Migration completed successfully');
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await client.close();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run migration
addTypeAndTemplateIdToTemplateTasks().catch(console.error);
