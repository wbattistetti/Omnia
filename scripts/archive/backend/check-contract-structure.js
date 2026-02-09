/**
 * Verifica struttura contract Date nel DB
 * Controlla se ha pattern context-aware multipli
 */

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const DB_NAME = 'factory';

async function checkContractStructure() {
    const client = new MongoClient(uri);

    try {
        await client.connect();
        console.log('✅ Connected to MongoDB\n');

        const db = client.db(DB_NAME);
        const templatesCollection = db.collection('Task_Templates');

        // Cerca template Date (come in regenerate-date-contract.js)
        const template = await templatesCollection.findOne({
            $or: [
                { name: 'date' },
                { name: 'Date' },
                { type: 'date' },
                { label: 'Date' }
            ]
        });

        if (!template) {
            console.error('❌ Template "date" not found');
            console.log('   Tried: name="date", name="Date", type="date", label="Date"');
            return;
        }

        if (!template.nlpContract) {
            console.error('❌ nlpContract not found on template');
            return;
        }

        const contract = template.nlpContract;

        console.log('📊 Contract Structure:');
        console.log(`   Template ID: ${template._id}`);
        console.log(`   Template Name: ${template.name || template.label}`);
        console.log(`   Contract Template Name: ${contract.templateName}`);
        console.log(`   Patterns count: ${contract.regex?.patterns?.length || 0}`);
        console.log(`   Pattern modes: ${JSON.stringify(contract.regex?.patternModes || [])}`);
        console.log(`   SubDataMapping entries: ${Object.keys(contract.subDataMapping || {}).length}\n`);

        console.log('📋 SubDataMapping with patternIndex:');
        Object.entries(contract.subDataMapping || {}).forEach(([id, m]) => {
            const hasPatternIndex = m.patternIndex !== undefined && m.patternIndex !== null;
            console.log(`   ${m.canonicalKey || 'N/A'}: patternIndex=${hasPatternIndex ? m.patternIndex : '❌ MISSING'}, label=${m.label || 'N/A'}`);
        });

        console.log('\n📝 Pattern previews:');
        if (contract.regex?.patterns && contract.regex.patterns.length > 0) {
            contract.regex.patterns.forEach((pattern, idx) => {
                const mode = contract.regex.patternModes?.[idx] || `pattern-${idx}`;
                const hasPlaceholder = pattern.includes('${MONTHS_PLACEHOLDER}') || pattern.includes('\\${MONTHS_PLACEHOLDER}');
                console.log(`   [${idx}] ${mode}: ${pattern.length} chars, placeholder=${hasPlaceholder ? 'YES' : 'NO'}`);
                console.log(`       Preview: ${pattern.substring(0, 100)}...`);
            });
        } else {
            console.log('   ❌ No patterns found!');
        }

        // Verifica se è context-aware
        const isContextAware = contract.regex?.patternModes && contract.regex.patternModes.length > 0;
        const hasPatternIndexes = Object.values(contract.subDataMapping || {}).some(m => m.patternIndex !== undefined);

        console.log('\n🔍 Context-Aware Check:');
        console.log(`   Has patternModes: ${isContextAware ? '✅ YES' : '❌ NO'}`);
        console.log(`   Has patternIndex in subDataMapping: ${hasPatternIndexes ? '✅ YES' : '❌ NO'}`);
        console.log(`   Is context-aware: ${isContextAware && hasPatternIndexes ? '✅ YES' : '❌ NO'}`);

        if (!isContextAware || !hasPatternIndexes) {
            console.log('\n⚠️  Contract does NOT have context-aware structure!');
            console.log('   Run: node regenerate-date-contract.js');
        }

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await client.close();
        console.log('\n✅ Connection closed');
    }
}

checkContractStructure().catch(console.error);

