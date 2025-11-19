/**
 * Script per verificare se i contract NLP sono stati salvati nel database
 * Controlla Task_Templates per vedere se hanno il campo nlpContract
 */

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const DB_NAME = 'factory';

async function verifyContracts() {
    const client = new MongoClient(uri);

    try {
        await client.connect();
        console.log('✅ Connected to MongoDB\n');

        const db = client.db(DB_NAME);
        const templatesCollection = db.collection('Task_Templates');

        // Cerca template con contract
        console.log('🔍 Looking for templates with nlpContract...\n');

        const templatesWithContract = await templatesCollection.find({
            nlpContract: { $exists: true, $ne: null }
        }).toArray();

        if (templatesWithContract.length === 0) {
            console.log('❌ Nessun template con nlpContract trovato nel database');
            console.log('💡 Esegui: node scripts/generate-nlp-contracts.cjs\n');
        } else {
            console.log(`✅ Trovati ${templatesWithContract.length} template con nlpContract:\n`);

            for (const template of templatesWithContract) {
                console.log(`📋 Template: ${template.name || template._id}`);
                console.log(`   Label: ${template.label || 'N/A'}`);

                if (template.nlpContract) {
                    const contract = template.nlpContract;
                    console.log(`   ✅ Contract presente:`);
                    console.log(`      - Template Name: ${contract.templateName || 'N/A'}`);
                    console.log(`      - Template ID: ${contract.templateId || 'N/A'}`);
                    console.log(`      - Regex patterns: ${contract.regex?.patterns?.length || 0}`);
                    console.log(`      - Sub-data mapping: ${Object.keys(contract.subDataMapping || {}).length} entries`);
                    console.log(`      - NER enabled: ${contract.ner?.enabled || false}`);
                    console.log(`      - LLM enabled: ${contract.llm?.enabled || false}`);

                    if (contract.regex?.patterns?.length > 0) {
                        console.log(`      - First regex pattern: ${contract.regex.patterns[0].substring(0, 80)}...`);
                    }
                } else {
                    console.log(`   ❌ Contract mancante`);
                }
                console.log('');
            }
        }

        // Verifica specifica per 'date' (cerca sia minuscolo che maiuscola)
        console.log('🔍 Verifica specifica per template "date"...\n');
        const dateTemplate = await templatesCollection.findOne({
            $or: [
                { name: 'date' },
                { name: 'Date' },
                { _id: 'date' },
                { _id: 'Date' },
                { type: 'date' },
                { label: /^date$/i }  // Case-insensitive
            ]
        });

        if (!dateTemplate) {
            console.log('❌ Template "date" non trovato nel database');
        } else {
            console.log(`✅ Template "date" trovato: ${dateTemplate._id}`);
            if (dateTemplate.nlpContract) {
                console.log('✅ Contract presente per template "date"');
                const contract = dateTemplate.nlpContract;
                console.log(`   - Regex patterns: ${contract.regex?.patterns?.length || 0}`);
                console.log(`   - Sub-data mapping: ${Object.keys(contract.subDataMapping || {}).length} entries`);

                // Mostra sub-data mapping
                if (contract.subDataMapping) {
                    console.log('   - Sub-data mapping:');
                    Object.entries(contract.subDataMapping).forEach(([subId, mapping]) => {
                        console.log(`      * ${subId}: ${mapping.canonicalKey} (${mapping.label})`);
                    });
                }
            } else {
                console.log('❌ Contract MANCANTE per template "date"');
                console.log('💡 Esegui: node scripts/generate-nlp-contracts.cjs\n');
            }
        }

    } catch (error) {
        console.error('❌ Error:', error);
        console.error(error.stack);
    } finally {
        await client.close();
        console.log('\n✅ Connection closed');
    }
}

verifyContracts().catch(console.error);
