const { MongoClient } = require('mongodb');

const MONGODB_URI = 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const DB_FACTORY = 'factory';

async function main() {
    const client = new MongoClient(MONGODB_URI);
    try {
        await client.connect();
        const db = client.db(DB_FACTORY);
        // Template di dati DDT sono in Task_Templates, non type_templates
        const templates = await db.collection('Task_Templates').find({}).toArray();
        const translations = db.collection('Translations');

        console.log(`Checking subData start translations...\n`);

        let foundTranslations = 0;
        let missingTranslations = 0;
        const missingGuids = [];

        templates.forEach(template => {
            // Check subData at root level
            if (Array.isArray(template.subData)) {
                template.subData.forEach(sub => {
                    if (sub.stepPrompts && sub.stepPrompts.start && Array.isArray(sub.stepPrompts.start)) {
                        sub.stepPrompts.start.forEach(guid => {
                            if (typeof guid === 'string' && guid.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
                                missingGuids.push({ guid, template: template.label || template.name, subLabel: sub.label });
                            }
                        });
                    }
                });
            }

            // Check subData within mainData
            if (Array.isArray(template.mainData)) {
                template.mainData.forEach(main => {
                    if (Array.isArray(main.subData)) {
                        main.subData.forEach(sub => {
                            if (sub.stepPrompts && sub.stepPrompts.start && Array.isArray(sub.stepPrompts.start)) {
                                sub.stepPrompts.start.forEach(guid => {
                                    if (typeof guid === 'string' && guid.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
                                        missingGuids.push({ guid, template: template.label || template.name, mainLabel: main.label, subLabel: sub.label });
                                    }
                                });
                            }
                        });
                    }
                });
            }
        });

        console.log(`Found ${missingGuids.length} subData start GUIDs to check\n`);

        // Check if translations exist for these GUIDs
        for (const { guid, template, mainLabel, subLabel } of missingGuids) {
            const trans = await translations.find({ guid, type: 'Template', language: 'en' }).toArray();
            if (trans.length > 0) {
                foundTranslations++;
                console.log(`✅ Found: ${template}${mainLabel ? ` → ${mainLabel}` : ''} → ${subLabel} (${guid.substring(0, 8)}...)`);
            } else {
                missingTranslations++;
                console.log(`❌ MISSING: ${template}${mainLabel ? ` → ${mainLabel}` : ''} → ${subLabel} (${guid.substring(0, 8)}...)`);
            }
        }

        console.log(`\n📊 Summary:`);
        console.log(`  Found translations: ${foundTranslations}`);
        console.log(`  Missing translations: ${missingTranslations}`);

    } finally {
        await client.close();
    }
}

main().catch(console.error);







