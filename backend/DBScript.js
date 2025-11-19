/**
 * Test per verificare che la regex Date mappi correttamente "12 aprile 1980"
 */

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const DB_NAME = 'factory';

async function testDateRegex() {
    const client = new MongoClient(uri);

    try {
        await client.connect();
        console.log('✅ Connected to MongoDB\n');

        const db = client.db(DB_NAME);
        const templatesCollection = db.collection('Task_Templates');
        const constantsCollection = db.collection('Constants');

        // 1. Trova template Date
        console.log('🔍 Step 1: Looking for DATE template...');
        const dateTemplate = await templatesCollection.findOne({
            $or: [
                { name: 'date' },
                { name: 'Date' },
                { type: 'date' }
            ]
        });

        if (!dateTemplate) {
            console.error('❌ Template DATE non trovato');
            return;
        }

        console.log(`✅ Found: ${dateTemplate.name || dateTemplate.label}`);
        console.log(`   ID: ${dateTemplate._id}\n`);

        // 2. Carica costanti mesi per italiano
        console.log('🔍 Step 2: Loading Italian months constants...');
        const itMonths = await constantsCollection.findOne({
            type: 'months',
            scope: 'global',
            locale: 'IT'
        });

        if (!itMonths || !Array.isArray(itMonths.values)) {
            console.error('❌ Constants for IT months not found');
            return;
        }

        const months = itMonths.values;
        const unique = Array.from(new Set(months)).sort((a, b) => b.length - a.length);
        const monthsPattern = `(${unique.join('|')})`;

        console.log(`✅ Loaded ${unique.length} months (ordered by length)`);
        console.log(`   Sample: ${unique.slice(0, 5).join(', ')}...\n`);

        // 3. Estrai regex template dal contract
        console.log('🔍 Step 3: Extracting regex template from contract...');
        if (!dateTemplate.nlpContract || !dateTemplate.nlpContract.regex) {
            console.error('❌ nlpContract.regex not found');
            return;
        }

        const templateRegex = dateTemplate.nlpContract.regex.patterns[0];
        console.log(`✅ Template regex found (${templateRegex.length} chars)`);
        console.log(`   Preview: ${templateRegex.substring(0, 150)}...\n`);

        // 4. Compila regex sostituendo placeholder
        console.log('🔍 Step 4: Compiling regex (replacing placeholder)...');
        if (!templateRegex.includes('${MONTHS_PLACEHOLDER}')) {
            console.warn('⚠️  Template regex does NOT contain ${MONTHS_PLACEHOLDER}');
            console.log('   Using regex as-is (already compiled)\n');
        }

        const compiledRegex = templateRegex.replace('${MONTHS_PLACEHOLDER}', monthsPattern);
        console.log(`✅ Regex compiled (${compiledRegex.length} chars)`);
        console.log(`   Preview: ${compiledRegex.substring(0, 200)}...\n`);

        // 5. Test con "12 aprile 1980"
        console.log('═══════════════════════════════════════════════════════════');
        console.log('🧪 TEST: Matching "12 aprile 1980"');
        console.log('═══════════════════════════════════════════════════════════\n');

        const testText = '12 aprile 1980';
        const regex = new RegExp(compiledRegex, 'i');
        const match = testText.match(regex);

        if (!match) {
            console.error('❌ NO MATCH! Regex did not match "12 aprile 1980"');
            console.log('\n🔍 Debug info:');
            console.log(`   Test text: "${testText}"`);
            console.log(`   Regex length: ${compiledRegex.length}`);
            console.log(`   Regex preview: ${compiledRegex.substring(0, 300)}...`);
            return;
        }

        console.log('✅ MATCH FOUND!\n');
        console.log('📊 Match details:');
        console.log(`   Full match: "${match[0]}"`);
        console.log(`   Index: ${match.index}`);
        console.log(`   Groups count: ${match.groups ? Object.keys(match.groups).length : 0}\n`);

        // 6. Verifica gruppi named
        console.log('🔍 Step 5: Verifying named groups...');
        const groups = match.groups || {};

        const expectedGroups = ['day', 'month', 'year'];
        const results = {
            day: groups.day,
            month: groups.month,
            year: groups.year
        };

        console.log('\n📋 Extracted values:');
        console.log(`   day:   ${results.day || '❌ MISSING'} ${results.day === '12' ? '✅' : results.day ? '⚠️  (expected: 12)' : ''}`);
        console.log(`   month: ${results.month || '❌ MISSING'} ${results.month === 'aprile' ? '✅' : results.month ? '⚠️  (expected: aprile)' : ''}`);
        console.log(`   year:  ${results.year || '❌ MISSING'} ${results.year === '1980' ? '✅' : results.year ? '⚠️  (expected: 1980)' : ''}`);

        // 7. Verifica finale
        console.log('\n═══════════════════════════════════════════════════════════');
        const allCorrect = results.day === '12' && results.month === 'aprile' && results.year === '1980';

        if (allCorrect) {
            console.log('✅✅✅ SUCCESS! All values extracted correctly!');
            console.log('   day: 12 ✅');
            console.log('   month: aprile ✅');
            console.log('   year: 1980 ✅');
        } else {
            console.log('❌❌❌ FAILURE! Some values are incorrect:');
            if (results.day !== '12') console.log(`   ❌ day: got "${results.day}", expected "12"`);
            if (results.month !== 'aprile') console.log(`   ❌ month: got "${results.month}", expected "aprile"`);
            if (results.year !== '1980') console.log(`   ❌ year: got "${results.year}", expected "1980"`);
        }
        console.log('═══════════════════════════════════════════════════════════\n');

        // 8. Test aggiuntivi
        console.log('🔍 Step 6: Additional tests...\n');
        const additionalTests = [
            { text: '15 aprile 1980', expected: { day: '15', month: 'aprile', year: '1980' } },
            { text: '1 maggio 2000', expected: { day: '1', month: 'maggio', year: '2000' } },
            { text: 'aprile 1980', expected: { day: undefined, month: 'aprile', year: '1980' } },
            { text: '12/04/1980', expected: { day: '12', month: '04', year: '1980' } }
        ];

        for (const test of additionalTests) {
            const testMatch = test.text.match(new RegExp(compiledRegex, 'i'));
            if (testMatch && testMatch.groups) {
                const testResults = {
                    day: testMatch.groups.day,
                    month: testMatch.groups.month,
                    year: testMatch.groups.year
                };
                const testPass =
                    testResults.day === test.expected.day &&
                    testResults.month === test.expected.month &&
                    testResults.year === test.expected.year;

                console.log(`   "${test.text}": ${testPass ? '✅' : '❌'}`);
                if (!testPass) {
                    console.log(`      Got: day=${testResults.day}, month=${testResults.month}, year=${testResults.year}`);
                    console.log(`      Expected: day=${test.expected.day}, month=${test.expected.month}, year=${test.expected.year}`);
                }
            } else {
                console.log(`   "${test.text}": ❌ NO MATCH`);
            }
        }

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await client.close();
        console.log('\n✅ Connection closed');
    }
}

// Run test
testDateRegex().catch(console.error);