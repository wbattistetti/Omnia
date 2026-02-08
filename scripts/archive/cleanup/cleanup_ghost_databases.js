/**
 * Cleanup Ghost Databases
 *
 * Elimina tutti i database progetto tranne l'ultimo creato
 * I database "ghost" sono quelli di progetti cancellati ma DB non eliminati
 */

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbFactoryName = 'factory';

async function cleanupGhostDatabases() {
    const client = new MongoClient(uri);

    try {
        await client.connect();
        console.log('✅ Connesso a MongoDB\n');

        const adminDb = client.db().admin();
        const dbList = await adminDb.listDatabases();

        // Filtra solo database progetto (quelli che iniziano con t_ o project_)
        // Escludi anche sample_mflix e altri database di esempio
        const projectDatabases = dbList.databases
            .filter(db => {
                const name = db.name;
                return (name.startsWith('t_') || name.startsWith('project_')) &&
                    name !== 'admin' &&
                    name !== 'local' &&
                    name !== 'config' &&
                    name !== dbFactoryName &&
                    name !== 'Projects' &&
                    name !== 'sample_mflix' &&
                    !name.startsWith('system');
            })
            .map(db => ({
                name: db.name,
                sizeOnDisk: db.sizeOnDisk
            }));

        // Debug: mostra tutti i database trovati
        console.log(`\n🔍 Debug: Tutti i database trovati (${dbList.databases.length}):`);
        dbList.databases.slice(0, 20).forEach(db => {
            const isProject = (db.name.startsWith('t_') || db.name.startsWith('project_')) &&
                !['admin', 'local', 'config', dbFactoryName, 'Projects', 'sample_mflix'].includes(db.name) &&
                !db.name.startsWith('system');
            console.log(`   ${isProject ? '✅' : '  '} ${db.name} (${(db.sizeOnDisk / 1024 / 1024).toFixed(2)} MB)`);
        });
        if (dbList.databases.length > 20) {
            console.log(`   ... e altri ${dbList.databases.length - 20}`);
        }

        console.log(`📋 Trovati ${projectDatabases.length} database progetto\n`);

        if (projectDatabases.length === 0) {
            console.log('✅ Nessun database progetto da pulire');
            return;
        }

        // Trova l'ultimo creato (più grande o più recente)
        // Usiamo sizeOnDisk come proxy per "più recente/attivo"
        projectDatabases.sort((a, b) => b.sizeOnDisk - a.sizeOnDisk);
        const lastDatabase = projectDatabases[0];

        console.log(`📌 Database da PRESERVARE (ultimo/più grande): ${lastDatabase.name}`);
        console.log(`   Size: ${(lastDatabase.sizeOnDisk / 1024 / 1024).toFixed(2)} MB\n`);

        // Lista database da eliminare
        const databasesToDelete = projectDatabases.slice(1);

        console.log(`🗑️ Database da eliminare: ${databasesToDelete.length}\n`);

        if (databasesToDelete.length === 0) {
            console.log('✅ Nessun database da eliminare');
            return;
        }

        // Mostra lista (primi 10)
        console.log('Lista database da eliminare:');
        databasesToDelete.slice(0, 10).forEach(db => {
            console.log(`   - ${db.name} (${(db.sizeOnDisk / 1024 / 1024).toFixed(2)} MB)`);
        });
        if (databasesToDelete.length > 10) {
            console.log(`   ... e altri ${databasesToDelete.length - 10}`);
        }

        console.log('\n⚠️ ATTENZIONE: Questa operazione è IRREVERSIBILE!');
        console.log('⚠️ Verifica la lista sopra prima di procedere\n');

        // Per sicurezza, chiediamo conferma manuale
        // In produzione, rimuovi questo e usa un flag --force
        console.log('Per eseguire la cancellazione, modifica lo script e imposta EXECUTE_DELETE = true');
        console.log('Oppure usa: node cleanup_ghost_databases.js --force\n');

        const EXECUTE_DELETE = process.argv.includes('--force');

        if (!EXECUTE_DELETE) {
            console.log('⏸️ Modalità DRY-RUN: nessun database eliminato');
            console.log('✅ Esegui con --force per eliminare realmente');
            return;
        }

        // Elimina database
        console.log('\n🗑️ Eliminazione in corso...\n');
        let deletedCount = 0;
        let errorCount = 0;

        for (const dbInfo of databasesToDelete) {
            try {
                const db = client.db(dbInfo.name);
                await db.dropDatabase();
                deletedCount++;
                console.log(`   ✅ Eliminato: ${dbInfo.name}`);
            } catch (error) {
                errorCount++;
                console.error(`   ❌ Errore eliminando ${dbInfo.name}:`, error.message);
            }
        }

        console.log('\n' + '='.repeat(70));
        console.log('📊 RIEPILOGO');
        console.log('='.repeat(70));
        console.log(`Database eliminati: ${deletedCount}`);
        console.log(`Errori:             ${errorCount}`);
        console.log(`Database preservato: ${lastDatabase.name}`);
        console.log('='.repeat(70));

        console.log('\n🎉 Cleanup completato');

    } catch (error) {
        console.error('❌ Errore durante cleanup:', error);
        throw error;
    } finally {
        await client.close();
        console.log('\n✅ Connessione chiusa');
    }
}

// Esegui se chiamato direttamente
if (require.main === module) {
    cleanupGhostDatabases()
        .then(() => {
            process.exit(0);
        })
        .catch(error => {
            console.error('\n❌ Script fallito:', error);
            process.exit(1);
        });
}

module.exports = { cleanupGhostDatabases };

