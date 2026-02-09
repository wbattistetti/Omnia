const { MongoClient } = require('mongodb');

const MONGODB_URI = 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const DB_FACTORY = 'factory';

// Import translation functions from generate_all_prompts.js
// We'll copy them here to avoid circular dependencies

/**
 * Translate to Italian
 */
function translateToItalian(stepType, kind, fieldLabel, englishMessage) {
    switch (stepType) {
        case 'start':
            switch (kind) {
                case 'phone':
                    return 'Qual è il suo numero di telefono (+prefisso paese)?';
                case 'email':
                    return 'Qual è il suo indirizzo email?';
                case 'date':
                    return 'Qual è la sua data di nascita (GG/MM/AAAA)?';
                case 'name':
                    return 'Qual è il suo nome completo?';
                case 'address':
                    return 'Qual è il suo indirizzo?';
                case 'day':
                    return 'Qual è il giorno?';
                case 'month':
                    return 'Qual è il mese?';
                case 'year':
                    return 'Qual è l\'anno (AAAA)?';
                case 'time':
                    return 'Qual è l\'ora?';
                case 'hour':
                    return 'Qual è l\'ora?';
                case 'minute':
                    return 'Qual è il minuto?';
                case 'second':
                    return 'Qual è il secondo?';
                default:
                    return `Qual è il suo ${fieldLabel.toLowerCase()}?`;
            }

        case 'noMatch':
            switch (kind) {
                case 'phone':
                    return [
                        'Non ho capito. Numero di telefono (+prefisso paese)?',
                        'Non sembra un numero di telefono valido. Può ripetere?',
                        'Non sono riuscito a capire. Può dire di nuovo il numero di telefono?'
                    ];
                case 'email':
                    return [
                        'Non ho capito. Indirizzo email?',
                        'Non sembra un indirizzo email valido. Può ripetere?',
                        'Non sono riuscito a capire. Può dire di nuovo l\'email?'
                    ];
                default:
                    return [
                        'Non ho capito. Può ripetere?',
                        'Non sembra valido. Può ripetere?',
                        'Non sono riuscito a capire. Può dire di nuovo?'
                    ];
            }

        case 'noInput':
            switch (kind) {
                case 'phone':
                    return [
                        'Scusi, può ripetere il numero di telefono?',
                        'Può dire di nuovo il numero di telefono?',
                        'Non ho sentito. Numero di telefono (+prefisso paese)?'
                    ];
                case 'email':
                    return [
                        'Scusi, può ripetere l\'indirizzo email?',
                        'Può dire di nuovo l\'email?',
                        'Non ho sentito. Indirizzo email?'
                    ];
                default:
                    return [
                        'Scusi, può ripetere?',
                        'Può dire di nuovo?',
                        'Non ho sentito, può ripetere per favore?'
                    ];
            }

        case 'confirmation':
            return [
                'È corretto: {{input}}?',
                'Può confermare: {{input}}?'
            ];

        case 'notConfirmed':
            return [
                'Non confermato. Fornisca il valore corretto.',
                'Non era corretto. Può ripetere?'
            ];

        case 'success':
            return 'Grazie, ricevuto.';

        default:
            return englishMessage;
    }
}

/**
 * Translate to Portuguese
 */
function translateToPortuguese(stepType, kind, fieldLabel, englishMessage) {
    switch (stepType) {
        case 'start':
            switch (kind) {
                case 'phone':
                    return 'Qual é o seu número de telefone (+código do país)?';
                case 'email':
                    return 'Qual é o seu endereço de email?';
                case 'date':
                    return 'Qual é a sua data de nascimento (DD/MM/AAAA)?';
                case 'name':
                    return 'Qual é o seu nome completo?';
                case 'address':
                    return 'Qual é o seu endereço?';
                case 'day':
                    return 'Qual é o dia?';
                case 'month':
                    return 'Qual é o mês?';
                case 'year':
                    return 'Qual é o ano (AAAA)?';
                case 'time':
                    return 'Qual é a hora?';
                case 'hour':
                    return 'Qual é a hora?';
                case 'minute':
                    return 'Qual é o minuto?';
                case 'second':
                    return 'Qual é o segundo?';
                default:
                    return `Qual é o seu ${fieldLabel.toLowerCase()}?`;
            }

        case 'noMatch':
            switch (kind) {
                case 'phone':
                    return [
                        'Não entendi. Número de telefone (+código do país)?',
                        'Não parece um número de telefone válido. Pode repetir?',
                        'Não consegui entender. Pode dizer o número de telefone novamente?'
                    ];
                case 'email':
                    return [
                        'Não entendi. Endereço de email?',
                        'Não parece um endereço de email válido. Pode repetir?',
                        'Não consegui entender. Pode dizer o email novamente?'
                    ];
                default:
                    return [
                        'Não entendi. Pode repetir?',
                        'Não parece válido. Pode repetir?',
                        'Não consegui entender. Pode dizer novamente?'
                    ];
            }

        case 'noInput':
            switch (kind) {
                case 'phone':
                    return [
                        'Desculpe, pode repetir o número de telefone?',
                        'Pode dizer o número de telefone novamente?',
                        'Não ouvi. Número de telefone (+código do país)?'
                    ];
                case 'email':
                    return [
                        'Desculpe, pode repetir o endereço de email?',
                        'Pode dizer o email novamente?',
                        'Não ouvi. Endereço de email?'
                    ];
                default:
                    return [
                        'Desculpe, pode repetir?',
                        'Pode dizer novamente?',
                        'Não ouvi, pode repetir por favor?'
                    ];
            }

        case 'confirmation':
            return [
                'Está correto: {{input}}?',
                'Pode confirmar: {{input}}?'
            ];

        case 'notConfirmed':
            return [
                'Não confirmado. Forneça o valor correto.',
                'Não estava correto. Pode repetir?'
            ];

        case 'success':
            return 'Obrigado, recebido.';

        default:
            return englishMessage;
    }
}

/**
 * Infer field kind from label and type
 */
function inferKind(label, type) {
    const labelLower = (label || '').toLowerCase();
    const typeLower = (type || '').toLowerCase();

    if (labelLower.includes('phone') || labelLower.includes('tel') || typeLower === 'phone') {
        return 'phone';
    } else if (labelLower.includes('email') || typeLower === 'email') {
        return 'email';
    } else if (labelLower.includes('date') || labelLower.includes('birth') || typeLower === 'date') {
        return 'date';
    } else if (labelLower.includes('name') || typeLower === 'name') {
        return 'name';
    } else if (labelLower.includes('address') || typeLower === 'address') {
        return 'address';
    } else if (labelLower.includes('day') || labelLower === 'day') {
        return 'day';
    } else if (labelLower.includes('month') || typeLower === 'month') {
        return 'month';
    } else if (labelLower.includes('year') || labelLower === 'year') {
        return 'year';
    } else if (typeLower === 'number' || typeLower === 'numeric') {
        return 'number';
    } else if (labelLower.includes('time') || typeLower === 'time') {
        return 'time';
    } else if (labelLower.includes('hour') || labelLower === 'hour') {
        return 'hour';
    } else if (labelLower.includes('minute') || labelLower === 'minute') {
        return 'minute';
    } else if (labelLower.includes('second') || labelLower === 'second') {
        return 'second';
    }
    return 'generic';
}

/**
 * Extract step type from English message pattern
 */
function inferStepTypeFromMessage(enMessage) {
    const msg = (enMessage || '').toLowerCase();

    if (msg.includes('correct') || msg.includes('confirm')) {
        return 'confirmation';
    } else if (msg.includes('not confirmed') || msg.includes('not correct')) {
        return 'notConfirmed';
    } else if (msg.includes('thanks') || msg.includes('got it')) {
        return 'success';
    } else if (msg.includes("didn't catch") || msg.includes("couldn't parse") || msg.includes("doesn't look")) {
        return 'noMatch';
    } else if (msg.includes('repeat') || msg.includes('say it again')) {
        if (msg.includes("didn't catch") || msg.includes("couldn't parse")) {
            return 'noMatch';
        }
        return 'noInput';
    } else if (msg.includes('what is') || msg.includes('?')) {
        return 'start';
    }
    return 'start'; // default
}

/**
 * Main function to update translations
 */
async function main() {
    console.log('🔄 Starting translation update...\n');

    const client = new MongoClient(MONGODB_URI);
    const stats = {
        totalTranslations: 0,
        updatedIt: 0,
        updatedPt: 0,
        skipped: 0,
        errors: []
    };

    try {
        await client.connect();
        console.log('✅ Connected to MongoDB\n');

        const factoryDb = client.db(DB_FACTORY);
        const translationsCollection = factoryDb.collection('Translations');
        // Template di dati DDT sono in Task_Templates, non type_templates
        const templatesCollection = factoryDb.collection('Task_Templates');

        // Get all Template translations
        const allTranslations = await translationsCollection.find({ type: 'Template' }).toArray();
        console.log(`📊 Found ${allTranslations.length} Template translations\n`);

        // Get all templates to map GUIDs to field info
        const templates = await templatesCollection.find({}).toArray();
        console.log(`📄 Loaded ${templates.length} templates for context\n`);

        // Build a map of GUID to field info from templates
        const guidToFieldInfo = new Map();

        function extractstepsFromTemplate(template, path = '') {
            // Root level
            if (template.steps && typeof template.steps === 'object') {
                for (const [stepKey, stepValue] of Object.entries(template.steps)) {
                    if (Array.isArray(stepValue)) {
                        stepValue.forEach(guid => {
                            if (typeof guid === 'string' && guid.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
                                guidToFieldInfo.set(guid, {
                                    stepType: stepKey,
                                    label: template.label || template.name || 'Data',
                                    type: template.type || 'generic',
                                    path: path || template.label || 'root'
                                });
                            }
                        });
                    }
                }
            }

            // SubData at root
            if (Array.isArray(template.subData)) {
                template.subData.forEach(subItem => {
                    if (subItem.steps && typeof subItem.steps === 'object') {
                        const subPath = `${path || template.label || template.name}/${subItem.label || 'sub'}`;
                        for (const [stepKey, stepValue] of Object.entries(subItem.steps)) {
                            if (Array.isArray(stepValue)) {
                                stepValue.forEach(guid => {
                                    if (typeof guid === 'string' && guid.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
                                        guidToFieldInfo.set(guid, {
                                            stepType: stepKey,
                                            label: subItem.label || 'Sub',
                                            type: subItem.type || 'generic',
                                            path: subPath
                                        });
                                    }
                                });
                            }
                        }
                    }
                });
            }

            // MainData
            if (Array.isArray(template.mainData)) {
                template.mainData.forEach(mainItem => {
                    const mainPath = `${path || template.label || template.name}/${mainItem.label || 'main'}`;

                    // MainData steps
                    if (mainItem.steps && typeof mainItem.steps === 'object') {
                        for (const [stepKey, stepValue] of Object.entries(mainItem.steps)) {
                            if (Array.isArray(stepValue)) {
                                stepValue.forEach(guid => {
                                    if (typeof guid === 'string' && guid.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
                                        guidToFieldInfo.set(guid, {
                                            stepType: stepKey,
                                            label: mainItem.label || 'Main',
                                            type: mainItem.type || 'generic',
                                            path: mainPath
                                        });
                                    }
                                });
                            }
                        }
                    }

                    // SubData within MainData
                    if (Array.isArray(mainItem.subData)) {
                        mainItem.subData.forEach(subItem => {
                            if (subItem.steps && typeof subItem.steps === 'object') {
                                const subPath = `${mainPath}/${subItem.label || 'sub'}`;
                                for (const [stepKey, stepValue] of Object.entries(subItem.steps)) {
                                    if (Array.isArray(stepValue)) {
                                        stepValue.forEach(guid => {
                                            if (typeof guid === 'string' && guid.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
                                                guidToFieldInfo.set(guid, {
                                                    stepType: stepKey,
                                                    label: subItem.label || 'Sub',
                                                    type: subItem.type || 'generic',
                                                    path: subPath
                                                });
                                            }
                                        });
                                    }
                                }
                            }
                        });
                    }
                });
            }
        }

        // Extract GUID mappings from all templates
        templates.forEach(template => {
            extractstepsFromTemplate(template);
        });

        console.log(`🔑 Mapped ${guidToFieldInfo.size} GUIDs to field info\n`);

        // Group translations by GUID
        const translationsByGuid = new Map();
        allTranslations.forEach(trans => {
            if (!translationsByGuid.has(trans.guid)) {
                translationsByGuid.set(trans.guid, []);
            }
            translationsByGuid.get(trans.guid).push(trans);
        });

        console.log(`📝 Processing ${translationsByGuid.size} unique GUIDs...\n`);

        const bulkOps = [];
        let processed = 0;

        for (const [guid, translations] of translationsByGuid) {
            stats.totalTranslations += translations.length;

            // Get field info for this GUID
            const fieldInfo = guidToFieldInfo.get(guid);
            if (!fieldInfo) {
                stats.skipped += translations.length;
                continue;
            }

            // Get English translation
            const enTrans = translations.find(t => t.language === 'en');
            if (!enTrans || !enTrans.text) {
                stats.skipped += translations.length;
                continue;
            }

            const enMessage = enTrans.text;
            const { stepType, label, type } = fieldInfo;
            const kind = inferKind(label, type);

            // Update Italian translation
            const itTrans = translations.find(t => t.language === 'it');
            if (itTrans) {
                const itTranslated = translateToItalian(stepType, kind, label, enMessage);
                let newItText = itTranslated;
                if (Array.isArray(itTranslated)) {
                    // For arrays, try to match the index or use first
                    newItText = itTranslated[0] || enMessage;
                }

                if (newItText !== itTrans.text) {
                    bulkOps.push({
                        updateOne: {
                            filter: { _id: itTrans._id },
                            update: { $set: { text: newItText, updatedAt: new Date() } }
                        }
                    });
                    stats.updatedIt++;
                }
            }

            // Update Portuguese translation
            const ptTrans = translations.find(t => t.language === 'pt');
            if (ptTrans) {
                const ptTranslated = translateToPortuguese(stepType, kind, label, enMessage);
                let newPtText = ptTranslated;
                if (Array.isArray(ptTranslated)) {
                    // For arrays, try to match the index or use first
                    newPtText = ptTranslated[0] || enMessage;
                }

                if (newPtText !== ptTrans.text) {
                    bulkOps.push({
                        updateOne: {
                            filter: { _id: ptTrans._id },
                            update: { $set: { text: newPtText, updatedAt: new Date() } }
                        }
                    });
                    stats.updatedPt++;
                }
            }

            processed++;
            if (processed % 100 === 0) {
                console.log(`  📊 Progress: ${processed}/${translationsByGuid.size} GUIDs processed`);
            }
        }

        // Execute bulk update
        if (bulkOps.length > 0) {
            console.log(`\n💾 Updating ${bulkOps.length} translations...\n`);
            const result = await translationsCollection.bulkWrite(bulkOps, { ordered: false });
            console.log(`✅ Updated ${result.modifiedCount} translations\n`);
        }

        // Final stats
        console.log(`${'='.repeat(60)}`);
        console.log('📊 FINAL STATISTICS');
        console.log(`${'='.repeat(60)}`);
        console.log(`Total translations processed: ${stats.totalTranslations}`);
        console.log(`Italian translations updated: ${stats.updatedIt}`);
        console.log(`Portuguese translations updated: ${stats.updatedPt}`);
        console.log(`Skipped (no field info): ${stats.skipped}`);
        console.log(`Errors: ${stats.errors.length}`);
        console.log(`${'='.repeat(60)}\n`);

        console.log('✅ Translation update complete!\n');

    } catch (error) {
        console.error('\n❌ Fatal error:', error);
        stats.errors.push({ fatal: true, error: error.message, stack: error.stack });
        throw error;
    } finally {
        await client.close();
        console.log('🔌 Disconnected from MongoDB');
    }
}

// Run
if (require.main === module) {
    main().catch(error => {
        console.error('Script failed:', error);
        process.exit(1);
    });
}

module.exports = { main };







