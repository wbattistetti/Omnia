const { MongoClient } = require('mongodb');

const uri = process.env.MONGO_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbFactory = 'factory';

/**
 * Migrates DDT node labels and Task Template labels to Translations
 *
 * For DDT Templates:
 * - Extracts labels from mainData[].label and mainData[].subData[].label
 * - Saves to factory.Translations with type: 'Template'
 *
 * For Task Templates:
 * - Extracts label from template.label
 * - Saves to factory.Translations with type: 'Template'
 */
async function migrateLabelsToTranslations() {
    const client = new MongoClient(uri);

    try {
        await client.connect();
        console.log('✅ Connected to MongoDB');

        const factoryDb = client.db(dbFactory);
        const taskTemplatesColl = factoryDb.collection('Task_Templates');
        const translationsColl = factoryDb.collection('Translations');

        // ============================================
        // 1. MIGRATE DDT TEMPLATES (type: 'data')
        // ============================================
        console.log('\n📦 [DDT Templates] Loading DDT templates...');
        const ddtTemplates = await taskTemplatesColl.find({ type: 'data' }).toArray();
        console.log(`   Found ${ddtTemplates.length} DDT templates`);

        const ddtTranslations = [];
        let ddtNodesProcessed = 0;

        for (const ddt of ddtTemplates) {
            const ddtId = ddt.id || ddt._id || 'unknown';

            // Helper function to process a node (main or sub)
            // Creates translations for EN, IT, and PT
            const processNode = (node, nodeType = 'main') => {
                if (!node) return;

                const nodeId = node.id || node._id;
                const nodeLabel = node.label || node.name || '';

                if (!nodeId || !nodeLabel) {
                    return;
                }

                // Create translations for all three languages
                const languages = ['en', 'it', 'pt'];
                languages.forEach(lang => {
                    ddtTranslations.push({
                        guid: nodeId,
                        text: nodeLabel, // Same label for all languages (can be translated later)
                        type: 'Template',
                        language: lang,
                        projectId: null,
                        createdAt: new Date(),
                        updatedAt: new Date()
                    });
                });
                ddtNodesProcessed++;
                console.log(`   ✅ ${nodeType} node: ${nodeId.substring(0, 20)}... → "${nodeLabel}" (EN/IT/PT)`);
            };

            // Case 1: mainData as array (new structure)
            if (ddt.mainData && Array.isArray(ddt.mainData)) {
                for (const mainNode of ddt.mainData) {
                    processNode(mainNode, 'main');

                    // Process subData if exists
                    if (mainNode.subData && Array.isArray(mainNode.subData)) {
                        for (const subNode of mainNode.subData) {
                            processNode(subNode, 'sub');
                        }
                    }
                }
                continue;
            }

            // Case 2: mainData as single object (old structure)
            if (ddt.mainData && typeof ddt.mainData === 'object' && !Array.isArray(ddt.mainData)) {
                processNode(ddt.mainData, 'main');

                // Process subData if exists
                if (ddt.mainData.subData && Array.isArray(ddt.mainData.subData)) {
                    for (const subNode of ddt.mainData.subData) {
                        processNode(subNode, 'sub');
                    }
                }
                continue;
            }

            // Case 3: DDT root has label/id (template base without mainData)
            if (ddt.label || ddt.name) {
                const rootId = ddt.id || ddt._id;
                const rootLabel = ddt.label || ddt.name;

                if (rootId && rootLabel) {
                    // Create translations for all three languages
                    const languages = ['en', 'it', 'pt'];
                    languages.forEach(lang => {
                        ddtTranslations.push({
                            guid: rootId,
                            text: rootLabel, // Same label for all languages (can be translated later)
                            type: 'Template',
                            language: lang,
                            projectId: null,
                            createdAt: new Date(),
                            updatedAt: new Date()
                        });
                    });
                    ddtNodesProcessed++;
                    console.log(`   ✅ DDT root: ${rootId.substring(0, 20)}... → "${rootLabel}" (EN/IT/PT)`);
                }
            } else {
                console.log(`   ⚠️  Skipping DDT ${ddtId}: no mainData, label, or name`);
            }
        }

        console.log(`\n📊 [DDT Templates] Processed ${ddtNodesProcessed} nodes, ${ddtTranslations.length} translations to save (${ddtNodesProcessed} nodes × 3 languages)`);

        // ============================================
        // 2. MIGRATE TASK TEMPLATES (no type: 'data')
        // ============================================
        console.log('\n📦 [Task Templates] Loading Task templates...');
        const taskTemplates = await taskTemplatesColl.find({
            $or: [
                { type: { $exists: false } },
                { type: { $ne: 'data' } }
            ]
        }).toArray();
        console.log(`   Found ${taskTemplates.length} Task templates`);

        const taskTranslations = [];
        let taskTemplatesProcessed = 0;

        for (const template of taskTemplates) {
            const templateId = template.id || template._id;
            const templateLabel = template.label || template.name || '';

            if (!templateId || !templateLabel) {
                console.log(`   ⚠️  Skipping template: no id or label`);
                continue;
            }

            // Create translations for all three languages
            const languages = ['en', 'it', 'pt'];
            languages.forEach(lang => {
                taskTranslations.push({
                    guid: templateId,
                    text: templateLabel, // Same label for all languages (can be translated later)
                    type: 'Template',
                    language: lang,
                    projectId: null,
                    createdAt: new Date(),
                    updatedAt: new Date()
                });
            });
            taskTemplatesProcessed++;
            console.log(`   ✅ Task template: ${templateId.substring(0, 20)}... → "${templateLabel}" (EN/IT/PT)`);
        }

        console.log(`\n📊 [Task Templates] Processed ${taskTemplatesProcessed} templates, ${taskTranslations.length} translations to save (${taskTemplatesProcessed} templates × 3 languages)`);

        // ============================================
        // 3. SAVE TO TRANSLATIONS (BULK UPSERT)
        // ============================================
        const allTranslations = [...ddtTranslations, ...taskTranslations];
        console.log(`\n💾 [Translations] Saving ${allTranslations.length} translations...`);

        if (allTranslations.length > 0) {
            const bulkOps = allTranslations.map(trans => ({
                updateOne: {
                    filter: {
                        guid: trans.guid,
                        language: trans.language,
                        type: trans.type,
                        $or: [
                            { projectId: null },
                            { projectId: { $exists: false } }
                        ]
                    },
                    update: {
                        $set: {
                            guid: trans.guid,
                            text: trans.text,
                            type: trans.type,
                            language: trans.language,
                            projectId: null,
                            updatedAt: trans.updatedAt
                        },
                        $setOnInsert: {
                            createdAt: trans.createdAt
                        }
                    },
                    upsert: true
                }
            }));

            const result = await translationsColl.bulkWrite(bulkOps, { ordered: false });
            console.log(`\n✅ [Translations] Migration complete!`);
            console.log(`   - Inserted: ${result.upsertedCount}`);
            console.log(`   - Updated: ${result.modifiedCount}`);
            console.log(`   - Total: ${result.upsertedCount + result.modifiedCount}`);
        } else {
            console.log(`\n⚠️  No translations to save`);
        }

    } catch (error) {
        console.error('❌ Migration error:', error);
        throw error;
    } finally {
        await client.close();
        console.log('\n✅ Connection closed');
    }
}

// Run migration
if (require.main === module) {
    migrateLabelsToTranslations()
        .then(() => {
            console.log('\n🎉 Migration completed successfully!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n💥 Migration failed:', error);
            process.exit(1);
        });
}

module.exports = { migrateLabelsToTranslations };