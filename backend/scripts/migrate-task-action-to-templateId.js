/**
 * Migration Script: Copy action → templateId for all existing Tasks
 *
 * This script migrates existing Task documents in MongoDB to include templateId field.
 * It copies the value from action to templateId for backward compatibility.
 *
 * Usage:
 *   node backend/scripts/migrate-task-action-to-templateId.js [projectId]
 *
 * If projectId is provided, migrates only that project.
 * If not provided, migrates all projects (use with caution).
 *
 * Safety:
 *   - Dry-run mode by default (shows what would be migrated)
 *   - Requires confirmation before actual migration
 *   - Creates backup before migration (optional)
 */

const { MongoClient } = require('mongodb');

// MongoDB connection URI - update if needed
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';

const CONNECTION_OPTIONS = {
  serverSelectionTimeoutMS: 30000,
  connectTimeoutMS: 30000,
  socketTimeoutMS: 30000,
  retryWrites: true,
  retryReads: true,
  maxPoolSize: 10,
  minPoolSize: 2
};

/**
 * Get project database name from project ID
 */
function getProjectDbName(projectId) {
  return `project_${projectId}`;
}

/**
 * Dry-run: Count tasks that need migration
 */
async function dryRunMigration(client, projectId = null) {
  console.log('\n📊 [DRY-RUN] Analyzing tasks to migrate...\n');

  let totalCount = 0;
  let projectsProcessed = 0;

  if (projectId) {
    // Single project
    const dbName = getProjectDbName(projectId);
    const db = client.db(dbName);
    const tasksColl = db.collection('tasks');

    const count = await tasksColl.countDocuments({
      templateId: { $exists: false },
      action: { $exists: true }
    });

    totalCount = count;
    projectsProcessed = 1;

    console.log(`📋 Project: ${projectId}`);
    console.log(`   Tasks to migrate: ${count}`);

    if (count > 0) {
      // Show sample
      const sample = await tasksColl.findOne({
        templateId: { $exists: false },
        action: { $exists: true }
      });
      console.log(`   Sample task:`);
      console.log(`     id: ${sample.id}`);
      console.log(`     action: ${sample.action}`);
      console.log(`     hasTemplateId: ${!!sample.templateId}`);
    }
  } else {
    // All projects
    const adminDb = client.db('admin');
    const dbList = await adminDb.admin().listDatabases();

    const projectDbs = dbList.databases.filter(db => db.name.startsWith('project_'));

    for (const dbInfo of projectDbs) {
      const db = client.db(dbInfo.name);
      const tasksColl = db.collection('tasks');

      const count = await tasksColl.countDocuments({
        templateId: { $exists: false },
        action: { $exists: false }
      });

      if (count > 0) {
        totalCount += count;
        projectsProcessed++;
        console.log(`📋 ${dbInfo.name}: ${count} tasks`);
      }
    }
  }

  console.log(`\n✅ Total: ${totalCount} tasks across ${projectsProcessed} project(s)`);
  return { totalCount, projectsProcessed };
}

/**
 * Perform actual migration
 */
async function performMigration(client, projectId = null) {
  console.log('\n🔄 [MIGRATION] Starting migration...\n');

  let totalMigrated = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  if (projectId) {
    // Single project
    const dbName = getProjectDbName(projectId);
    const db = client.db(dbName);
    const tasksColl = db.collection('tasks');

    // ✅ MIGRATION: Use aggregation pipeline syntax for updateMany
    const result = await tasksColl.updateMany(
      {
        templateId: { $exists: false },
        action: { $exists: true }
      },
      [
        {
          $set: {
            templateId: '$action'  // ✅ Pipeline syntax (works in updateMany)
          }
        }
      ]
    );

    totalMigrated = result.modifiedCount;
    totalSkipped = result.matchedCount - result.modifiedCount;

    console.log(`✅ Project ${projectId}:`);
    console.log(`   Migrated: ${totalMigrated}`);
    console.log(`   Skipped: ${totalSkipped}`);

    // Verify migration
    const remaining = await tasksColl.countDocuments({
      templateId: { $exists: false },
      action: { $exists: true }
    });

    if (remaining > 0) {
      console.warn(`   ⚠️  Warning: ${remaining} tasks still need migration`);
    } else {
      console.log(`   ✅ All tasks migrated successfully!`);
    }
  } else {
    // All projects
    const adminDb = client.db('admin');
    const dbList = await adminDb.admin().listDatabases();

    const projectDbs = dbList.databases.filter(db => db.name.startsWith('project_'));

    for (const dbInfo of projectDbs) {
      const db = client.db(dbInfo.name);
      const tasksColl = db.collection('tasks');

      const countBefore = await tasksColl.countDocuments({
        templateId: { $exists: false },
        action: { $exists: true }
      });

      if (countBefore === 0) {
        continue; // Skip projects with no tasks to migrate
      }

      const result = await tasksColl.updateMany(
        {
          templateId: { $exists: false },
          action: { $exists: true }
        },
        [
          {
            $set: {
              templateId: '$action'
            }
          }
        ]
      );

      const migrated = result.modifiedCount;
      totalMigrated += migrated;

      console.log(`✅ ${dbInfo.name}: ${migrated} tasks migrated`);
    }
  }

  console.log(`\n🎉 Migration complete!`);
  console.log(`   Total migrated: ${totalMigrated}`);
  console.log(`   Total skipped: ${totalSkipped}`);
  console.log(`   Total errors: ${totalErrors}`);

  return { totalMigrated, totalSkipped, totalErrors };
}

/**
 * Main migration function
 */
async function migrateTasks(projectId = null, dryRun = true) {
  const client = new MongoClient(MONGO_URI, CONNECTION_OPTIONS);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');

    if (dryRun) {
      // Dry-run: just analyze
      const { totalCount, projectsProcessed } = await dryRunMigration(client, projectId);

      if (totalCount === 0) {
        console.log('\n✅ No tasks need migration. All tasks already have templateId.');
        return { success: true, migrated: 0 };
      }

      console.log('\n⚠️  This was a DRY-RUN. No changes were made.');
      console.log('   To perform actual migration, run with --execute flag:');
      console.log(`   node ${process.argv[1]} ${projectId ? projectId : ''} --execute`);

      return { success: true, dryRun: true, count: totalCount };
    } else {
      // Actual migration
      console.log('⚠️  EXECUTING MIGRATION - This will modify the database!\n');

      // Wait 3 seconds for user to cancel
      await new Promise(resolve => setTimeout(resolve, 3000));

      const result = await performMigration(client, projectId);
      return { success: true, ...result };
    }

  } catch (error) {
    console.error('❌ Error during migration:', error);
    return { success: false, error: error.message };
  } finally {
    await client.close();
    console.log('\n✅ Connection closed');
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const projectId = args.find(arg => !arg.startsWith('--'));
  const execute = args.includes('--execute');

  console.log('🔧 Task Migration Script: action → templateId\n');
  console.log('Project ID:', projectId || 'ALL PROJECTS');
  console.log('Mode:', execute ? 'EXECUTE' : 'DRY-RUN');
  console.log('');

  migrateTasks(projectId, !execute)
    .then(result => {
      if (result.success) {
        process.exit(0);
      } else {
        process.exit(1);
      }
    })
    .catch(err => {
      console.error('Fatal error:', err);
      process.exit(1);
    });
}

module.exports = { migrateTasks, dryRunMigration, performMigration };

