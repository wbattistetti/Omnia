/**
 * Script per rigenerare il contract Date nel DB con la nuova regex template
 * La regex ora contiene ${MONTHS_PLACEHOLDER} che verrà compilato quando si crea l'istanza
 */

const { MongoClient, ObjectId } = require('mongodb');

// Import TypeScript generator (usando ts-node o compilato)
// Per ora usiamo require con path relativo
const path = require('path');
const fs = require('fs');

const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const DB_NAME = 'factory';

async function regenerateDateContract() {
    const client = new MongoClient(uri);

    try {
        await client.connect();
        console.log('✅ Connected to MongoDB\n');

        const db = client.db(DB_NAME);
        const templatesCollection = db.collection('Task_Templates');
        const constantsCollection = db.collection('Constants');

        // Trova template Date
        console.log('🔍 Looking for DATE template...');
        const dateTemplate = await templatesCollection.findOne({
            $or: [
                { name: 'date' },
                { type: 'date' },
                { label: /date/i }
            ]
        });

        if (!dateTemplate) {
            console.error('❌ Template DATE non trovato nel database');
            console.log('💡 Assicurati che esista un template con name="date" o type="date"');
            return;
        }

        console.log(`✅ Found DATE template: ${dateTemplate.label || dateTemplate.name}`);
        console.log(`   Template ID: ${dateTemplate._id}\n`);

        // Verifica costanti mesi
        console.log('🔍 Checking months constants...');
        const monthsConstants = await constantsCollection.find({
            type: 'months',
            scope: 'global'
        }).toArray();

        if (monthsConstants.length === 0) {
            throw new Error('❌ Constants for months not found. Run migrate-constants-simplify.js first.');
        }

        console.log(`✅ Found ${monthsConstants.length} months constants:`);
        monthsConstants.forEach(c => {
            const values = Array.isArray(c.values) ? c.values : [];
            console.log(`   - ${c.locale}: ${values.length} months`);
        });
        console.log('');

        // Genera regex template con placeholder
        // ✅ La regex contiene ${MONTHS_PLACEHOLDER} che verrà sostituito quando si crea l'istanza
        // ✅ Usa anchor ^...$ per forzare match completo (non spezza "12" in "1" + "2")
        const generateUniversalRegex = () => {
            // Giorno: 0?[1-9]|[12][0-9]|3[01] (1-31, con o senza zero iniziale) - OPCIONALE
            const dayPattern = '(?<day>0?[1-9]|[12][0-9]|3[01])';

            // Mese: testuale (PLACEHOLDER) O numerico (1-12) - verrà sostituito all'istanza
            // ✅ ORDINE: nomi mesi (placeholder) prima dei numeri
            const monthPattern = '(?<month>${MONTHS_PLACEHOLDER}|0?[1-9]|1[0-2])';

            // Anno: 2 o 4 cifre - OPCIONALE
            const yearPattern = '(?<year>\\d{2,4})';

            // Separatori: spazio, /, -, \ - ALMENO UNO obbligatorio
            const separators = '[\\s/\\\\-]+';

            // ✅ REGEX TEMPLATE con placeholder e anchor
            // ^...$  → forza match completo della stringa (non spezza "12" in "1" + "2")
            // [\s/\\-]+ → richiede almeno un separatore tra i componenti
            return `^(?:${dayPattern}${separators})?${monthPattern}(?:${separators}${yearPattern})?$`;
        };

        const templateRegex = generateUniversalRegex();

        // Verifica che il placeholder sia presente
        if (!templateRegex.includes('${MONTHS_PLACEHOLDER}')) {
            throw new Error('❌ Regex template does not contain ${MONTHS_PLACEHOLDER} placeholder!');
        }

        console.log('✅ Generated regex template with placeholder:');
        console.log(`   ${templateRegex.substring(0, 100)}...\n`);

        // Costruisci subDataMapping (preserva quello esistente se presente)
        const subDataMapping = {};
        if (dateTemplate.subDataIds && Array.isArray(dateTemplate.subDataIds)) {
            // Carica sub-templates
            for (const subId of dateTemplate.subDataIds) {
                const subTemplate = await templatesCollection.findOne({
                    _id: typeof subId === 'string' ? new ObjectId(subId) : subId
                });

                if (subTemplate) {
                    const label = subTemplate.label || subTemplate.name || '';
                    const canonicalKey = label.toLowerCase();

                    subDataMapping[subTemplate._id.toString()] = {
                        canonicalKey: canonicalKey,
                        label: label,
                        type: subTemplate.type || 'text'
                    };
                }
            }
        }

        // Costruisci contract completo
        const contract = {
            templateName: 'date',
            templateId: dateTemplate._id.toString(),
            subDataMapping: subDataMapping,

            regex: {
                // ✅ SINGOLA REGEX TEMPLATE con placeholder
                patterns: [templateRegex],
                examples: [
                    '12 aprile 1980',
                    '12 abril 1980',
                    '12 di aprile',
                    '12 de abril',
                    '02 abril',
                    '2/4/1980',
                    '2 abr 1980',
                    'aprile 1980',
                    'dic. 80',
                    '16 dicembre'
                ],
                testCases: [
                    '12 aprile 1980',
                    '12 abril 1980',
                    '2/4/1980',
                    '16-12-1980',
                    '12 aprile',
                    'aprile 1980',
                    'dic. 80'
                ]
            },

            rules: {
                extractorCode: `
// Date extractor with normalization
// Generated from DB constants - do not edit manually

function normalizeDate(components) {
  const day = components.day ? parseInt(components.day, 10) : undefined;
  const month = components.month ? parseInt(components.month, 10) : undefined;
  const year = components.year ? parseInt(components.year, 10) : undefined;

  if (year && year < 100) {
    year = year + 2000;
  }

  return { day, month, year };
}
        `.trim(),
                validators: [
                    { type: 'range', field: 'day', min: 1, max: 31 },
                    { type: 'range', field: 'month', min: 1, max: 12 },
                    { type: 'range', field: 'year', min: 1900, max: 2100 }
                ],
                testCases: [
                    '16/12/1980',
                    'dicembre 12',
                    '1980'
                ]
            },

            ner: {
                entityTypes: ['DATE', 'BIRTHDATE'],
                confidence: 0.7,
                enabled: true
            },

            llm: {
                systemPrompt: 'You are a date extraction assistant. Extract date of birth from user input. Return JSON with keys: day (1-31), month (1-12), year (4 digits). All fields are optional for partial matches.',
                userPromptTemplate: 'Extract date from: {input}',
                responseSchema: {
                    type: 'object',
                    properties: {
                        day: { type: 'number', minimum: 1, maximum: 31 },
                        month: { type: 'number', minimum: 1, maximum: 12 },
                        year: { type: 'number', minimum: 1900, maximum: 2100 }
                    }
                },
                enabled: true
            }
        };

        // Salva contract nel template
        console.log('💾 Saving contract to database...');
        await templatesCollection.updateOne(
            { _id: dateTemplate._id },
            { $set: { nlpContract: contract } }
        );

        console.log('✅ DATE contract regenerated and saved!\n');
        console.log('📋 Contract summary:');
        console.log(`   - Template: ${contract.templateName}`);
        console.log(`   - Template ID: ${contract.templateId}`);
        console.log(`   - Regex pattern: ${contract.regex.patterns[0].substring(0, 80)}...`);
        console.log(`   - Contains placeholder: ${contract.regex.patterns[0].includes('${MONTHS_PLACEHOLDER}') ? '✅ YES' : '❌ NO'}`);
        console.log(`   - SubDataMapping: ${Object.keys(contract.subDataMapping).length} entries`);
        console.log(`   - NER enabled: ${contract.ner?.enabled || false}`);
        console.log(`   - LLM enabled: ${contract.llm.enabled}`);
        console.log('\n🎯 Next steps:');
        console.log('   1. Create a Date instance in the UI');
        console.log('   2. The regex will be compiled with months for the project language');
        console.log('   3. Test date extraction in the simulator');

    } catch (error) {
        console.error('❌ Error:', error);
        console.error(error.stack);
        process.exit(1);
    } finally {
        await client.close();
        console.log('\n🔌 Disconnected from MongoDB');
    }
}

// Esegui
regenerateDateContract()
    .then(() => {
        console.log('\n✅ Script completed successfully');
        process.exit(0);
    })
    .catch((err) => {
        console.error('\n❌ Script failed:', err);
        process.exit(1);
    });

