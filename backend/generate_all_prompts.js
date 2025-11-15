const { MongoClient, ObjectId } = require('mongodb');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

const MONGODB_URI = 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const DB_FACTORY = 'factory';

// Step types and their expected message counts
const STEP_TYPES = {
    start: { endpoint: '/api/startPrompt', expectedCount: 1 },
    noMatch: { endpoint: '/api/stepNoMatch', expectedCount: 3 },
    noInput: { endpoint: '/api/stepNoInput', expectedCount: 3 },
    confirmation: { endpoint: '/api/stepConfirmation', expectedCount: 2 },
    notConfirmed: { endpoint: '/api/stepNotConfirmed', expectedCount: 2 },
    success: { endpoint: '/api/stepSuccess', expectedCount: 1 }
};

// Languages to generate
const LANGUAGES = ['en', 'it', 'pt'];


/**
 * Generate messages directly based on field type and step type
 * No AI calls needed - much faster and more reliable
 */
function generateMessages(stepType, label, fieldType) {
    const labelLower = (label || '').toLowerCase();
    const typeLower = (fieldType || '').toLowerCase();

    // Infer field kind from label and type
    let kind = 'generic';
    if (labelLower.includes('phone') || labelLower.includes('tel') || typeLower === 'phone') {
        kind = 'phone';
    } else if (labelLower.includes('email') || typeLower === 'email') {
        kind = 'email';
    } else if (labelLower.includes('date') || labelLower.includes('birth') || typeLower === 'date') {
        kind = 'date';
    } else if (labelLower.includes('name') || typeLower === 'name') {
        kind = 'name';
    } else if (labelLower.includes('address') || typeLower === 'address') {
        kind = 'address';
    } else if (labelLower.includes('day') || labelLower === 'day') {
        kind = 'day';
    } else if (labelLower.includes('month') || typeLower === 'month') {
        kind = 'month';
    } else if (labelLower.includes('year') || labelLower === 'year') {
        kind = 'year';
    } else if (typeLower === 'number' || typeLower === 'numeric') {
        kind = 'number';
    } else if (labelLower.includes('time') || typeLower === 'time') {
        kind = 'time';
    } else if (labelLower.includes('hour') || labelLower === 'hour') {
        kind = 'hour';
    } else if (labelLower.includes('minute') || labelLower === 'minute') {
        kind = 'minute';
    } else if (labelLower.includes('second') || labelLower === 'second') {
        kind = 'second';
    }

    // Format label for messages
    const fieldLabel = label || 'data';

    switch (stepType) {
        case 'start':
            switch (kind) {
                case 'phone':
                    return ['What is your phone number (+country code)?'];
                case 'email':
                    return ['What is your email address?'];
                case 'date':
                    return ['What is your date of birth (DD/MM/YYYY)?'];
                case 'name':
                    return ['What is your full name?'];
                case 'address':
                    return ['What is your address?'];
                case 'day':
                    return ['What is the day?'];
                case 'month':
                    return ['What is the month?'];
                case 'year':
                    return ['What is the year (YYYY)?'];
                case 'number':
                    return [`What is your ${fieldLabel}?`];
                case 'time':
                    return ['What is the time?'];
                case 'hour':
                    return ['What is the hour?'];
                case 'minute':
                    return ['What is the minute?'];
                case 'second':
                    return ['What is the second?'];
                default:
                    return [`What is your ${fieldLabel}?`];
            }

        case 'noMatch':
            switch (kind) {
                case 'phone':
                    return [
                        "I didn't catch that. Phone number (+country code)?",
                        "That doesn't look like a phone number. Could you repeat?",
                        "I couldn't parse that. Please say the phone number again?"
                    ];
                case 'email':
                    return [
                        "I didn't catch that. Email address?",
                        "That doesn't look like an email. Could you repeat?",
                        "I couldn't parse that. Please say the email again?"
                    ];
                case 'date':
                case 'day':
                case 'month':
                case 'year':
                    return [
                        "I didn't catch that. Could you repeat?",
                        "That doesn't look valid. Please repeat?",
                        "I couldn't parse that. Say it again?"
                    ];
                default:
                    return [
                        "I didn't catch that. Could you repeat?",
                        "That doesn't look valid. Please repeat?",
                        "I couldn't parse that. Say it again?"
                    ];
            }

        case 'noInput':
            switch (kind) {
                case 'phone':
                    return [
                        "Sorry, could you repeat the phone number?",
                        "Please say the phone number again?",
                        "I didn't catch that. Phone number (+country code)?"
                    ];
                case 'email':
                    return [
                        "Sorry, could you repeat the email address?",
                        "Please say the email again?",
                        "I didn't catch that. Email address?"
                    ];
                default:
                    return [
                        "Sorry, could you repeat?",
                        "Please say it again?",
                        "I didn't catch that, repeat please?"
                    ];
            }

        case 'confirmation':
            return [
                "Is this correct: {{input}}?",
                "Please confirm: {{input}}?"
            ];

        case 'notConfirmed':
            return [
                'Not confirmed. Please provide the correct value.',
                'That was not correct. Could you repeat?'
            ];

        case 'success':
            return ['Thanks, got it.'];

        default:
            return [''];
    }
}

/**
 * Translate message from English to target language
 * Uses field type and step type to generate appropriate translations
 */
function translateMessage(message, targetLang, stepType, label, fieldType) {
    if (targetLang === 'en') return message;

    const labelLower = (label || '').toLowerCase();
    const typeLower = (fieldType || '').toLowerCase();

    // Infer field kind from label and type
    let kind = 'generic';
    if (labelLower.includes('phone') || labelLower.includes('tel') || typeLower === 'phone') {
        kind = 'phone';
    } else if (labelLower.includes('email') || typeLower === 'email') {
        kind = 'email';
    } else if (labelLower.includes('date') || labelLower.includes('birth') || typeLower === 'date') {
        kind = 'date';
    } else if (labelLower.includes('name') || typeLower === 'name') {
        kind = 'name';
    } else if (labelLower.includes('address') || typeLower === 'address') {
        kind = 'address';
    } else if (labelLower.includes('day') || labelLower === 'day') {
        kind = 'day';
    } else if (labelLower.includes('month') || typeLower === 'month') {
        kind = 'month';
    } else if (labelLower.includes('year') || labelLower === 'year') {
        kind = 'year';
    } else if (typeLower === 'number' || typeLower === 'numeric') {
        kind = 'number';
    } else if (labelLower.includes('time') || typeLower === 'time') {
        kind = 'time';
    } else if (labelLower.includes('hour') || labelLower === 'hour') {
        kind = 'hour';
    } else if (labelLower.includes('minute') || labelLower === 'minute') {
        kind = 'minute';
    } else if (labelLower.includes('second') || labelLower === 'second') {
        kind = 'second';
    }

    const fieldLabel = label || 'dato';

    // Generate translations based on step type and field kind
    if (targetLang === 'it') {
        return translateToItalian(stepType, kind, fieldLabel, message);
    } else if (targetLang === 'pt') {
        return translateToPortuguese(stepType, kind, fieldLabel, message);
    }

    return message;
}

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
 * Extract all stepPrompts from a template recursively
 */
function extractStepPrompts(template, path = '') {
    const prompts = [];

    // Root level stepPrompts
    if (template.stepPrompts && typeof template.stepPrompts === 'object') {
        for (const [stepKey, stepValue] of Object.entries(template.stepPrompts)) {
            if (Array.isArray(stepValue) && stepValue.length > 0) {
                prompts.push({
                    path: path || template.label || template.name || 'root',
                    stepKey,
                    keys: stepValue,
                    label: template.label || template.name || 'Data',
                    type: template.type || 'generic',
                    level: 'root'
                });
            }
        }
    }

    // SubData at root level (atomic templates)
    if (Array.isArray(template.subData)) {
        for (const subItem of template.subData) {
            if (subItem.stepPrompts && typeof subItem.stepPrompts === 'object') {
                const subPath = `${path || template.label || template.name}/${subItem.label || 'sub'}`;
                for (const [stepKey, stepValue] of Object.entries(subItem.stepPrompts)) {
                    if (Array.isArray(stepValue) && stepValue.length > 0) {
                        prompts.push({
                            path: subPath,
                            stepKey,
                            keys: stepValue,
                            label: subItem.label || 'Sub',
                            type: subItem.type || 'generic',
                            level: 'subData'
                        });
                    }
                }
            }
        }
    }

    // MainData level
    if (Array.isArray(template.mainData)) {
        for (const mainItem of template.mainData) {
            const mainPath = `${path || template.label || template.name}/${mainItem.label || 'main'}`;

            // MainData stepPrompts
            if (mainItem.stepPrompts && typeof mainItem.stepPrompts === 'object') {
                for (const [stepKey, stepValue] of Object.entries(mainItem.stepPrompts)) {
                    if (Array.isArray(stepValue) && stepValue.length > 0) {
                        prompts.push({
                            path: mainPath,
                            stepKey,
                            keys: stepValue,
                            label: mainItem.label || 'Main',
                            type: mainItem.type || 'generic',
                            level: 'mainData'
                        });
                    }
                }
            }

            // SubData within MainData
            if (Array.isArray(mainItem.subData)) {
                for (const subItem of mainItem.subData) {
                    if (subItem.stepPrompts && typeof subItem.stepPrompts === 'object') {
                        const subPath = `${mainPath}/${subItem.label || 'sub'}`;
                        for (const [stepKey, stepValue] of Object.entries(subItem.stepPrompts)) {
                            if (Array.isArray(stepValue) && stepValue.length > 0) {
                                prompts.push({
                                    path: subPath,
                                    stepKey,
                                    keys: stepValue,
                                    label: subItem.label || 'Sub',
                                    type: subItem.type || 'generic',
                                    level: 'mainData.subData'
                                });
                            }
                        }
                    }
                }
            }
        }
    }

    return prompts;
}

/**
 * Check if a string is a GUID
 */
function isGuid(str) {
    if (typeof str !== 'string') return false;
    const guidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return guidRegex.test(str);
}

/**
 * Generate GUID for a legacy key
 */
function generateGuidForKey(legacyKey, keyToGuidMap) {
    if (keyToGuidMap.has(legacyKey)) {
        return keyToGuidMap.get(legacyKey);
    }
    const newGuid = uuidv4();
    keyToGuidMap.set(legacyKey, newGuid);
    return newGuid;
}

/**
 * Main function
 */
async function main() {
    console.log('🚀 Starting complete prompt generation and database fix...\n');

    const client = new MongoClient(MONGODB_URI);
    const keyToGuidMap = new Map();
    const stats = {
        templatesProcessed: 0,
        promptsFound: 0,
        messagesGenerated: 0,
        translationsCreated: 0,
        templatesUpdated: 0,
        errors: []
    };

    try {
        await client.connect();
        console.log('✅ Connected to MongoDB\n');

        const factoryDb = client.db(DB_FACTORY);
        // Template di dati DDT sono in Task_Templates, non type_templates
        const templatesCollection = factoryDb.collection('Task_Templates');
        const translationsCollection = factoryDb.collection('Translations');

        // Step 1: Scan all templates and extract stepPrompts
        console.log('📋 STEP 1: Scanning templates and extracting stepPrompts...\n');
        const templates = await templatesCollection.find({}).toArray();
        console.log(`Found ${templates.length} templates\n`);

        const allPrompts = [];
        for (const template of templates) {
            const templateLabel = template.label || template.name || template._id.toString();
            console.log(`  📄 Template: ${templateLabel}`);

            const prompts = extractStepPrompts(template, templateLabel);
            allPrompts.push(...prompts.map(p => ({ ...p, templateId: template._id, templateLabel })));

            stats.templatesProcessed++;
            stats.promptsFound += prompts.length;

            if (prompts.length > 0) {
                console.log(`    ✅ Found ${prompts.length} stepPrompts groups`);
            }
        }

        console.log(`\n📊 Total: ${allPrompts.length} stepPrompts groups found\n`);

        // Step 2: Generate GUIDs for all legacy keys
        console.log('🔑 STEP 2: Generating GUIDs for legacy keys...\n');
        for (const promptGroup of allPrompts) {
            for (const key of promptGroup.keys) {
                if (!isGuid(key)) {
                    generateGuidForKey(key, keyToGuidMap);
                }
            }
        }
        console.log(`✅ Generated ${keyToGuidMap.size} GUID mappings\n`);

        // Step 3: Generate messages directly and create translations
        console.log('📝 STEP 3: Generating messages directly and creating translations...\n');
        console.log(`📊 Processing ${allPrompts.length} prompt groups\n`);

        const translationsToInsert = [];
        let processedCount = 0;

        for (const promptGroup of allPrompts) {
            const { path: fieldPath, stepKey, keys, label, type, templateLabel } = promptGroup;

            console.log(`\n  📝 Processing: ${templateLabel} → ${fieldPath} → ${stepKey}`);
            console.log(`     Label: "${label}", Type: ${type}`);
            console.log(`     Found ${keys.length} key(s) in stepPrompts`);

            // Determine which step type this is
            const stepConfig = STEP_TYPES[stepKey];
            if (!stepConfig) {
                console.log(`     ⚠️  Unknown step type: ${stepKey}, skipping`);
                continue;
            }

            // Generate messages directly (no AI needed)
            const messages = generateMessages(stepKey, label, type);

            if (messages.length === 0) {
                console.log(`     ❌ No messages generated`);
                stats.errors.push({ fieldPath, stepKey, error: 'No messages generated' });
                continue;
            }

            console.log(`     ✅ Generated ${messages.length} message(s) directly`);

            // For each key in stepPrompts, create translations
            for (let i = 0; i < keys.length; i++) {
                const legacyKey = keys[i];
                const guid = isGuid(legacyKey) ? legacyKey : generateGuidForKey(legacyKey, keyToGuidMap);

                // Get message for this escalation (use modulo to cycle through messages)
                const messageIndex = i % messages.length;
                const messageEn = messages[messageIndex] || messages[0] || '';

                // Create translations for all languages
                for (const lang of LANGUAGES) {
                    let messageText = messageEn;
                    if (lang !== 'en') {
                        // Translate message based on step type, label, and field type
                        const translated = translateMessage(messageEn, lang, stepKey, label, type);
                        // If translation returns an array (for noMatch, noInput), use the same index
                        if (Array.isArray(translated)) {
                            messageText = translated[messageIndex % translated.length] || translated[0] || messageEn;
                        } else {
                            messageText = translated;
                        }
                    }

                    translationsToInsert.push({
                        guid,
                        language: lang,
                        text: messageText,
                        type: 'Template',
                        projectId: null,
                        createdAt: new Date(),
                        updatedAt: new Date()
                    });

                    stats.translationsCreated++;
                }

                stats.messagesGenerated++;
            }

            processedCount++;
            if (processedCount % 10 === 0) {
                console.log(`\n  📊 Progress: ${processedCount}/${allPrompts.length} prompt groups processed`);
            }
        }

        // Step 4: Insert translations in bulk
        console.log(`\n💾 STEP 4: Inserting ${translationsToInsert.length} translations...\n`);

        if (translationsToInsert.length > 0) {
            // Use bulkWrite with upsert to avoid duplicates
            const bulkOps = translationsToInsert.map(trans => ({
                updateOne: {
                    filter: { guid: trans.guid, language: trans.language, type: 'Template', projectId: null },
                    update: { $set: trans },
                    upsert: true
                }
            }));

            const result = await translationsCollection.bulkWrite(bulkOps, { ordered: false });
            console.log(`✅ Inserted/Updated ${result.upsertedCount + result.modifiedCount} translations`);
        }

        // Step 5: Update templates with GUIDs
        console.log(`\n🔄 STEP 5: Updating templates with GUIDs...\n`);

        for (const template of templates) {
            let updated = false;
            const updateOps = {};

            // Update root stepPrompts
            if (template.stepPrompts && typeof template.stepPrompts === 'object') {
                const newStepPrompts = {};
                for (const [stepKey, stepValue] of Object.entries(template.stepPrompts)) {
                    if (Array.isArray(stepValue)) {
                        newStepPrompts[stepKey] = stepValue.map(key =>
                            isGuid(key) ? key : (keyToGuidMap.get(key) || key)
                        );
                        if (JSON.stringify(newStepPrompts[stepKey]) !== JSON.stringify(stepValue)) {
                            updated = true;
                        }
                    } else {
                        newStepPrompts[stepKey] = stepValue;
                    }
                }
                if (updated) {
                    updateOps['stepPrompts'] = newStepPrompts;
                }
            }

            // Update subData at root
            if (Array.isArray(template.subData)) {
                const newSubData = template.subData.map(subItem => {
                    if (subItem.stepPrompts && typeof subItem.stepPrompts === 'object') {
                        const newSubStepPrompts = {};
                        let subUpdated = false;
                        for (const [stepKey, stepValue] of Object.entries(subItem.stepPrompts)) {
                            if (Array.isArray(stepValue)) {
                                newSubStepPrompts[stepKey] = stepValue.map(key =>
                                    isGuid(key) ? key : (keyToGuidMap.get(key) || key)
                                );
                                if (JSON.stringify(newSubStepPrompts[stepKey]) !== JSON.stringify(stepValue)) {
                                    subUpdated = true;
                                }
                            } else {
                                newSubStepPrompts[stepKey] = stepValue;
                            }
                        }
                        if (subUpdated) {
                            updated = true;
                            return { ...subItem, stepPrompts: newSubStepPrompts };
                        }
                    }
                    return subItem;
                });
                if (updated) {
                    updateOps['subData'] = newSubData;
                }
            }

            // Update mainData
            if (Array.isArray(template.mainData)) {
                const newMainData = template.mainData.map(mainItem => {
                    let mainUpdated = false;
                    const newMainItem = { ...mainItem };

                    // Update mainData stepPrompts
                    if (mainItem.stepPrompts && typeof mainItem.stepPrompts === 'object') {
                        const newMainStepPrompts = {};
                        for (const [stepKey, stepValue] of Object.entries(mainItem.stepPrompts)) {
                            if (Array.isArray(stepValue)) {
                                newMainStepPrompts[stepKey] = stepValue.map(key =>
                                    isGuid(key) ? key : (keyToGuidMap.get(key) || key)
                                );
                                if (JSON.stringify(newMainStepPrompts[stepKey]) !== JSON.stringify(stepValue)) {
                                    mainUpdated = true;
                                }
                            } else {
                                newMainStepPrompts[stepKey] = stepValue;
                            }
                        }
                        if (mainUpdated) {
                            newMainItem.stepPrompts = newMainStepPrompts;
                        }
                    }

                    // Update subData within mainData
                    if (Array.isArray(mainItem.subData)) {
                        const newSubData = mainItem.subData.map(subItem => {
                            if (subItem.stepPrompts && typeof subItem.stepPrompts === 'object') {
                                const newSubStepPrompts = {};
                                let subUpdated = false;
                                for (const [stepKey, stepValue] of Object.entries(subItem.stepPrompts)) {
                                    if (Array.isArray(stepValue)) {
                                        newSubStepPrompts[stepKey] = stepValue.map(key =>
                                            isGuid(key) ? key : (keyToGuidMap.get(key) || key)
                                        );
                                        if (JSON.stringify(newSubStepPrompts[stepKey]) !== JSON.stringify(stepValue)) {
                                            subUpdated = true;
                                        }
                                    } else {
                                        newSubStepPrompts[stepKey] = stepValue;
                                    }
                                }
                                if (subUpdated) {
                                    mainUpdated = true;
                                    return { ...subItem, stepPrompts: newSubStepPrompts };
                                }
                            }
                            return subItem;
                        });
                        if (mainUpdated) {
                            newMainItem.subData = newSubData;
                        }
                    }

                    return newMainItem;
                });

                if (updated || newMainData.some((m, i) => JSON.stringify(m) !== JSON.stringify(template.mainData[i]))) {
                    updateOps['mainData'] = newMainData;
                }
            }

            // Apply updates
            if (Object.keys(updateOps).length > 0) {
                await templatesCollection.updateOne(
                    { _id: template._id },
                    { $set: updateOps }
                );
                stats.templatesUpdated++;
                console.log(`  ✅ Updated template: ${template.label || template.name || template._id}`);
            }
        }

        // Step 6: Save mapping to file for traceability
        console.log(`\n💾 STEP 6: Saving key-to-GUID mapping...\n`);
        const mappingArray = Array.from(keyToGuidMap.entries()).map(([key, guid]) => ({ key, guid }));
        const mappingFile = path.join(__dirname, 'key_to_guid_mapping.json');
        fs.writeFileSync(mappingFile, JSON.stringify(mappingArray, null, 2));
        console.log(`✅ Saved mapping to ${mappingFile}`);

        // Final stats
        console.log(`\n${'='.repeat(60)}`);
        console.log('📊 FINAL STATISTICS');
        console.log(`${'='.repeat(60)}`);
        console.log(`Templates processed: ${stats.templatesProcessed}`);
        console.log(`Prompt groups found: ${stats.promptsFound}`);
        console.log(`Messages generated: ${stats.messagesGenerated}`);
        console.log(`Translations created: ${stats.translationsCreated}`);
        console.log(`Templates updated: ${stats.templatesUpdated}`);
        console.log(`Errors: ${stats.errors.length}`);
        if (stats.errors.length > 0) {
            console.log('\n⚠️  Errors:');
            stats.errors.forEach(err => console.log(`  - ${err.fieldPath} → ${err.stepKey}: ${err.error}`));
        }
        console.log(`${'='.repeat(60)}\n`);

        console.log('✅ Complete! Database is now fully synchronized.\n');

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

