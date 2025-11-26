const { MongoClient } = require('mongodb');

const uri = 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbFactory = 'factory';
const dbProjects = 'Projects';

async function createIndexes() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('[MongoDB] ✅ Connected\n');

    // ===================================
    // FACTORY DATABASE INDEXES
    // ===================================
    console.log('📦 Creating indexes for Factory database...');
    const factoryDb = client.db(dbFactory);

    // AgentActs collection
    try {
      await factoryDb.collection('AgentActs').createIndex({ scope: 1, industry: 1 });
      console.log('  ✅ AgentActs: { scope, industry }');
    } catch (e) {
      console.log('  ⚠️  AgentActs index may already exist:', e.message);
    }

    // Conditions collection
    try {
      await factoryDb.collection('Conditions').createIndex({ scope: 1, industry: 1 });
      console.log('  ✅ Conditions: { scope, industry }');
    } catch (e) {
      console.log('  ⚠️  Conditions index may already exist:', e.message);
    }

    // Translations collection (verify existing indexes)
    try {
      await factoryDb.collection('Translations').createIndex({ language: 1, type: 1 });
      console.log('  ✅ Translations: { language, type }');
    } catch (e) {
      console.log('  ⚠️  Translations index may already exist:', e.message);
    }
    try {
      await factoryDb.collection('Translations').createIndex({ guid: 1, language: 1 });
      console.log('  ✅ Translations: { guid, language }');
    } catch (e) {
      console.log('  ⚠️  Translations index may already exist:', e.message);
    }
    try {
      await factoryDb.collection('Translations').createIndex({ language: 1, type: 1, projectId: 1 });
      console.log('  ✅ Translations: { language, type, projectId }');
    } catch (e) {
      console.log('  ⚠️  Translations index may already exist:', e.message);
    }

    // projects_catalog collection - CRITICAL for catalog load performance
    try {
      await client.db(dbProjects).collection('projects_catalog').createIndex({ updatedAt: -1 });
      console.log('  ✅ projects_catalog: { updatedAt: -1 }');
    } catch (e) {
      console.log('  ⚠️  projects_catalog index may already exist:', e.message);
    }

    // ===================================
    // PROJECT DATABASES INDEXES
    // ===================================
    console.log('\n📂 Getting all project databases...');
    const catalogDb = client.db(dbProjects);
    const catalog = await catalogDb.collection('projects_catalog').find({}).toArray();
    console.log(`  Found ${catalog.length} projects\n`);

    let successCount = 0;
    let errorCount = 0;

    for (const project of catalog) {
      const dbName = project.dbName;
      if (!dbName) {
        console.log(`⚠️  Skipping project ${project.projectName || project._id} - no dbName`);
        continue;
      }

      try {
        console.log(`📁 Creating indexes for project: ${project.projectName || project._id} (${dbName})`);
        const projDb = client.db(dbName);

        // project_acts collection - query without filters or by name
        try {
          await projDb.collection('project_acts').createIndex({ name: 1 });
          console.log('  ✅ project_acts: { name }');
        } catch (e) {
          // Index may already exist, continue
        }

        // tasks collection - query by projectId and sort by updatedAt
        try {
          await projDb.collection('tasks').createIndex({ projectId: 1, updatedAt: -1 });
          console.log('  ✅ tasks: { projectId, updatedAt }');
        } catch (e) {
          // Index may already exist, continue
        }
        try {
          await projDb.collection('tasks').createIndex({ projectId: 1, id: 1 });
          console.log('  ✅ tasks: { projectId, id }');
        } catch (e) {
          // Index may already exist, continue
        }

        // flow_nodes collection - query by flowId
        try {
          await projDb.collection('flow_nodes').createIndex({ flowId: 1 });
          console.log('  ✅ flow_nodes: { flowId }');
        } catch (e) {
          // Index may already exist, continue
        }
        try {
          await projDb.collection('flow_nodes').createIndex({ flowId: 1, updatedAt: -1 });
          console.log('  ✅ flow_nodes: { flowId, updatedAt }');
        } catch (e) {
          // Index may already exist, continue
        }

        // flow_edges collection - query by flowId
        try {
          await projDb.collection('flow_edges').createIndex({ flowId: 1 });
          console.log('  ✅ flow_edges: { flowId }');
        } catch (e) {
          // Index may already exist, continue
        }
        try {
          await projDb.collection('flow_edges').createIndex({ flowId: 1, updatedAt: -1 });
          console.log('  ✅ flow_edges: { flowId, updatedAt }');
        } catch (e) {
          // Index may already exist, continue
        }

        // variable_mappings collection - query by projectId
        try {
          await projDb.collection('variable_mappings').createIndex({ projectId: 1 });
          console.log('  ✅ variable_mappings: { projectId }');
        } catch (e) {
          // Index may already exist, continue
        }

        // Translations collection - query by type, language, guid
        try {
          await projDb.collection('Translations').createIndex({ language: 1, type: 1 });
          console.log('  ✅ Translations: { language, type }');
        } catch (e) {
          // Index may already exist, continue
        }
        try {
          await projDb.collection('Translations').createIndex({ guid: 1, language: 1 });
          console.log('  ✅ Translations: { guid, language }');
        } catch (e) {
          // Index may already exist, continue
        }
        try {
          await projDb.collection('Translations').createIndex({ type: 1, language: 1, projectId: 1 });
          console.log('  ✅ Translations: { type, language, projectId }');
        } catch (e) {
          // Index may already exist, continue
        }

        successCount++;
        console.log('');
      } catch (error) {
        errorCount++;
        console.error(`  ❌ Error creating indexes for ${dbName}:`, error.message);
        console.log('');
      }
    }

    console.log(`\n🎉 Index creation complete!`);
    console.log(`   ✅ Success: ${successCount} projects`);
    if (errorCount > 0) {
      console.log(`   ⚠️  Errors: ${errorCount} projects`);
    }

  } catch (error) {
    console.error('❌ Error creating indexes:', error);
    throw error;
  } finally {
    await client.close();
    console.log('\n[MongoDB] Connection closed');
  }
}

// Run the script
createIndexes()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });

