/**
 * Script di migrazione per semplificare le costanti months
 * Unifica values.full, values.abbr, values.abbrWithDot in un unico array values
 */

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const DB_NAME = 'factory';

async function migrateConstants() {
    const client = new MongoClient(uri);

    try {
        await client.connect();
        console.log('✅ Connected to MongoDB\n');

        const db = client.db(DB_NAME);
        const constantsCollection = db.collection('Constants');

        // Trova tutte le costanti di tipo 'months'
        const monthsConstants = await constantsCollection.find({ type: 'months' }).toArray();
        
        if (monthsConstants.length === 0) {
            console.log('⚠️ No months constants found in DB');
            return;
        }

        console.log(`📋 Found ${monthsConstants.length} months constants to migrate\n`);
        console.log('═'.repeat(70));

        let migrated = 0;
        let skipped = 0;

        for (const constant of monthsConstants) {
            console.log(`\n🔍 Processing: ${constant._id} (locale: ${constant.locale})`);

            // Verifica se ha già la struttura semplificata
            if (Array.isArray(constant.values) && !constant.values.full && !constant.values.abbr) {
                console.log(`  ⏭️  Already simplified, skipping`);
                skipped++;
                continue;
            }

            // Unifica tutti i valori in un unico array
            const unifiedValues = [];

            if (constant.values.full && Array.isArray(constant.values.full)) {
                unifiedValues.push(...constant.values.full);
                console.log(`  ✅ Added ${constant.values.full.length} full names`);
            }

            if (constant.values.abbr && Array.isArray(constant.values.abbr)) {
                unifiedValues.push(...constant.values.abbr);
                console.log(`  ✅ Added ${constant.values.abbr.length} abbreviations`);
            }

            if (constant.values.abbrWithDot && Array.isArray(constant.values.abbrWithDot)) {
                unifiedValues.push(...constant.values.abbrWithDot);
                console.log(`  ✅ Added ${constant.values.abbrWithDot.length} abbreviations with dot`);
            }

            // Rimuovi duplicati
            const uniqueValues = Array.from(new Set(unifiedValues));
            console.log(`  📊 Total unique values: ${uniqueValues.length}`);

            // Aggiorna il documento in due step per evitare conflitti
            // Step 1: Rimuovi le vecchie chiavi annidate
            await constantsCollection.updateOne(
                { _id: constant._id },
                { 
                    $unset: {
                        'values.full': '',
                        'values.abbr': '',
                        'values.abbrWithDot': ''
                    }
                }
            );

            // Step 2: Imposta il nuovo array values
            const updateResult = await constantsCollection.updateOne(
                { _id: constant._id },
                { 
                    $set: { 
                        values: uniqueValues,
                        version: '2.0' // Incrementa versione per indicare migrazione
                    }
                }
            );

            if (updateResult.modifiedCount > 0) {
                console.log(`  ✅ Migrated successfully`);
                migrated++;
            } else {
                console.log(`  ⚠️  No changes made`);
            }
        }

        console.log('\n' + '═'.repeat(70));
        console.log('📊 MIGRATION SUMMARY');
        console.log('═'.repeat(70));
        console.log(`✅ Migrated: ${migrated}`);
        console.log(`⏭️  Skipped (already simplified): ${skipped}`);
        console.log(`📋 Total processed: ${monthsConstants.length}`);
        console.log('\n✅ Migration completed!');

    } catch (error) {
        console.error('❌ Error:', error);
        console.error(error.stack);
    } finally {
        await client.close();
        console.log('\n🔌 Disconnected from MongoDB');
    }
}

migrateConstants().catch(console.error);

