// Check if we can recover templates from project databases
// This script lists all templates in project databases that might be recoverable

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';

async function checkProjectTemplates() {
  const client = new MongoClient(uri);

  try {
    console.log('🔌 Connecting to MongoDB...');
    await client.connect();
    console.log('✅ Connected to MongoDB\n');

    const adminDb = client.db().admin();
    const dbList = await adminDb.listDatabases();

    const allTemplates = new Map(); // templateId -> { db, template }

    for (const dbInfo of dbList.databases) {
      const dbName = dbInfo.name;

      // Skip system databases and Factory
      if (dbName === 'admin' || dbName === 'local' || dbName === 'config' || dbName === 'factory') {
        continue;
      }

      try {
        const projectDb = client.db(dbName);
        const collections = await projectDb.listCollections().toArray();
        const hasTasks = collections.some(c => c.name === 'tasks');

        if (!hasTasks) {
          continue;
        }

        const tasksColl = projectDb.collection('tasks');
        // Find templates (type 3 or other template types)
        const templates = await tasksColl.find({
          $or: [
            { type: 3 },
            { type: { $regex: /^datarequest$/i } },
            { type: { $regex: /^data$/i } }
          ]
        }).toArray();

        if (templates.length > 0) {
          console.log(`📋 Database: ${dbName} - Found ${templates.length} template(s)`);

          for (const template of templates) {
            const templateId = template.id || template._id?.toString();
            if (templateId && !allTemplates.has(templateId)) {
              allTemplates.set(templateId, {
                db: dbName,
                template: {
                  id: templateId,
                  label: template.label || 'no label',
                  type: template.type,
                  hasConstraints: !!(template.constraints && template.constraints.length > 0),
                  hasSteps: !!(template.steps && Object.keys(template.steps).length > 0)
                }
              });
              console.log(`   - ${templateId} (${template.label || 'no label'})`);
            }
          }
        }
      } catch (error) {
        console.log(`   ⚠️  Error processing ${dbName}: ${error.message}`);
        continue;
      }
    }

    console.log(`\n✅ Total unique templates found in projects: ${allTemplates.size}`);
    console.log('\n💡 These templates might be recoverable from project databases');

  } catch (error) {
    console.error('❌ Failed:', error);
    throw error;
  } finally {
    await client.close();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

if (require.main === module) {
  checkProjectTemplates()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('❌ Failed:', error);
      process.exit(1);
    });
}

module.exports = { checkProjectTemplates };
