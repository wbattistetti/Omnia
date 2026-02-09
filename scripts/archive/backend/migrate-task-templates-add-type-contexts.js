/**
 * Migration Script: Add type and contexts to existing Task_Templates
 *
 * This script updates existing Task_Templates in MongoDB to include:
 * - type: 'action' | 'dataRequest' | 'problem' | 'backend' | 'flow'
 * - contexts: ['NodeRow'] | ['Response'] | ['NodeRow', 'Response']
 *
 * Rules:
 * - taskType='Action' → type='action', contexts=['NodeRow', 'Response']
 * - type='data' (DDT templates) → type='dataRequest', contexts=['NodeRow']
 * - Backend calls → type='backend', contexts=['NodeRow']
 * - Macrotasks → type='flow', contexts=['NodeRow']
 *
 * Usage:
 *   node backend/scripts/migrate-task-templates-add-type-contexts.js [--execute]
 *
 * Safety:
 *   - Dry-run mode by default
 *   - Requires --execute flag to perform actual migration
 */

const { MongoClient } = require('mongodb');

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
 * Determine type and contexts for a TaskTemplate based on its current fields
 */
function determineTypeAndContexts(template) {
  // Rule 1: taskType='Action' → type='action', contexts=['NodeRow', 'Response']
  if (template.taskType === 'Action') {
    return {
      type: 'action',
      contexts: ['NodeRow', 'Response']  // ✅ Actions can be in both places
    };
  }

  // Rule 2: type='data' (DDT templates) → type='dataRequest', contexts=['NodeRow']
  if (template.type === 'data') {
    return {
      type: 'dataRequest',
      contexts: ['NodeRow']  // ✅ DDT can only be in NodeRow
    };
  }

  // Rule 3: Backend calls (check by id or label)
  const backendIds = ['callBackend', 'readFromBackend', 'writeToBackend', 'BackendCall'];
  if (backendIds.includes(template.id) || template.id?.includes('backend') || template.id?.includes('Backend')) {
    return {
      type: 'backend',
      contexts: ['NodeRow']  // ✅ Backend calls only in NodeRow
    };
  }

  // Rule 4: Macrotasks (check by id or label)
  if (template.id?.startsWith('Macrotask_') || template.id?.includes('macrotask') || template.id?.includes('flow')) {
    return {
      type: 'flow',
      contexts: ['NodeRow']  // ✅ Macrotasks only in NodeRow
    };
  }

  // Rule 5: ProblemClassification
  if (template.id === 'ClassifyProblem' || template.id?.includes('problem') || template.id?.includes('Problem')) {
    return {
      type: 'problem',
      contexts: ['NodeRow']  // ✅ ProblemClassification only in NodeRow
    };
  }

  // Default: assume action if no other match
  return {
    type: 'action',
    contexts: ['NodeRow', 'Response']  // ✅ Safe default
  };
}

/**
 * Dry-run: Analyze what would be migrated
 */
async function dryRunMigration(client) {
  console.log('\n📊 [DRY-RUN] Analyzing Task_Templates to migrate...\n');

  const db = client.db('factory');
  const coll = db.collection('Task_Templates');

  // Find templates without type or contexts
  const templatesToMigrate = await coll.find({
    $or: [
      { type: { $exists: false } },
      { contexts: { $exists: false } }
    ]
  }).toArray();

  console.log(`📋 Found ${templatesToMigrate.length} templates to migrate\n`);

  if (templatesToMigrate.length === 0) {
    console.log('✅ All templates already have type and contexts!');
    return { total: 0, byCategory: {} };
  }

  // Group by category
  const byCategory = {
    actions: [],
    dataTemplates: [],
    backend: [],
    flow: [],
    problem: [],
    unknown: []
  };

  for (const template of templatesToMigrate) {
    const { type, contexts } = determineTypeAndContexts(template);

    const category = type === 'action' ? 'actions' :
                    type === 'dataRequest' ? 'dataTemplates' :
                    type === 'backend' ? 'backend' :
                    type === 'flow' ? 'flow' :
                    type === 'problem' ? 'problem' : 'unknown';

    byCategory[category].push({
      id: template.id || template._id,
      label: template.label || 'N/A',
      currentType: template.type || template.taskType || 'N/A',
      newType: type,
      newContexts: contexts
    });
  }

  // Print summary
  console.log('📊 Migration Summary:\n');
  console.log(`   Actions (type='action', contexts=['NodeRow', 'Response']): ${byCategory.actions.length}`);
  console.log(`   Data Templates (type='dataRequest', contexts=['NodeRow']): ${byCategory.dataTemplates.length}`);
  console.log(`   Backend (type='backend', contexts=['NodeRow']): ${byCategory.backend.length}`);
  console.log(`   Flow (type='flow', contexts=['NodeRow']): ${byCategory.flow.length}`);
  console.log(`   Problem (type='problem', contexts=['NodeRow']): ${byCategory.problem.length}`);
  console.log(`   Unknown (default to action): ${byCategory.unknown.length}\n`);

  // Show samples
  if (byCategory.actions.length > 0) {
    console.log('📄 Sample Actions:');
    byCategory.actions.slice(0, 5).forEach(t => {
      console.log(`   - ${t.id}: ${t.label} → type='${t.newType}', contexts=${JSON.stringify(t.newContexts)}`);
    });
    console.log('');
  }

  return { total: templatesToMigrate.length, byCategory };
}

/**
 * Perform actual migration
 */
async function performMigration(client) {
  console.log('\n🔄 [MIGRATION] Starting migration...\n');

  const db = client.db('factory');
  const coll = db.collection('Task_Templates');

  // Find templates without type or contexts
  const templatesToMigrate = await coll.find({
    $or: [
      { type: { $exists: false } },
      { contexts: { $exists: false } }
    ]
  }).toArray();

  let totalMigrated = 0;
  let totalSkipped = 0;

  for (const template of templatesToMigrate) {
    const { type, contexts } = determineTypeAndContexts(template);

    // Check if already has correct values
    if (template.type === type &&
        Array.isArray(template.contexts) &&
        JSON.stringify(template.contexts.sort()) === JSON.stringify(contexts.sort())) {
      totalSkipped++;
      continue;
    }

    // Update template
    const result = await coll.updateOne(
      { _id: template._id },
      {
        $set: {
          type: type,
          contexts: contexts
        }
      }
    );

    if (result.modifiedCount > 0) {
      totalMigrated++;
      console.log(`✅ ${template.id || template._id}: type='${type}', contexts=${JSON.stringify(contexts)}`);
    }
  }

  console.log(`\n🎉 Migration complete!`);
  console.log(`   Total migrated: ${totalMigrated}`);
  console.log(`   Total skipped: ${totalSkipped}`);

  // Verify
  const remaining = await coll.countDocuments({
    $or: [
      { type: { $exists: false } },
      { contexts: { $exists: false } }
    ]
  });

  if (remaining > 0) {
    console.warn(`   ⚠️  Warning: ${remaining} templates still need migration`);
  } else {
    console.log(`   ✅ All templates migrated successfully!`);
  }

  return { totalMigrated, totalSkipped };
}

/**
 * Main migration function
 */
async function migrateTaskTemplates(execute = false) {
  const client = new MongoClient(MONGO_URI, CONNECTION_OPTIONS);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');

    if (!execute) {
      // Dry-run
      const result = await dryRunMigration(client);

      if (result.total === 0) {
        console.log('\n✅ No templates need migration. All templates already have type and contexts.');
        return { success: true, migrated: 0 };
      }

      console.log('\n⚠️  This was a DRY-RUN. No changes were made.');
      console.log('   To perform actual migration, run with --execute flag:');
      console.log(`   node ${process.argv[1]} --execute`);

      return { success: true, dryRun: true, count: result.total };
    } else {
      // Actual migration
      console.log('⚠️  EXECUTING MIGRATION - This will modify Task_Templates!\n');
      await new Promise(resolve => setTimeout(resolve, 3000));

      const result = await performMigration(client);
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
  const execute = process.argv.includes('--execute');

  console.log('🔧 TaskTemplate Migration Script: Add type and contexts\n');
  console.log('Mode:', execute ? 'EXECUTE' : 'DRY-RUN');
  console.log('');

  migrateTaskTemplates(execute)
    .then(result => {
      process.exit(result.success ? 0 : 1);
    })
    .catch(err => {
      console.error('Fatal error:', err);
      process.exit(1);
    });
}

module.exports = { migrateTaskTemplates, dryRunMigration, performMigration };

