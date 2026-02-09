/**
 * Script per verificare che il contract Date abbia i campi di ambiguità
 */

const { MongoClient, ObjectId } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const DB_NAME = 'factory';

async function checkAmbiguityContract() {
    const client = new MongoClient(uri);

    try {
        await client.connect();
        console.log('✅ Connected to MongoDB\n');

        const db = client.db(DB_NAME);
        const templatesCollection = db.collection('Task_Templates');

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
            return;
        }

        console.log(`✅ Found DATE template: ${dateTemplate.label || dateTemplate.name}`);
        console.log(`   Template ID: ${dateTemplate._id}\n`);

        const contract = dateTemplate.nlpContract;

        if (!contract) {
            console.error('❌ Contract non trovato nel template');
            return;
        }

        console.log('📋 Contract structure:');
        console.log(`   - Template: ${contract.templateName}`);
        console.log(`   - Template ID: ${contract.templateId}`);
        console.log(`   - Regex patterns count: ${contract.regex?.patterns?.length || 0}`);
        console.log(`   - Pattern modes: ${contract.regex?.patternModes?.join(', ') || 'N/A'}`);
        console.log(`\n🔍 Ambiguity fields:`);
        console.log(`   - ambiguityPattern: ${contract.regex?.ambiguityPattern ? '✅ PRESENTE' : '❌ MANCANTE'}`);
        if (contract.regex?.ambiguityPattern) {
            console.log(`     Pattern: ${contract.regex.ambiguityPattern}`);
        }
        console.log(`   - ambiguity: ${contract.regex?.ambiguity ? '✅ PRESENTE' : '❌ MANCANTE'}`);
        if (contract.regex?.ambiguity) {
            console.log(`     - ambiguousValues.pattern: ${contract.regex.ambiguity.ambiguousValues?.pattern || 'N/A'}`);
            console.log(`     - ambiguousValues.description: ${contract.regex.ambiguity.ambiguousValues?.description || 'N/A'}`);
            console.log(`     - ambiguousCanonicalKeys: ${contract.regex.ambiguity.ambiguousCanonicalKeys?.join(', ') || 'N/A'}`);
        }

        // Verifica completa
        const hasAmbiguityPattern = !!contract.regex?.ambiguityPattern;
        const hasAmbiguity = !!contract.regex?.ambiguity;
        const hasAmbiguousKeys = contract.regex?.ambiguity?.ambiguousCanonicalKeys?.length > 0;

        console.log(`\n📊 Summary:`);
        if (hasAmbiguityPattern && hasAmbiguity && hasAmbiguousKeys) {
            console.log('   ✅ Tutti i campi di ambiguità sono presenti!');
        } else {
            console.log('   ⚠️ Alcuni campi di ambiguità mancano:');
            if (!hasAmbiguityPattern) console.log('      - ambiguityPattern');
            if (!hasAmbiguity) console.log('      - ambiguity');
            if (!hasAmbiguousKeys) console.log('      - ambiguousCanonicalKeys');
        }

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
checkAmbiguityContract()
    .then(() => {
        console.log('\n✅ Script completed successfully');
        process.exit(0);
    })
    .catch((err) => {
        console.error('\n❌ Script failed:', err);
        process.exit(1);
    });

