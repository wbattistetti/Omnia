/**
 * STEP 1: Setup Collections
 *
 * Crea le nuove collezioni task_templates e ddt_library
 * NON tocca AgentActs esistenti
 *
 * Sicuro al 100% - Non modifica dati esistenti
 */

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbName = 'factory';

async function step1_setupCollections() {
    const client = new MongoClient(uri);

    try {
        await client.connect();
        console.log('✅ Connesso a MongoDB');

        const db = client.db(dbName);

        // Verifica collezioni esistenti
        const collections = await db.listCollections().toArray();
        const collectionNames = collections.map(c => c.name);

        console.log(`\n📋 Collezioni esistenti in ${dbName}:`);
        collectionNames.forEach(name => console.log(`   - ${name}`));

        // Crea task_templates se non esiste
        if (!collectionNames.includes('task_templates')) {
            await db.createCollection('task_templates');
            console.log('\n✅ Creata collezione: task_templates');

            // Crea indici
            await db.collection('task_templates').createIndex({ id: 1 }, { unique: true });
            await db.collection('task_templates').createIndex({ scope: 1 });
            await db.collection('task_templates').createIndex({ templateId: 1 });
            console.log('✅ Indici creati per task_templates');
        } else {
            console.log('\n⚠️ task_templates già esistente (skip)');
        }

        // Crea ddt_library se non esiste
        if (!collectionNames.includes('ddt_library')) {
            await db.createCollection('ddt_library');
            console.log('✅ Creata collezione: ddt_library');

            // Crea indici
            await db.collection('ddt_library').createIndex({ id: 1 }, { unique: true });
            await db.collection('ddt_library').createIndex({ scope: 1 });
            console.log('✅ Indici creati per ddt_library');
        } else {
            console.log('⚠️ ddt_library già esistente (skip)');
        }

        // Verifica AgentActs ancora presente
        const agentActsCount = await db.collection('AgentActs').countDocuments();
        console.log(`\n✅ AgentActs ancora presente: ${agentActsCount} documenti`);

        console.log('\n🎉 STEP 1 completato con successo');
        console.log('⚠️ Nessun dato modificato');

    } catch (error) {
        console.error('❌ Errore durante STEP 1:', error);
        throw error;
    } finally {
        await client.close();
        console.log('\n✅ Connessione chiusa');
    }
}

// Esegui se chiamato direttamente
if (require.main === module) {
    step1_setupCollections()
        .then(() => {
            console.log('\n✅ Script completato');
            process.exit(0);
        })
        .catch(error => {
            console.error('\n❌ Script fallito:', error);
            process.exit(1);
        });
}

module.exports = { step1_setupCollections };

