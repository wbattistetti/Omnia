/**
 * Script per verificare se il database contiene tutti i stepPrompts
 * per main data e sub-data
 */

const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DB_NAME = 'factory';

async function checkDatabase() {
    const client = new MongoClient(MONGODB_URI);

    try {
        await client.connect();
        console.log('✅ Connected to MongoDB\n');

        const db = client.db(DB_NAME);
        const templatesCollection = db.collection('Templates');
        const translationsCollection = db.collection('Translations');

        // Get all templates
        const templates = await templatesCollection.find({}).toArray();
        console.log(`📦 Found ${templates.length} templates\n`);

        const results = {
            templatesWithMainPrompts: 0,
            templatesWithSubDataPrompts: 0,
            templatesMissingMainPrompts: [],
            templatesMissingSubDataPrompts: [],
            subDataItemsWithPrompts: 0,
            subDataItemsWithoutPrompts: 0,
            translationKeysFound: 0,
            translationKeysMissing: []
        };

        for (const template of templates) {
            const kind = template.kind || template.type || template.name || 'unknown';
            const label = template.label || kind;

            console.log(`\n🔍 Checking template: ${label} (${kind})`);

            // Check main data stepPrompts
            if (template.stepPrompts && typeof template.stepPrompts === 'object' && Object.keys(template.stepPrompts).length > 0) {
                results.templatesWithMainPrompts++;
                console.log(`  ✅ Has main data stepPrompts (${Object.keys(template.stepPrompts).length} steps)`);
            } else {
                results.templatesMissingMainPrompts.push({ kind, label });
                console.log(`  ❌ Missing main data stepPrompts`);
            }

            // Check sub-data
            const subData = template.subData || [];
            if (Array.isArray(subData) && subData.length > 0) {
                console.log(`  📦 Found ${subData.length} sub-data items`);

                let hasSubDataPrompts = false;
                for (const subItem of subData) {
                    const subLabel = subItem.label || subItem.name || 'unknown';
                    if (subItem.stepPrompts && typeof subItem.stepPrompts === 'object' && Object.keys(subItem.stepPrompts).length > 0) {
                        results.subDataItemsWithPrompts++;
                        hasSubDataPrompts = true;
                        console.log(`    ✅ ${subLabel}: has stepPrompts (${Object.keys(subItem.stepPrompts).length} steps)`);

                        // Check translation keys for this sub-data
                        Object.entries(subItem.stepPrompts).forEach(([stepKey, keys]) => {
                            if (Array.isArray(keys)) {
                                keys.forEach(key => {
                                    if (key.startsWith('template.')) {
                                        results.translationKeysFound++;
                                    }
                                });
                            }
                        });
                    } else {
                        results.subDataItemsWithoutPrompts++;
                        console.log(`    ❌ ${subLabel}: missing stepPrompts`);
                    }
                }

                if (hasSubDataPrompts) {
                    results.templatesWithSubDataPrompts++;
                } else {
                    results.templatesMissingSubDataPrompts.push({ kind, label, subDataCount: subData.length });
                }
            } else {
                console.log(`  ⏭️  No sub-data`);
            }

            // Check main data translation keys
            if (template.stepPrompts) {
                Object.entries(template.stepPrompts).forEach(([stepKey, keys]) => {
                    if (Array.isArray(keys)) {
                        keys.forEach(key => {
                            if (key.startsWith('template.')) {
                                results.translationKeysFound++;
                            }
                        });
                    }
                });
            }
        }

        // Check if translation keys exist in Translations collection
        console.log(`\n\n🔍 Checking translation keys in Translations collection...`);
        const allTranslationKeys = await translationsCollection.find({}).toArray();
        console.log(`  📦 Found ${allTranslationKeys.length} translation keys in database`);

        // Sample check: look for sub-data translation keys
        const subDataTranslationKeys = allTranslationKeys.filter(t => t._id && t._id.startsWith('template.sub.'));
        console.log(`  📦 Found ${subDataTranslationKeys.length} sub-data translation keys`);

        if (subDataTranslationKeys.length > 0) {
            console.log(`  📋 Sample sub-data keys:`);
            subDataTranslationKeys.slice(0, 5).forEach(t => {
                console.log(`    - ${t._id}`);
                if (t.en) console.log(`      EN: ${t.en.substring(0, 50)}...`);
                if (t.it) console.log(`      IT: ${t.it.substring(0, 50)}...`);
                if (t.pt) console.log(`      PT: ${t.pt.substring(0, 50)}...`);
            });
        }

        // Summary
        console.log(`\n\n═══════════════════════════════════════════════════════════`);
        console.log(`📊 SUMMARY`);
        console.log(`═══════════════════════════════════════════════════════════\n`);

        console.log(`Main Data:`);
        console.log(`  ✅ Templates with stepPrompts: ${results.templatesWithMainPrompts}/${templates.length}`);
        console.log(`  ❌ Templates missing stepPrompts: ${results.templatesMissingMainPrompts.length}`);
        if (results.templatesMissingMainPrompts.length > 0) {
            console.log(`  Missing in:`);
            results.templatesMissingMainPrompts.forEach(t => console.log(`    - ${t.label} (${t.kind})`));
        }

        console.log(`\nSub Data:`);
        console.log(`  ✅ Templates with sub-data stepPrompts: ${results.templatesWithSubDataPrompts}`);
        console.log(`  ❌ Templates missing sub-data stepPrompts: ${results.templatesMissingSubDataPrompts.length}`);
        if (results.templatesMissingSubDataPrompts.length > 0) {
            console.log(`  Missing in:`);
            results.templatesMissingSubDataPrompts.forEach(t => {
                console.log(`    - ${t.label} (${t.kind}) - ${t.subDataCount} sub-data items`);
            });
        }

        console.log(`\nSub Data Items:`);
        console.log(`  ✅ Items with stepPrompts: ${results.subDataItemsWithPrompts}`);
        console.log(`  ❌ Items without stepPrompts: ${results.subDataItemsWithoutPrompts}`);

        console.log(`\nTranslation Keys:`);
        console.log(`  📦 Total keys found in templates: ${results.translationKeysFound}`);
        console.log(`  📦 Total keys in Translations collection: ${allTranslationKeys.length}`);
        console.log(`  📦 Sub-data keys in Translations: ${subDataTranslationKeys.length}`);

        // Check specific template (Time)
        console.log(`\n\n🔍 Detailed check for 'Time' template:`);
        const timeTemplate = templates.find(t =>
            (t.kind || t.type || t.name || '').toLowerCase() === 'time' ||
            (t.label || '').toLowerCase() === 'time'
        );

        if (timeTemplate) {
            console.log(`  ✅ Found Time template`);
            console.log(`  Main data stepPrompts: ${timeTemplate.stepPrompts ? '✅ Yes' : '❌ No'}`);
            if (timeTemplate.stepPrompts) {
                console.log(`    Steps: ${Object.keys(timeTemplate.stepPrompts).join(', ')}`);
            }

            const timeSubData = timeTemplate.subData || [];
            console.log(`  Sub-data count: ${timeSubData.length}`);
            timeSubData.forEach((sub, idx) => {
                const subLabel = sub.label || sub.name || `sub-${idx}`;
                console.log(`    ${idx + 1}. ${subLabel}:`);
                console.log(`      stepPrompts: ${sub.stepPrompts ? '✅ Yes' : '❌ No'}`);
                if (sub.stepPrompts) {
                    console.log(`      Steps: ${Object.keys(sub.stepPrompts).join(', ')}`);
                    Object.entries(sub.stepPrompts).forEach(([stepKey, keys]) => {
                        if (Array.isArray(keys)) {
                            console.log(`        ${stepKey}: ${keys.join(', ')}`);
                        }
                    });
                }
            });
        } else {
            console.log(`  ❌ Time template not found`);
        }

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await client.close();
        console.log('\n🔌 Disconnected from MongoDB');
    }
}

checkDatabase().catch(console.error);
