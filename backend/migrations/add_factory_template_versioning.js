/**
 * Migration: Add version and versionNote to all Factory templates
 *
 * This migration adds versioning support to Factory templates:
 * - version: 1 (initial version for all existing templates)
 * - versionNote: "Initial factory version"
 *
 * Usage:
 *   node backend/migrations/add_factory_template_versioning.js --confirm
 *
 * Without --confirm, it runs in dry-run mode (no changes).
 */

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbName = 'factory';

async function addFactoryTemplateVersioning() {
  const client = new MongoClient(uri);
  const dryRun = !process.argv.includes('--confirm');

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');

    const db = client.db(dbName);
    const tasksCollection = db.collection('tasks');

    console.log('📋 Finding Factory templates to update...');
    const templates = await tasksCollection.find({}).toArray();
    console.log(`📋 Found ${templates.length} templates to check`);

    let templatesUpdated = 0;

    for (const template of templates) {
      let needsUpdate = false;
      const updates = {};

      // Check if version is missing or invalid
      if (!template.version || typeof template.version !== 'number') {
        updates.version = 1;
        needsUpdate = true;
      }

      // Check if versionNote is missing
      if (!template.versionNote || typeof template.versionNote !== 'string') {
        updates.versionNote = 'Initial factory version';
        needsUpdate = true;
      }

      if (needsUpdate) {
        templatesUpdated++;
        if (!dryRun) {
          await tasksCollection.updateOne(
            { _id: template._id },
            {
              $set: {
                ...updates,
                updatedAt: new Date()
              }
            }
          );
          console.log(`✅ Updated template ${template.id || template._id}: version=${updates.version || template.version}, versionNote="${updates.versionNote || template.versionNote}"`);
        } else {
          console.log(`✅ (Dry Run) Would update template ${template.id || template._id}: version=${updates.version || template.version}, versionNote="${updates.versionNote || template.versionNote}"`);
        }
      }
    }

    console.log('\n📊 Migration Summary:');
    console.log(`  Templates checked: ${templates.length}`);
    console.log(`  Templates updated: ${templatesUpdated}`);

    if (dryRun) {
      console.log('\n⚠️ This was a DRY RUN. No changes were made to the database.');
      console.log('   To apply changes, run with the --confirm flag: node backend/migrations/add_factory_template_versioning.js --confirm');
    } else {
      console.log('\n✅ Migration completed successfully');
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('🔌 Disconnected from MongoDB');
  }
}

addFactoryTemplateVersioning();
