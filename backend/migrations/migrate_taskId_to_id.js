/**
 * Migration: Convert taskId → id in escalation tasks
 *
 * PROBLEMA:
 * I task nelle escalations dei template hanno il campo "taskId" invece di "id".
 * Questo causa errori quando cloneEscalationWithNewTaskIds cerca task.id.
 *
 * SOLUZIONE:
 * Convertire tutti i taskId → id nei task delle escalations dei template.
 *
 * ESECUZIONE:
 * node backend/migrations/migrate_taskId_to_id.js [--dry-run]
 *
 * Per confermare: node backend/migrations/migrate_taskId_to_id.js --confirm
 */

const { MongoClient } = require('mongodb');
const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbName = process.env.MONGODB_DB || 'factory';

async function migrateTaskIdToId() {
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
                if (task && typeof task === 'object' && task.taskId && !task.id) {
                  // ✅ Converti taskId → id
                  task.id = task.taskId;
                  delete task.taskId;
                  templateModified = true;
                  totalTasksFixed++;
                  console.log(`  ✅ Fixed task in template ${template.id || template._id}: ${task.id}`);
                }
              }
            }

            // ✅ Fix actions array (legacy)
            if (escalation.actions && Array.isArray(escalation.actions)) {
              for (const action of escalation.actions) {
                if (action && typeof action === 'object' && action.taskId && !action.actionInstanceId && !action.id) {
                  // ✅ Per le actions, mantieni actionInstanceId se presente, altrimenti usa id
                  if (!action.actionInstanceId) {
                    action.actionInstanceId = action.taskId;
                  }
                  // ✅ Rimuovi taskId (non serve più)
                  delete action.taskId;
                  templateModified = true;
                  totalTasksFixed++;
                  console.log(`  ✅ Fixed action in template ${template.id || template._id}: ${action.actionInstanceId || action.id}`);
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
                  if (task && typeof task === 'object' && task.taskId && !task.id) {
                    task.id = task.taskId;
                    delete task.taskId;
                    templateModified = true;
                    totalTasksFixed++;
                    console.log(`  ✅ Fixed task in template ${template.id || template._id}: ${task.id}`);
                  }
                }
              }

              // ✅ Fix actions array (legacy)
              if (escalation.actions && Array.isArray(escalation.actions)) {
                for (const action of escalation.actions) {
                  if (action && typeof action === 'object' && action.taskId && !action.actionInstanceId && !action.id) {
                    if (!action.actionInstanceId) {
                      action.actionInstanceId = action.taskId;
                    }
                    delete action.taskId;
                    templateModified = true;
                    totalTasksFixed++;
                    console.log(`  ✅ Fixed action in template ${template.id || template._id}: ${action.actionInstanceId || action.id}`);
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
migrateTaskIdToId().catch(console.error);
