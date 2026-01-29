/**
 * Migration: Remove legacy data fields from tasks
 *
 * Removes:
 * - data (replaced by subTasksIds in templates)
 * - steps (replaced by steps)
 * - constraints (moved to templates only)
 *
 * This migration ensures that:
 * - Templates use subTasksIds to reference other templates
 * - Instances only contain steps override, label, introduction
 * - No data duplication between templates and instances
 *
 * Usage:
 *   node backend/migrations/remove_legacy_data_fields.js --dry-run
 *   node backend/migrations/remove_legacy_data_fields.js --confirm
 */

const { MongoClient } = require('mongodb');
const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbName = process.env.MONGODB_DB || 'omnia';

const LEGACY_FIELDS = ['data', 'steps', 'constraints'];

async function removeLegacyFields(dryRun = true) {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');

    const db = client.db(dbName);
    const collections = await db.listCollections().toArray();

    let totalTasks = 0;
    let totalUpdated = 0;
    const stats = {
      projects: 0,
      factory: 0,
      tasksWithData: 0,
      tasksWithsteps: 0,
      tasksWithConstraints: 0
    };

    // Process all project databases
    const adminDb = client.db('admin');
    const allDbs = await adminDb.admin().listDatabases();

    for (const dbInfo of allDbs.databases) {
      const dbName = dbInfo.name;

      // Skip system databases
      if (dbName === 'admin' || dbName === 'local' || dbName === 'config') {
        continue;
      }

      // Check if this is a project database (has 'tasks' collection)
      const projectDb = client.db(dbName);
      const tasksCollection = projectDb.collection('tasks');
      const taskCount = await tasksCollection.countDocuments();

      if (taskCount === 0) {
        continue;
      }

      console.log(`\n📁 Processing database: ${dbName} (${taskCount} tasks)`);
      stats.projects++;

      const tasks = await tasksCollection.find({}).toArray();
      totalTasks += tasks.length;

      for (const task of tasks) {
        const updates = {};
        let hasLegacyFields = false;

        // Check and prepare removal of legacy fields
        if (task.data !== undefined) {
          updates.$unset = updates.$unset || {};
          updates.$unset.data = '';
          hasLegacyFields = true;
          stats.tasksWithData++;
        }

        if (task.steps !== undefined) {
          updates.$unset = updates.$unset || {};
          updates.$unset.steps = '';
          hasLegacyFields = true;
          stats.tasksWithsteps++;
        }

        if (task.constraints !== undefined) {
          updates.$unset = updates.$unset || {};
          updates.$unset.constraints = '';
          hasLegacyFields = true;
          stats.tasksWithConstraints++;
        }

        if (hasLegacyFields) {
          if (dryRun) {
            console.log(`  🔍 [DRY-RUN] Would remove legacy fields from task: ${task.id}`, {
              hasData: task.data !== undefined,
              hassteps: task.steps !== undefined,
              hasConstraints: task.constraints !== undefined,
              templateId: task.templateId,
              type: task.type
            });
          } else {
            await tasksCollection.updateOne(
              { _id: task._id },
              updates
            );
            totalUpdated++;
            console.log(`  ✅ Removed legacy fields from task: ${task.id}`);
          }
        }
      }
    }

    // Process factory database
    const factoryDb = client.db('factory');
    const factoryTasksCollection = factoryDb.collection('tasks');
    const factoryTaskCount = await factoryTasksCollection.countDocuments();

    if (factoryTaskCount > 0) {
      console.log(`\n📁 Processing factory database (${factoryTaskCount} tasks)`);
      stats.factory++;

      const factoryTasks = await factoryTasksCollection.find({}).toArray();
      totalTasks += factoryTasks.length;

      for (const task of factoryTasks) {
        const updates = {};
        let hasLegacyFields = false;

        // Check and prepare removal of legacy fields
        if (task.data !== undefined) {
          updates.$unset = updates.$unset || {};
          updates.$unset.data = '';
          hasLegacyFields = true;
          stats.tasksWithData++;
        }

        if (task.steps !== undefined) {
          updates.$unset = updates.$unset || {};
          updates.$unset.steps = '';
          hasLegacyFields = true;
          stats.tasksWithsteps++;
        }

        if (task.constraints !== undefined) {
          updates.$unset = updates.$unset || {};
          updates.$unset.constraints = '';
          hasLegacyFields = true;
          stats.tasksWithConstraints++;
        }

        if (hasLegacyFields) {
          if (dryRun) {
            console.log(`  🔍 [DRY-RUN] Would remove legacy fields from factory task: ${task.id}`, {
              hasData: task.data !== undefined,
              hassteps: task.steps !== undefined,
              hasConstraints: task.constraints !== undefined,
              templateId: task.templateId,
              type: task.type
            });
          } else {
            await factoryTasksCollection.updateOne(
              { _id: task._id },
              updates
            );
            totalUpdated++;
            console.log(`  ✅ Removed legacy fields from factory task: ${task.id}`);
          }
        }
      }
    }

    // Summary
    console.log('\n════════════════════════════════════════════════════════════════');
    console.log('📊 MIGRATION SUMMARY');
    console.log('════════════════════════════════════════════════════════════════');
    console.log(`Total tasks processed: ${totalTasks}`);
    console.log(`Tasks with 'data' field: ${stats.tasksWithData}`);
    console.log(`Tasks with 'steps' field: ${stats.tasksWithsteps}`);
    console.log(`Tasks with 'constraints' field: ${stats.tasksWithConstraints}`);
    console.log(`Projects processed: ${stats.projects}`);
    console.log(`Factory database processed: ${stats.factory > 0 ? 'Yes' : 'No'}`);

    if (dryRun) {
      console.log('\n⚠️  DRY-RUN MODE: No changes were made');
      console.log('   Run with --confirm to apply changes');
    } else {
      console.log(`\n✅ Updated ${totalUpdated} tasks`);
    }
    console.log('════════════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Migration error:', error);
    throw error;
  } finally {
    await client.close();
    console.log('✅ Disconnected from MongoDB');
  }
}

// Main
async function main() {
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--confirm');

  if (dryRun) {
    console.log('🔍 Running in DRY-RUN mode (no changes will be made)');
    console.log('   Add --confirm to apply changes\n');
  } else {
    console.log('⚠️  CONFIRM MODE: Changes will be applied to the database');
    console.log('   Press Ctrl+C within 5 seconds to cancel...\n');
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  try {
    await removeLegacyFields(dryRun);
    console.log('✅ Migration completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

main();
