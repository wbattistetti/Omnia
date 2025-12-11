/**
 * Migration script: Remove 'action' field from all tasks in database
 *
 * This script removes the legacy 'action' field from all task documents.
 * After this migration, only 'templateId' will be used.
 *
 * Usage:
 *   node backend/scripts/remove-action-field-from-tasks.js [projectId]
 *
 * If projectId is provided, only that project's tasks will be migrated.
 * If omitted, all projects' tasks will be migrated.
 */

const { MongoClient } = require('mongodb');

// MongoDB connection URI - update if needed
const uri = process.env.MONGO_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const catalogDbName = 'Projects';

async function getProjectDb(client, projectId) {
  // Get project database name from catalog
  const catalogDb = client.db('Projects');
  const catalog = catalogDb.collection('projects_catalog');
  const rec = await catalog.findOne({ $or: [{ _id: projectId }, { projectId }] });
  if (!rec || !rec.dbName) {
    throw new Error(`Project ${projectId} not found or missing dbName`);
  }
  return client.db(rec.dbName);
}

async function removeActionField(client, projectId = null) {
  console.log('═══════════════════════════════════════════════════════════════════════════');
  console.log('🗑️  REMOVING "action" FIELD FROM TASKS');
  console.log('═══════════════════════════════════════════════════════════════════════════');
  console.log(`MongoDB URI: ${uri}`);
  console.log(`Catalog Database: ${catalogDbName}`);
  if (projectId) {
    console.log(`Project ID: ${projectId}`);
  } else {
    console.log('Project ID: ALL PROJECTS');
  }
  console.log('');

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');

    const catalogDb = client.db(catalogDbName);

    if (projectId) {
      // Migrate specific project
      const projDb = await getProjectDb(client, projectId);
      const tasksCollection = projDb.collection('tasks');

      // Count tasks with action field
      const countWithAction = await tasksCollection.countDocuments({ action: { $exists: true } });
      console.log(`📊 Found ${countWithAction} tasks with 'action' field in project ${projectId}`);

      if (countWithAction === 0) {
        console.log('✅ No tasks with "action" field found. Nothing to migrate.');
        return;
      }

      // Remove action field from all tasks
      const result = await tasksCollection.updateMany(
        { action: { $exists: true } },
        { $unset: { action: '' } }
      );

      console.log(`✅ Removed "action" field from ${result.modifiedCount} tasks in project ${projectId}`);
    } else {
      // Migrate all projects
      const catalogCollection = catalogDb.collection('projects_catalog');
      const projects = await catalogCollection.find({}).toArray();

      console.log(`📊 Found ${projects.length} projects in catalog`);

      let totalModified = 0;
      let projectsProcessed = 0;

      for (const project of projects) {
        if (!project.dbName) {
          console.log(`  ⚠️  Skipping project ${project.projectId || project._id}: no dbName`);
          continue;
        }

        const projDb = client.db(project.dbName);
        const tasksCollection = projDb.collection('tasks');

        const countWithAction = await tasksCollection.countDocuments({ action: { $exists: true } });

        if (countWithAction > 0) {
          const result = await tasksCollection.updateMany(
            { action: { $exists: true } },
            { $unset: { action: '' } }
          );

          totalModified += result.modifiedCount;
          projectsProcessed++;
          console.log(`  ✅ ${project.dbName}: Removed "action" from ${result.modifiedCount} tasks`);
        }
      }

      console.log('');
      console.log(`✅ Migration complete:`);
      console.log(`   - Projects processed: ${projectsProcessed}`);
      console.log(`   - Total tasks updated: ${totalModified}`);
    }

    console.log('');
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('✅ MIGRATION COMPLETED SUCCESSFULLY');
    console.log('═══════════════════════════════════════════════════════════════════════════');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await client.close();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Main execution
const projectId = process.argv[2] || null;
const client = new MongoClient(uri);

removeActionField(client, projectId)
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });

