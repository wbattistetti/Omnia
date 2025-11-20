const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbFactory = 'factory';

async function verifyDateContract() {
    const client = new MongoClient(uri);

    try {
        await client.connect();
        console.log('✅ Connected to MongoDB\n');

        const db = client.db(dbFactory);
        const collection = db.collection('Task_Templates');

        // Query diretta come suggerita dall'esperto
        const dateTemplate = await collection.findOne(
            { name: 'Date' },
            { projection: { 'nlpContract.subDataMapping': 1, name: 1, label: 1 } }
        );

        if (!dateTemplate) {
            console.error('❌ Template "Date" not found');
            return;
        }

        console.log('═══════════════════════════════════════════════════════════');
        console.log('VERIFICA CONTRATTO DATE - Query Diretta DB');
        console.log('═══════════════════════════════════════════════════════════\n');

        console.log('Template:', dateTemplate.name || dateTemplate.label);
        console.log('');

        if (!dateTemplate.nlpContract || !dateTemplate.nlpContract.subDataMapping) {
            console.error('❌ ERRORE: nlpContract.subDataMapping NON ESISTE!');
            return;
        }

        const mapping = dateTemplate.nlpContract.subDataMapping;
        const mappingEntries = Object.entries(mapping);

        console.log(`📋 SubDataMapping trovato: ${mappingEntries.length} entries\n`);

        // Verifica ogni entry
        let allCorrect = true;
        const expectedKeys = ['day', 'month', 'year'];
        const foundKeys = [];

        mappingEntries.forEach(([guid, mappingData]) => {
            const canonicalKey = mappingData.canonicalKey || 'MISSING';
            const label = mappingData.label || 'MISSING';
            const type = mappingData.type || 'MISSING';

            const isCorrect = canonicalKey !== 'generic' && canonicalKey !== 'MISSING';
            const status = isCorrect ? '✅' : '❌';

            console.log(`${status} GUID: ${guid.substring(0, 24)}...`);
            console.log(`   canonicalKey: "${canonicalKey}" ${canonicalKey === 'generic' ? '⚠️ PROBLEMA!' : ''}`);
            console.log(`   label: "${label}"`);
            console.log(`   type: "${type}"`);
            console.log('');

            if (!isCorrect) {
                allCorrect = false;
            } else {
                foundKeys.push(canonicalKey);
            }
        });

        console.log('═══════════════════════════════════════════════════════════');
        console.log('RISULTATO VERIFICA');
        console.log('═══════════════════════════════════════════════════════════\n');

        // Verifica che abbiamo tutti i canonicalKey attesi
        const hasDay = foundKeys.includes('day');
        const hasMonth = foundKeys.includes('month');
        const hasYear = foundKeys.includes('year');

        console.log(`✅ canonicalKey "day" presente: ${hasDay ? 'SÌ' : '❌ NO'}`);
        console.log(`✅ canonicalKey "month" presente: ${hasMonth ? 'SÌ' : '❌ NO'}`);
        console.log(`✅ canonicalKey "year" presente: ${hasYear ? 'SÌ' : '❌ NO'}`);
        console.log(`✅ Nessun "generic" trovato: ${allCorrect ? 'SÌ' : '❌ NO - PROBLEMA!'}`);
        console.log('');

        if (allCorrect && hasDay && hasMonth && hasYear) {
            console.log('🎉 ✅ CONTRATTO CORRETTO!');
            console.log('');
            console.log('📝 PROSSIMI STEP:');
            console.log('   1. Riavvia l\'app per ricaricare il template dal DB');
            console.log('   2. Ricrea un nodo Date nel progetto');
            console.log('   3. Testa estrazione con input: "12/11/1980"');
            console.log('   4. Verifica nei log:');
            console.log('      [NLP Regex] Pattern MATCHATO { canonicalKey: "day", value: "12" }');
            console.log('      [NLP Regex] Pattern MATCHATO { canonicalKey: "month", value: "11" }');
            console.log('      [NLP Regex] Pattern MATCHATO { canonicalKey: "year", value: "1980" }');
        } else {
            console.log('❌ CONTRATTO NON CORRETTO!');
            console.log('');
            if (!allCorrect) {
                console.log('   ⚠️ Trovati canonicalKey "generic" o mancanti');
            }
            if (!hasDay || !hasMonth || !hasYear) {
                console.log('   ⚠️ Manca almeno uno dei canonicalKey attesi (day, month, year)');
            }
            console.log('');
            console.log('   🔧 Esegui di nuovo: node fix-date-contract.js');
        }

        console.log('\n═══════════════════════════════════════════════════════════\n');

    } catch (error) {
        console.error('❌ Fatal Error:', error);
        console.error(error.stack);
    } finally {
        await client.close();
    }
}

verifyDateContract().catch(console.error);




