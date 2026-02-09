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
        await factoryDb.collection('AgentActs').createIndex({ scope: 1, industry: 1 });
        console.log('  ✅ AgentActs: { scope, industry }');

        // Conditions collection
        await factoryDb.collection('Conditions').createIndex({ scope: 1, industry: 1 });
        console.log('  ✅ Conditions: { scope, industry }');

        // Translations collection (già esistenti ma verifichiamo)
        await factoryDb.collection('Translations').createIndex({ language: 1, type: 1 });
        await factoryDb.collection('Translations').createIndex({ guid: 1, language: 1 });
        await factoryDb.collection('Translations').createIndex({ language: 1, type: 1, projectId: 1 });
        console.log('  ✅ Translations: { language, type }, { guid, language }, { language, type, projectId }');

        // ===================================
        // PROJECT DATABASES INDEXES
        // ===================================
        console.log('\n📂 Getting all project databases...');
        const catalogDb = client.db(dbProjects);
        const catalog = await catalogDb.collection('projects_catalog').find({}).toArray();
        console.log(`  Found ${catalog.length} projects\n`);

        for (const project of catalog) {
            const dbName = project.dbName;
            if (!dbName) continue;

            console.log(`📁 Creating indexes for project: ${project.projectName} (${dbName})`);
            const projDb = client.db(dbName);

            // project_acts collection - query without filters or by name
            await projDb.collection('project_acts').createIndex({ name: 1 });
            await projDb.collection('project_acts').createIndex({ _id: 1, name: 1 });
            console.log('  ✅ project_acts: { name }, { _id, name }');

            // tasks collection - query by projectId and sort by updatedAt
            await projDb.collection('tasks').createIndex({ projectId: 1, updatedAt: -1 });
            await projDb.collection('tasks').createIndex({ projectId: 1, id: 1 }); // For upsert operations
            console.log('  ✅ tasks: { projectId, updatedAt }, { projectId, id }');

            // flow_nodes collection - query by flowId
            await projDb.collection('flow_nodes').createIndex({ flowId: 1 });
            await projDb.collection('flow_nodes').createIndex({ flowId: 1, updatedAt: -1 });
            console.log('  ✅ flow_nodes: { flowId }, { flowId, updatedAt }');

            // flow_edges collection - query by flowId
            await projDb.collection('flow_edges').createIndex({ flowId: 1 });
            await projDb.collection('flow_edges').createIndex({ flowId: 1, updatedAt: -1 });
            console.log('  ✅ flow_edges: { flowId }, { flowId, updatedAt }');

            // project_conditions collection - usually scanned fully, but index on _id is automatic
            // No specific index needed unless you add filters later

            // variable_mappings collection - query by projectId
            await projDb.collection('variable_mappings').createIndex({ projectId: 1 });
            console.log('  ✅ variable_mappings: { projectId }');

            // Translations collection - query by type, language, guid
            await projDb.collection('Translations').createIndex({ language: 1, type: 1 });
            await projDb.collection('Translations').createIndex({ guid: 1, language: 1 });
            await projDb.collection('Translations').createIndex({ type: 1, language: 1, projectId: 1 });
            console.log('  ✅ Translations: { language, type }, { guid, language }, { type, language, projectId }');

            console.log('');
        }

        console.log('🎉 All indexes created successfully!');

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
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('Fatal error:', error);
        process.exit(1);
    });