// Migration script: Remove all task templates of type 3 from Factory database
// Also removes related embeddings and translations
// Run this script to clean up the database before recreating templates with the wizard

const { MongoClient } = require('mongodb');

// MongoDB connection string (use environment variable in production)
const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbFactory = 'factory'; // lowercase as used in server.js

/**
 * Extract all translation keys from a template
 */
function extractTranslationKeys(template) {
  const keys = new Set();

  // Extract from steps
  if (template.steps && typeof template.steps === 'object') {
    for (const [nodeId, nodeSteps] of Object.entries(template.steps)) {
      if (nodeSteps && typeof nodeSteps === 'object') {
        for (const [stepType, stepData] of Object.entries(nodeSteps)) {
          if (stepData && typeof stepData === 'object') {
            // Check escalations
            if (stepData.escalations && Array.isArray(stepData.escalations)) {
              for (const escalation of stepData.escalations) {
                if (escalation.tasks && Array.isArray(escalation.tasks)) {
                  for (const task of escalation.tasks) {
                    if (task.textKey) keys.add(task.textKey);
                    if (task.parameters && Array.isArray(task.parameters)) {
                      for (const param of task.parameters) {
                        if (param.parameterId === 'text' && param.value) {
                          keys.add(param.value);
                        }
                      }
                    }
                  }
                }
                if (escalation.actions && Array.isArray(escalation.actions)) {
                  for (const action of escalation.actions) {
                    if (action.parameters && Array.isArray(action.parameters)) {
                      for (const param of action.parameters) {
                        if (param.parameterId === 'text' && param.value) {
                          keys.add(param.value);
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  // Extract from nodes
  if (template.nodes && Array.isArray(template.nodes)) {
    for (const node of template.nodes) {
      if (node.steps && typeof node.steps === 'object') {
        for (const [stepType, stepData] of Object.entries(node.steps)) {
          if (stepData && typeof stepData === 'object' && stepData.escalations) {
            for (const escalation of stepData.escalations || []) {
              if (escalation.tasks && Array.isArray(escalation.tasks)) {
                for (const task of escalation.tasks) {
                  if (task.textKey) keys.add(task.textKey);
                  if (task.parameters && Array.isArray(task.parameters)) {
                    for (const param of task.parameters) {
                      if (param.parameterId === 'text' && param.value) {
                        keys.add(param.value);
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  return Array.from(keys);
}

/**
 * Remove type 3 templates from Factory database
 */
async function removeType3TemplatesFromFactory(client) {
  const db = client.db(dbFactory);
  // Templates are stored in 'tasks' collection (lowercase) as per server.js
  const templatesColl = db.collection('tasks');

  console.log('\n📋 Removing type 3 templates from Factory database...');

  // Find all templates with type = 3 (also check for string types like 'datarequest', 'data')
  const query = {
    $or: [
      { type: 3 },
      { type: { $regex: /^datarequest$/i } },
      { type: { $regex: /^data$/i } },
      { name: { $regex: /^(datarequest|getdata|data)$/i } }
    ]
  };
  const type3Templates = await templatesColl.find(query).toArray();
  const count = type3Templates.length;

  if (count === 0) {
    console.log('  ℹ️  No type 3 templates found in Factory');
    return { templateIds: [], translationKeys: [] };
  }

  console.log(`  🔍 Found ${count} type 3 template(s) in Factory`);

  // Collect template IDs and translation keys
  const templateIds = [];
  const allTranslationKeys = new Set();

  for (const template of type3Templates) {
    const templateId = template.id || template._id?.toString();
    if (templateId) {
      templateIds.push(templateId);
      console.log(`    - Template: ${templateId} (${template.label || 'no label'})`);

      // Extract translation keys
      const keys = extractTranslationKeys(template);
      keys.forEach(key => allTranslationKeys.add(key));
      if (keys.length > 0) {
        console.log(`      Translation keys: ${keys.length}`);
      }
    }
  }

  // Delete templates
  const deleteQuery = {
    $or: [
      { type: 3 },
      { type: { $regex: /^datarequest$/i } },
      { type: { $regex: /^data$/i } },
      { name: { $regex: /^(datarequest|getdata|data)$/i } }
    ]
  };
  const deleteResult = await templatesColl.deleteMany(deleteQuery);
  console.log(`\n  ✅ Deleted ${deleteResult.deletedCount} template(s) from Factory`);

  return {
    templateIds,
    translationKeys: Array.from(allTranslationKeys)
  };
}

/**
 * Remove type 3 templates from project databases
 */
async function removeType3TemplatesFromProjects(client) {
  console.log('\n📋 Removing type 3 templates from project databases...');

  const adminDb = client.db().admin();
  const dbList = await adminDb.listDatabases();

  let totalRemoved = 0;
  const allTemplateIds = [];
  const allTranslationKeys = new Set();

  for (const dbInfo of dbList.databases) {
    const dbName = dbInfo.name;

    // Skip system databases and Factory
    if (dbName === 'admin' || dbName === 'local' || dbName === 'config' || dbName === dbFactory) {
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

      // Find type 3 templates in this project
      const query = {
        $or: [
          { type: 3 },
          { type: { $regex: /^datarequest$/i } },
          { type: { $regex: /^data$/i } },
          { name: { $regex: /^(datarequest|getdata|data)$/i } }
        ]
      };

      const type3Templates = await tasksColl.find(query).toArray();

      if (type3Templates.length > 0) {
        console.log(`  🔍 Found ${type3Templates.length} type 3 template(s) in ${dbName}`);

        for (const template of type3Templates) {
          const templateId = template.id || template._id?.toString();
          if (templateId) {
            allTemplateIds.push(templateId);
            console.log(`    - Template: ${templateId} (${template.label || 'no label'})`);

            // Extract translation keys
            const keys = extractTranslationKeys(template);
            keys.forEach(key => allTranslationKeys.add(key));
            if (keys.length > 0) {
              console.log(`      Translation keys: ${keys.length}`);
            }
          }
        }

        // Delete templates
        const deleteResult = await tasksColl.deleteMany(query);
        totalRemoved += deleteResult.deletedCount;
        console.log(`    ✅ Deleted ${deleteResult.deletedCount} template(s) from ${dbName}`);
      }
    } catch (error) {
      console.log(`    ⚠️  Error processing ${dbName}: ${error.message}`);
      continue;
    }
  }

  if (totalRemoved === 0) {
    console.log('  ℹ️  No type 3 templates found in project databases');
  } else {
    console.log(`\n  ✅ Total deleted from projects: ${totalRemoved} template(s)`);
  }

  return {
    templateIds: allTemplateIds,
    translationKeys: Array.from(allTranslationKeys)
  };
}

/**
 * Remove type 3 templates from both Factory and project databases
 */
async function removeType3Templates(client) {
  // Remove from Factory
  const factoryResult = await removeType3TemplatesFromFactory(client);

  // Remove from projects
  const projectResult = await removeType3TemplatesFromProjects(client);

  // Combine results
  const allTemplateIds = [...factoryResult.templateIds, ...projectResult.templateIds];
  const allTranslationKeys = new Set([...factoryResult.translationKeys, ...projectResult.translationKeys]);

  return {
    templateIds: allTemplateIds,
    translationKeys: Array.from(allTranslationKeys)
  };
}

/**
 * Remove embeddings related to type 3 templates
 */
async function removeEmbeddings(client, templateIds) {
  const db = client.db(dbFactory);

  // Try common embedding collection names
  const embeddingCollections = ['embeddings', 'template_embeddings', 'task_embeddings'];
  let totalRemoved = 0;

  console.log('\n📋 Removing related embeddings...');

  for (const collName of embeddingCollections) {
    try {
      const coll = db.collection(collName);
      const exists = await db.listCollections({ name: collName }).hasNext();

      if (exists) {
        // Try to find embeddings by templateId or id
        const query = {
          $or: [
            { templateId: { $in: templateIds } },
            { id: { $in: templateIds } },
            { taskId: { $in: templateIds } },
            { _id: { $in: templateIds } }
          ]
        };

        const count = await coll.countDocuments(query);
        if (count > 0) {
          const result = await coll.deleteMany(query);
          totalRemoved += result.deletedCount;
          console.log(`  ✅ Removed ${result.deletedCount} embedding(s) from ${collName}`);
        }
      }
    } catch (error) {
      // Collection might not exist, skip
      continue;
    }
  }

  if (totalRemoved === 0) {
    console.log('  ℹ️  No embeddings found to remove');
  }

  return totalRemoved;
}

/**
 * Remove translations related to type 3 templates
 */
async function removeTranslations(client, translationKeys) {
  const db = client.db(dbFactory);

  // ✅ CORRECTED: Use 'Translations' (capital T) as per server.js
  const translationCollections = ['Translations', 'IDETranslations', 'translations', 'project_translations', 'global_translations'];
  let totalRemoved = 0;

  console.log('\n📋 Removing related translations...');

  if (translationKeys.length === 0) {
    console.log('  ℹ️  No translation keys to remove');
    return 0;
  }

  console.log(`  🔍 Found ${translationKeys.length} translation key(s) to remove`);

  for (const collName of translationCollections) {
    try {
      const coll = db.collection(collName);
      const exists = await db.listCollections({ name: collName }).hasNext();

      if (exists) {
        // ✅ CORRECTED: Use 'guid' as primary field (as per server.js structure)
        // Also check legacy fields for backward compatibility
        const query = {
          $or: [
            { guid: { $in: translationKeys } },  // ✅ Primary field (new format)
            { key: { $in: translationKeys } },  // Legacy field
            { textKey: { $in: translationKeys } },  // Legacy field
            { _id: { $in: translationKeys } }  // Direct ID match
          ]
        };

        const count = await coll.countDocuments(query);
        if (count > 0) {
          const result = await coll.deleteMany(query);
          totalRemoved += result.deletedCount;
          console.log(`  ✅ Removed ${result.deletedCount} translation(s) from ${collName}`);
        }
      }
    } catch (error) {
      // Collection might not exist, skip
      continue;
    }
  }

  // Also check in project databases for translations
  const adminDb = client.db().admin();
  const dbList = await adminDb.listDatabases();

  for (const dbInfo of dbList.databases) {
    const dbName = dbInfo.name;

    // Skip system databases and Factory
    if (dbName === 'admin' || dbName === 'local' || dbName === 'config' || dbName === dbFactory) {
      continue;
    }

    try {
      const projectDb = client.db(dbName);
      // ✅ CORRECTED: Use 'Translations' (capital T) as per server.js
      const coll = projectDb.collection('Translations');
      const exists = await projectDb.listCollections({ name: 'Translations' }).hasNext();

      if (exists) {
        // ✅ CORRECTED: Use 'guid' as primary field
        const query = {
          $or: [
            { guid: { $in: translationKeys } },  // ✅ Primary field (new format)
            { key: { $in: translationKeys } },  // Legacy field
            { textKey: { $in: translationKeys } },  // Legacy field
            { _id: { $in: translationKeys } }  // Direct ID match
          ]
        };

        const count = await coll.countDocuments(query);
        if (count > 0) {
          const result = await coll.deleteMany(query);
          totalRemoved += result.deletedCount;
          console.log(`  ✅ Removed ${result.deletedCount} translation(s) from ${dbName}.Translations`);
        }
      }
    } catch (error) {
      // Skip if error
      continue;
    }
  }

  if (totalRemoved === 0) {
    console.log('  ℹ️  No translations found to remove');
  }

  return totalRemoved;
}

/**
 * Main cleanup function
 */
async function cleanupType3Templates() {
  const client = new MongoClient(uri);

  try {
    console.log('🔌 Connecting to MongoDB...');
    await client.connect();
    console.log('✅ Connected to MongoDB');

    // Remove type 3 templates and collect IDs/keys
    const { templateIds, translationKeys } = await removeType3Templates(client);

    // Remove related embeddings
    await removeEmbeddings(client, templateIds);

    // Remove related translations
    await removeTranslations(client, translationKeys);

    console.log('\n✅ Cleanup completed successfully!');
    console.log(`\n📝 Summary:`);
    console.log(`   - Templates removed: ${templateIds.length}`);
    console.log(`   - Translation keys found: ${translationKeys.length}`);
    console.log(`\n💡 You can now recreate templates using the wizard`);

  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    throw error;
  } finally {
    await client.close();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run cleanup
if (require.main === module) {
  cleanupType3Templates()
    .then(() => {
      console.log('\n✅ Cleanup script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Cleanup script failed:', error);
      process.exit(1);
    });
}

module.exports = { cleanupType3Templates };
