/**
 * Normalizza i type dei template DDT nel database Factory
 *
 * Aggiorna tutti i template DDT (GetData) a type: 3 (TaskType.GetData enum)
 * invece di type: 0 (SayMessage).
 *
 * Esegui con: node backend/migrations/normalize_ddt_template_types.js
 */

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbFactory = 'factory';

/**
 * Determina se un template è un DDT (GetData) basandosi su vari criteri
 */
function isDDTTemplate(template) {
    // 1. Se type è già 3 (enum numerico) → è DDT (già corretto)
    if (template.type === 3) {
        return false; // Non aggiornare se già corretto
    }

    // 2. Se ha struttura DDT (mainData o subDataIds)
    if (template.mainData && Array.isArray(template.mainData) && template.mainData.length > 0) {
        return true;
    }
    if (template.subDataIds && Array.isArray(template.subDataIds) && template.subDataIds.length > 0) {
        return true;
    }

    // 3. Se label contiene parole chiave DDT comuni
    if (template.label) {
        const labelLower = template.label.toLowerCase();
        const ddtKeywords = [
            'date', 'email', 'phone', 'address', 'name', 'codice fiscale',
            'iban', 'vat', 'postal code', 'city', 'country', 'region',
            'street', 'civic', 'data di nascita', 'data nascita', 'nascita',
            'day', 'month', 'year', 'first name', 'last name', 'full name',
            'contact information', 'identity information', 'personal data',
            'tax code', 'account number', 'amount', 'time'
        ];
        if (ddtKeywords.some(keyword => labelLower.includes(keyword))) {
            return true;
        }
    }

    // 4. Escludi template built-in che NON sono DDT
    const builtinNonDDT = ['SayMessage', 'ClassifyProblem', 'callBackend', 'CloseSession', 'Transfer'];
    if (template.name && builtinNonDDT.some(builtin => template.name.toLowerCase().includes(builtin.toLowerCase()))) {
        return false;
    }

    // 5. Escludi template che sono chiaramente messaggi
    if (template.label) {
        const labelLower = template.label.toLowerCase();
        const messageKeywords = ['say message', 'send sms', 'send email', 'play jingle', 'hang up', 'clear', 'jump', 'log'];
        if (messageKeywords.some(keyword => labelLower.includes(keyword))) {
            return false;
        }
    }

    return false;
}

async function normalizeDDTTemplateTypes() {
    const client = new MongoClient(uri);

    try {
        await client.connect();
        console.log('✅ Connesso a MongoDB\n');

        const db = client.db(dbFactory);
        const coll = db.collection('Task_Templates');

        // Trova tutti i template
        const allTemplates = await coll.find({}).toArray();
        console.log(`📋 Trovati ${allTemplates.length} template totali\n`);

        // Identifica template DDT che non hanno type: 3
        const templatesToUpdate = [];
        for (const template of allTemplates) {
            if (isDDTTemplate(template)) {
                templatesToUpdate.push(template);
            }
        }

        console.log(`🔍 Template DDT da aggiornare: ${templatesToUpdate.length}\n`);

        if (templatesToUpdate.length === 0) {
            console.log('✅ Nessun template da aggiornare');
            return;
        }

        // Mostra preview dei template da aggiornare
        console.log('📝 Preview template da aggiornare (primi 20):');
        templatesToUpdate.slice(0, 20).forEach(t => {
            console.log(`   - ${t.id || t._id}: "${t.label}" (type: ${t.type} → 3)`);
        });
        if (templatesToUpdate.length > 20) {
            console.log(`   ... e altri ${templatesToUpdate.length - 20} template\n`);
        }

        // Chiedi conferma (in produzione, rimuovi questo e procedi direttamente)
        console.log(`\n⚠️  Procedere con l'aggiornamento di ${templatesToUpdate.length} template?`);
        console.log('   (In questo script procediamo automaticamente)\n');

        // Aggiorna tutti i template
        let updatedCount = 0;
        let skippedCount = 0;

        for (const template of templatesToUpdate) {
            const filter = { _id: template._id };
            const update = { $set: { type: 3 } };

            const result = await coll.updateOne(filter, update);
            if (result.modifiedCount > 0) {
                updatedCount++;
                if (updatedCount <= 10) {
                    console.log(`   ✅ Aggiornato: ${template.id || template._id} - "${template.label}"`);
                }
            } else {
                skippedCount++;
            }
        }

        if (updatedCount > 10) {
            console.log(`   ... e altri ${updatedCount - 10} template aggiornati`);
        }

        console.log(`\n${'='.repeat(80)}`);
        console.log('📊 RIEPILOGO');
        console.log('='.repeat(80));
        console.log(`   Template totali: ${allTemplates.length}`);
        console.log(`   Template DDT identificati: ${templatesToUpdate.length}`);
        console.log(`   Template aggiornati: ${updatedCount}`);
        console.log(`   Template saltati: ${skippedCount}`);
        console.log('='.repeat(80));
        console.log('\n🎉 MIGRAZIONE COMPLETATA');

    } catch (error) {
        console.error('\n❌ Errore durante la migrazione:', error);
        throw error;
    } finally {
        await client.close();
        console.log('\n✅ Connessione chiusa');
    }
}

// Esegui se chiamato direttamente
if (require.main === module) {
    normalizeDDTTemplateTypes()
        .then(() => {
            console.log('\n✅ Script completato');
            process.exit(0);
        })
        .catch(error => {
            console.error('\n❌ Script fallito:', error);
            process.exit(1);
        });
}

module.exports = { normalizeDDTTemplateTypes };

