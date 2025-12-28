/**
 * Analizza i type dei template nel database Factory
 *
 * Mostra come sono codificati i type dei template senza modificare nulla.
 * Utile per capire la situazione attuale prima di normalizzare.
 *
 * Esegui con: node backend/migrations/analyze_template_types.js
 */

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbFactory = 'factory';

async function analyzeTemplateTypes() {
    const client = new MongoClient(uri);

    try {
        await client.connect();
        console.log('✅ Connesso a MongoDB\n');

        const db = client.db(dbFactory);
        const coll = db.collection('Task_Templates');

        // Trova tutti i template
        const allTemplates = await coll.find({}).toArray();
        console.log(`📋 Trovati ${allTemplates.length} template totali\n`);

        // Analizza i type
        const typeStats = {};
        const templatesByType = {};

        for (const template of allTemplates) {
            const type = template.type;
            const typeKey = typeof type === 'number' ? `number:${type}` : `string:"${type}"`;

            if (!typeStats[typeKey]) {
                typeStats[typeKey] = 0;
                templatesByType[typeKey] = [];
            }

            typeStats[typeKey]++;
            templatesByType[typeKey].push({
                id: template.id || template._id,
                name: template.name,
                label: template.label,
                type: type,
                typeString: typeof type
            });
        }

        // Mostra statistiche
        console.log('='.repeat(80));
        console.log('📊 STATISTICHE TYPE');
        console.log('='.repeat(80));
        Object.entries(typeStats)
            .sort((a, b) => b[1] - a[1])
            .forEach(([typeKey, count]) => {
                console.log(`   ${typeKey.padEnd(30)} → ${count} template`);
            });
        console.log('='.repeat(80));

        // Mostra dettagli per ogni type
        console.log('\n📝 DETTAGLI PER TYPE:\n');
        for (const [typeKey, templates] of Object.entries(templatesByType)) {
            console.log(`\n${'─'.repeat(80)}`);
            console.log(`🔍 ${typeKey} (${templates.length} template)`);
            console.log('─'.repeat(80));

            // Mostra solo i primi 10 per type
            const samples = templates.slice(0, 10);
            samples.forEach(t => {
                console.log(`   • ${t.id || 'N/A'}`);
                console.log(`     name: "${t.name || 'N/A'}"`);
                console.log(`     label: "${t.label || 'N/A'}"`);
                console.log(`     type: ${t.type} (${t.typeString})`);
                console.log('');
            });

            if (templates.length > 10) {
                console.log(`   ... e altri ${templates.length - 10} template\n`);
            }
        }

        // Analisi specifica per template DDT (potenziali GetData)
        console.log('\n' + '='.repeat(80));
        console.log('🔍 ANALISI TEMPLATE DDT (potenziali GetData)');
        console.log('='.repeat(80));

        const ddtKeywords = [
            'date', 'email', 'phone', 'address', 'name', 'codice fiscale',
            'iban', 'vat', 'postal code', 'city', 'country', 'region',
            'street', 'civic', 'data di nascita', 'data nascita', 'nascita'
        ];

        const potentialDDT = allTemplates.filter(t => {
            if (t.type === 3) return true; // Già corretto
            if (t.mainData && Array.isArray(t.mainData) && t.mainData.length > 0) return true;
            if (t.subDataIds && Array.isArray(t.subDataIds) && t.subDataIds.length > 0) return true;
            if (t.label) {
                const labelLower = t.label.toLowerCase();
                return ddtKeywords.some(keyword => labelLower.includes(keyword));
            }
            return false;
        });

        console.log(`\n📋 Template potenzialmente DDT: ${potentialDDT.length}`);
        console.log('\nDettaglio type dei template DDT:\n');

        const ddtTypeStats = {};
        for (const template of potentialDDT) {
            const type = template.type;
            const typeKey = typeof type === 'number' ? `number:${type}` : `string:"${type}"`;
            if (!ddtTypeStats[typeKey]) {
                ddtTypeStats[typeKey] = [];
            }
            ddtTypeStats[typeKey].push({
                id: template.id || template._id,
                name: template.name,
                label: template.label
            });
        }

        Object.entries(ddtTypeStats)
            .sort((a, b) => b[1].length - a[1].length)
            .forEach(([typeKey, templates]) => {
                console.log(`\n   ${typeKey}: ${templates.length} template`);
                templates.slice(0, 5).forEach(t => {
                    console.log(`      - ${t.id}: "${t.label}" (name: "${t.name || 'N/A'}")`);
                });
                if (templates.length > 5) {
                    console.log(`      ... e altri ${templates.length - 5}`);
                }
            });

        // Cerca specificamente il template "Date"
        console.log('\n' + '='.repeat(80));
        console.log('🔍 RICERCA TEMPLATE "Date"');
        console.log('='.repeat(80));

        const dateTemplates = allTemplates.filter(t => {
            const labelLower = (t.label || '').toLowerCase();
            const nameLower = (t.name || '').toLowerCase();
            return labelLower.includes('date') || nameLower.includes('date');
        });

        if (dateTemplates.length > 0) {
            console.log(`\n📋 Trovati ${dateTemplates.length} template con "date" nel nome/label:\n`);
            dateTemplates.forEach(t => {
                console.log(`   ID: ${t.id || t._id}`);
                console.log(`   name: "${t.name || 'N/A'}"`);
                console.log(`   label: "${t.label || 'N/A'}"`);
                console.log(`   type: ${t.type} (${typeof t.type})`);
                console.log(`   mainData: ${t.mainData ? `${t.mainData.length} items` : 'N/A'}`);
                console.log(`   subDataIds: ${t.subDataIds ? `${t.subDataIds.length} items` : 'N/A'}`);
                console.log('');
            });
        } else {
            console.log('\n❌ Nessun template trovato con "date" nel nome/label');
        }

        console.log('\n' + '='.repeat(80));
        console.log('✅ ANALISI COMPLETATA');
        console.log('='.repeat(80));

    } catch (error) {
        console.error('\n❌ Errore durante l\'analisi:', error);
        throw error;
    } finally {
        await client.close();
        console.log('\n✅ Connessione chiusa');
    }
}

// Esegui se chiamato direttamente
if (require.main === module) {
    analyzeTemplateTypes()
        .then(() => {
            console.log('\n✅ Script completato');
            process.exit(0);
        })
        .catch(error => {
            console.error('\n❌ Script fallito:', error);
            process.exit(1);
        });
}

module.exports = { analyzeTemplateTypes };

