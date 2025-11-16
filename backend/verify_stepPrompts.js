/**
 * Script per verificare stepPrompts nei template e nelle translations
 * Verifica:
 * 1. Se i template hanno stepPrompts (mainData e subData)
 * 2. Se le chiavi stepPrompts esistono nella collezione Translations
 * 3. Se i testi sono presenti per tutte le lingue (en, it, pt)
 */

const { MongoClient } = require('mongodb');

// Usa la stessa URI del server
const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const DB_NAME = 'factory';

async function verifyStepPrompts() {
    const client = new MongoClient(uri);

    try {
        await client.connect();
        console.log('✅ Connected to MongoDB\n');

        const db = client.db(DB_NAME);
        const templatesCollection = db.collection('Task_Templates'); // ✅ Collezione corretta per DDT
        const translationsCollection = db.collection('Translations');

        // Get all templates
        const templates = await templatesCollection.find({}).toArray();
        console.log(`📦 Found ${templates.length} templates in Task_Types\n`);

        const results = {
            templatesChecked: 0,
            templatesWithMainPrompts: 0,
            templatesWithSubDataPrompts: 0,
            templatesMissingMainPrompts: [],
            templatesMissingSubDataPrompts: [],
            mainDataItemsWithPrompts: 0,
            mainDataItemsWithoutPrompts: 0,
            subDataItemsWithPrompts: 0,
            subDataItemsWithoutPrompts: 0,
            translationKeysChecked: 0,
            translationKeysFound: 0,
            translationKeysMissing: [],
            translationKeysIncomplete: [] // Chiavi che esistono ma mancano traduzioni
        };

        // Get all translation keys for quick lookup
        const allTranslations = await translationsCollection.find({}).toArray();
        const translationMap = new Map();
        allTranslations.forEach(t => {
            if (t._id) {
                translationMap.set(t._id, {
                    en: t.en || null,
                    it: t.it || null,
                    pt: t.pt || null
                });
            }
        });
        console.log(`📦 Loaded ${translationMap.size} translation keys for lookup\n`);

        for (const template of templates) {
            results.templatesChecked++;
            const templateName = template.name || template._id || 'unknown';
            const templateLabel = template.label || templateName;

            console.log(`\n🔍 [${results.templatesChecked}/${templates.length}] Checking template: ${templateLabel} (${templateName})`);

            // Check mainData stepPrompts
            const mainData = template.mainData || [];
            if (Array.isArray(mainData) && mainData.length > 0) {
                console.log(`  📦 Found ${mainData.length} mainData items`);

                for (const mainItem of mainData) {
                    const mainLabel = mainItem.label || 'unknown';

                    if (mainItem.stepPrompts && typeof mainItem.stepPrompts === 'object' && Object.keys(mainItem.stepPrompts).length > 0) {
                        results.mainDataItemsWithPrompts++;
                        results.templatesWithMainPrompts++;
                        console.log(`    ✅ ${mainLabel}: has stepPrompts (${Object.keys(mainItem.stepPrompts).length} steps)`);

                        // Check translation keys for this main data
                        Object.entries(mainItem.stepPrompts).forEach(([stepKey, keys]) => {
                            if (Array.isArray(keys)) {
                                keys.forEach(key => {
                                    results.translationKeysChecked++;
                                    // Check both template.* and direct GUID format
                                    const isTemplateKey = key.startsWith('template.');
                                    const isGuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key);

                                    if (isTemplateKey || isGuid) {
                                        const translation = translationMap.get(key);
                                        if (translation) {
                                            results.translationKeysFound++;
                                            // Check if all languages are present
                                            const missingLangs = [];
                                            if (!translation.en) missingLangs.push('en');
                                            if (!translation.it) missingLangs.push('it');
                                            if (!translation.pt) missingLangs.push('pt');

                                            if (missingLangs.length > 0) {
                                                results.translationKeysIncomplete.push({
                                                    key,
                                                    template: templateLabel,
                                                    main: mainLabel,
                                                    step: stepKey,
                                                    missing: missingLangs
                                                });
                                            }
                                        } else {
                                            results.translationKeysMissing.push({
                                                key,
                                                template: templateLabel,
                                                main: mainLabel,
                                                step: stepKey
                                            });
                                        }
                                    }
                                });
                            }
                        });
                    } else {
                        results.mainDataItemsWithoutPrompts++;
                        console.log(`    ❌ ${mainLabel}: missing stepPrompts`);
                    }

                    // Check subData stepPrompts
                    const subData = mainItem.subData || [];
                    if (Array.isArray(subData) && subData.length > 0) {
                        console.log(`      📦 Found ${subData.length} subData items`);

                        let hasSubDataPrompts = false;
                        for (const subItem of subData) {
                            const subLabel = subItem.label || 'unknown';

                            if (subItem.stepPrompts && typeof subItem.stepPrompts === 'object' && Object.keys(subItem.stepPrompts).length > 0) {
                                results.subDataItemsWithPrompts++;
                                hasSubDataPrompts = true;
                                console.log(`        ✅ ${subLabel}: has stepPrompts (${Object.keys(subItem.stepPrompts).length} steps)`);

                                // Check translation keys for this sub-data
                                Object.entries(subItem.stepPrompts).forEach(([stepKey, keys]) => {
                                    if (Array.isArray(keys)) {
                                        keys.forEach(key => {
                                            results.translationKeysChecked++;
                                            if (key.startsWith('template.')) {
                                                const translation = translationMap.get(key);
                                                if (translation) {
                                                    results.translationKeysFound++;
                                                    // Check if all languages are present
                                                    const missingLangs = [];
                                                    if (!translation.en) missingLangs.push('en');
                                                    if (!translation.it) missingLangs.push('it');
                                                    if (!translation.pt) missingLangs.push('pt');

                                                    if (missingLangs.length > 0) {
                                                        results.translationKeysIncomplete.push({
                                                            key,
                                                            template: templateLabel,
                                                            main: mainLabel,
                                                            sub: subLabel,
                                                            step: stepKey,
                                                            missing: missingLangs
                                                        });
                                                    }
                                                } else {
                                                    results.translationKeysMissing.push({
                                                        key,
                                                        template: templateLabel,
                                                        main: mainLabel,
                                                        sub: subLabel,
                                                        step: stepKey
                                                    });
                                                }
                                            }
                                        });
                                    }
                                });
                            } else {
                                results.subDataItemsWithoutPrompts++;
                                console.log(`        ❌ ${subLabel}: missing stepPrompts`);
                            }
                        }

                        if (hasSubDataPrompts) {
                            results.templatesWithSubDataPrompts++;
                        } else if (subData.length > 0) {
                            results.templatesMissingSubDataPrompts.push({
                                template: templateLabel,
                                name: templateName,
                                main: mainLabel,
                                subDataCount: subData.length
                            });
                        }
                    }
                }
            } else {
                // Check root level stepPrompts (for atomic templates)
                if (template.stepPrompts && typeof template.stepPrompts === 'object' && Object.keys(template.stepPrompts).length > 0) {
                    results.templatesWithMainPrompts++;
                    console.log(`  ✅ Has root level stepPrompts (${Object.keys(template.stepPrompts).length} steps)`);

                    // Check translation keys
                    Object.entries(template.stepPrompts).forEach(([stepKey, keys]) => {
                        if (Array.isArray(keys)) {
                            keys.forEach(key => {
                                results.translationKeysChecked++;
                                // Check both template.* and direct GUID format
                                const isTemplateKey = key.startsWith('template.');
                                const isGuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key);

                                if (isTemplateKey || isGuid) {
                                    const translation = translationMap.get(key);
                                    if (translation) {
                                        results.translationKeysFound++;
                                        const missingLangs = [];
                                        if (!translation.en) missingLangs.push('en');
                                        if (!translation.it) missingLangs.push('it');
                                        if (!translation.pt) missingLangs.push('pt');

                                        if (missingLangs.length > 0) {
                                            results.translationKeysIncomplete.push({
                                                key,
                                                template: templateLabel,
                                                step: stepKey,
                                                missing: missingLangs
                                            });
                                        }
                                    } else {
                                        results.translationKeysMissing.push({
                                            key,
                                            template: templateLabel,
                                            step: stepKey
                                        });
                                    }
                                }
                            });
                        }
                    });
                } else {
                    results.templatesMissingMainPrompts.push({
                        template: templateLabel,
                        name: templateName
                    });
                    console.log(`  ❌ Missing root level stepPrompts`);
                }
            }
        }

        // Summary
        console.log(`\n\n${'='.repeat(70)}`);
        console.log(`📊 SUMMARY`);
        console.log(`${'='.repeat(70)}\n`);

        console.log(`Templates:`);
        console.log(`  📦 Total checked: ${results.templatesChecked}`);
        console.log(`  ✅ With mainData stepPrompts: ${results.templatesWithMainPrompts}`);
        console.log(`  ✅ With subData stepPrompts: ${results.templatesWithSubDataPrompts}`);
        console.log(`  ❌ Missing mainData stepPrompts: ${results.templatesMissingMainPrompts.length}`);
        console.log(`  ❌ Missing subData stepPrompts: ${results.templatesMissingSubDataPrompts.length}`);

        console.log(`\nMain Data Items:`);
        console.log(`  ✅ With stepPrompts: ${results.mainDataItemsWithPrompts}`);
        console.log(`  ❌ Without stepPrompts: ${results.mainDataItemsWithoutPrompts}`);

        console.log(`\nSub Data Items:`);
        console.log(`  ✅ With stepPrompts: ${results.subDataItemsWithPrompts}`);
        console.log(`  ❌ Without stepPrompts: ${results.subDataItemsWithoutPrompts}`);

        console.log(`\nTranslation Keys:`);
        console.log(`  📦 Total checked: ${results.translationKeysChecked}`);
        console.log(`  ✅ Found in Translations: ${results.translationKeysFound}`);
        console.log(`  ❌ Missing in Translations: ${results.translationKeysMissing.length}`);
        console.log(`  ⚠️  Incomplete (missing languages): ${results.translationKeysIncomplete.length}`);

        // Detailed missing lists
        if (results.templatesMissingMainPrompts.length > 0) {
            console.log(`\n❌ Templates missing mainData stepPrompts:`);
            results.templatesMissingMainPrompts.forEach(t => {
                console.log(`    - ${t.template} (${t.name})`);
            });
        }

        if (results.templatesMissingSubDataPrompts.length > 0) {
            console.log(`\n❌ Templates missing subData stepPrompts:`);
            results.templatesMissingSubDataPrompts.forEach(t => {
                console.log(`    - ${t.template} (${t.name}) - Main: ${t.main} - ${t.subDataCount} subData items`);
            });
        }

        // Check specific templates that are commonly used
        console.log(`\n\n🔍 Detailed check for commonly used templates:`);
        const dateTemplate = templates.find(t => (t.name || '').toLowerCase() === 'date' && t.mainData);
        const nameTemplate = templates.find(t => (t.name || '').toLowerCase() === 'name' && t.mainData);
        const addressTemplate = templates.find(t => (t.name || '').toLowerCase() === 'address' && t.mainData);

        [dateTemplate, nameTemplate, addressTemplate].forEach((template, idx) => {
            const templateNames = ['Date', 'Full name', 'Address'];
            if (template) {
                console.log(`\n  📋 ${templateNames[idx]} template (${template.name}):`);
                console.log(`    Has mainData: ${!!template.mainData}`);
                if (template.mainData && template.mainData.length > 0) {
                    template.mainData.forEach((main, mainIdx) => {
                        console.log(`      Main ${mainIdx + 1}: ${main.label}`);
                        console.log(`        Has stepPrompts: ${!!main.stepPrompts}`);
                        if (main.stepPrompts) {
                            console.log(`        Steps: ${Object.keys(main.stepPrompts).join(', ')}`);
                        }
                        if (main.subData && main.subData.length > 0) {
                            console.log(`        SubData count: ${main.subData.length}`);
                            main.subData.forEach((sub, subIdx) => {
                                console.log(`          Sub ${subIdx + 1}: ${sub.label} - Has stepPrompts: ${!!sub.stepPrompts}`);
                            });
                        }
                    });
                }
                console.log(`    Has root stepPrompts: ${!!template.stepPrompts}`);
                if (template.stepPrompts) {
                    console.log(`    Root steps: ${Object.keys(template.stepPrompts).join(', ')}`);
                }
            } else {
                console.log(`\n  ❌ ${templateNames[idx]} template not found with mainData`);
            }
        });

        if (results.translationKeysMissing.length > 0) {
            console.log(`\n❌ Missing translation keys (first 10):`);
            results.translationKeysMissing.slice(0, 10).forEach(item => {
                console.log(`    - ${item.key}`);
                console.log(`      Template: ${item.template}, Main: ${item.main || 'root'}${item.sub ? `, Sub: ${item.sub}` : ''}, Step: ${item.step}`);
            });
            if (results.translationKeysMissing.length > 10) {
                console.log(`    ... and ${results.translationKeysMissing.length - 10} more`);
            }
        }

        if (results.translationKeysIncomplete.length > 0) {
            console.log(`\n⚠️  Incomplete translation keys (first 10):`);
            results.translationKeysIncomplete.slice(0, 10).forEach(item => {
                console.log(`    - ${item.key}`);
                console.log(`      Template: ${item.template}, Main: ${item.main || 'root'}${item.sub ? `, Sub: ${item.sub}` : ''}, Step: ${item.step}`);
                console.log(`      Missing languages: ${item.missing.join(', ')}`);
            });
            if (results.translationKeysIncomplete.length > 10) {
                console.log(`    ... and ${results.translationKeysIncomplete.length - 10} more`);
            }
        }

    } catch (error) {
        console.error('❌ Error:', error);
        console.error(error.stack);
    } finally {
        await client.close();
        console.log('\n🔌 Disconnected from MongoDB');
    }
}

verifyStepPrompts().catch(console.error);

