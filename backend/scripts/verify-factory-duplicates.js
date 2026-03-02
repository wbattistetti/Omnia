/**
 * Script di verifica duplicati nel database Factory
 *
 * Verifica:
 * 1. Duplicati per ID nella collection 'tasks'
 * 2. Template con ID mancanti o null
 * 3. Template con templateId che referenziano template inesistenti
 * 4. Statistiche generali
 */

const { MongoClient } = require('mongodb');

// MongoDB connection string
const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbName = 'factory';
const collectionName = 'tasks';

async function verifyFactoryDuplicates() {
  let client;

  try {
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('🔍 VERIFICA DUPLICATI: Database Factory');
    console.log('═══════════════════════════════════════════════════════════════════════════\n');

    console.log('🔌 Connessione a MongoDB...');
    client = new MongoClient(uri);
    await client.connect();
    console.log('✅ Connesso a MongoDB\n');

    const db = client.db(dbName);
    const collection = db.collection(collectionName);

    // ✅ Carica tutti i template
    console.log(`📦 Caricamento template dalla collection '${collectionName}'...`);
    const allTemplates = await collection.find({}).toArray();
    console.log(`✅ Caricati ${allTemplates.length} template\n`);

    // ✅ Verifica 1: Duplicati per ID
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('🔍 VERIFICA 1: Duplicati per ID');
    console.log('═══════════════════════════════════════════════════════════════════════════\n');

    const idMap = new Map();
    const duplicatesById = [];
    const missingIds = [];

    allTemplates.forEach((template, index) => {
      const id = template.id || template._id?.toString();

      if (!id) {
        missingIds.push({ index, template: template.name || template.label || 'N/A' });
        return;
      }

      if (!idMap.has(id)) {
        idMap.set(id, []);
      }
      idMap.get(id).push({ index, template });
    });

    // Trova duplicati
    idMap.forEach((templates, id) => {
      if (templates.length > 1) {
        duplicatesById.push({ id, count: templates.length, templates });
      }
    });

    if (missingIds.length > 0) {
      console.error(`❌ Template con ID mancanti: ${missingIds.length}`);
      missingIds.forEach(({ index, template }) => {
        console.error(`   Index ${index}: ${template}`);
      });
      console.log('');
    } else {
      console.log('✅ Nessun template con ID mancante\n');
    }

    if (duplicatesById.length > 0) {
      console.error(`🔴 DUPLICATI TROVATI: ${duplicatesById.length} ID duplicati\n`);
      duplicatesById.forEach((dup, idx) => {
        console.error(`📌 DUPLICATO #${idx + 1}: ID = ${dup.id} (presente ${dup.count} volte)`);
        dup.templates.forEach((item, itemIdx) => {
          const t = item.template;
          console.error(`   └─ [${itemIdx + 1}] Index ${item.index}:`, {
            name: t.name || 'N/A',
            label: t.label || 'N/A',
            type: t.type || 'N/A',
            templateId: t.templateId || 'null',
            hasNlpContract: !!(t.nlpContract || t.dataContract),
            _id: t._id?.toString() || 'N/A'
          });
        });
        console.error('');
      });
    } else {
      console.log('✅ Nessun duplicato per ID trovato\n');
    }

    // ✅ Verifica 2: Template con templateId che referenziano template inesistenti
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('🔍 VERIFICA 2: TemplateId referenziati inesistenti');
    console.log('═══════════════════════════════════════════════════════════════════════════\n');

    const allIds = new Set();
    allTemplates.forEach(t => {
      const id = t.id || t._id?.toString();
      if (id) allIds.add(id);
    });

    const missingTemplateIds = [];
    allTemplates.forEach((template, index) => {
      if (template.templateId && !allIds.has(template.templateId)) {
        const templateId = template.templateId;
        const id = template.id || template._id?.toString();
        missingTemplateIds.push({
          index,
          id: id || 'N/A',
          templateId,
          name: template.name || template.label || 'N/A'
        });
      }
    });

    if (missingTemplateIds.length > 0) {
      console.error(`⚠️ Template con templateId inesistenti: ${missingTemplateIds.length}\n`);
      missingTemplateIds.forEach(({ index, id, templateId, name }) => {
        console.error(`   Index ${index}: ID=${id}, templateId=${templateId} (NON TROVATO), name=${name}`);
      });
      console.log('');
    } else {
      console.log('✅ Tutti i templateId referenziati sono presenti\n');
    }

    // ✅ Verifica 3: Duplicati per _id (MongoDB ObjectId)
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('🔍 VERIFICA 3: Duplicati per _id (MongoDB ObjectId)');
    console.log('═══════════════════════════════════════════════════════════════════════════\n');

    const _idMap = new Map();
    allTemplates.forEach((template, index) => {
      const _id = template._id?.toString();
      if (_id) {
        if (!_idMap.has(_id)) {
          _idMap.set(_id, []);
        }
        _idMap.get(_id).push({ index, template });
      }
    });

    const duplicatesBy_id = [];
    _idMap.forEach((templates, _id) => {
      if (templates.length > 1) {
        duplicatesBy_id.push({ _id, count: templates.length, templates });
      }
    });

    if (duplicatesBy_id.length > 0) {
      console.error(`🔴 DUPLICATI PER _id: ${duplicatesBy_id.length}\n`);
      duplicatesBy_id.forEach((dup, idx) => {
        console.error(`📌 DUPLICATO #${idx + 1}: _id = ${dup._id} (presente ${dup.count} volte)`);
        dup.templates.forEach((item, itemIdx) => {
          const t = item.template;
          console.error(`   └─ [${itemIdx + 1}] Index ${item.index}:`, {
            id: t.id || 'N/A',
            name: t.name || t.label || 'N/A',
            type: t.type || 'N/A'
          });
        });
        console.error('');
      });
    } else {
      console.log('✅ Nessun duplicato per _id trovato\n');
    }

    // ✅ Statistiche finali
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('📊 STATISTICHE FINALI');
    console.log('═══════════════════════════════════════════════════════════════════════════\n');
    console.log(`Totale template: ${allTemplates.length}`);
    console.log(`ID univoci: ${idMap.size}`);
    console.log(`Duplicati per ID: ${duplicatesById.length}`);
    console.log(`Template con ID mancanti: ${missingIds.length}`);
    console.log(`Template con templateId inesistenti: ${missingTemplateIds.length}`);
    console.log(`Duplicati per _id: ${duplicatesBy_id.length}\n`);

    // ✅ Riepilogo per tipo
    const typeMap = new Map();
    allTemplates.forEach(t => {
      const type = t.type || 'N/A';
      typeMap.set(type, (typeMap.get(type) || 0) + 1);
    });

    console.log('📋 Template per tipo:');
    Array.from(typeMap.entries()).sort((a, b) => b[1] - a[1]).forEach(([type, count]) => {
      console.log(`   Type ${type}: ${count}`);
    });
    console.log('');

    return {
      total: allTemplates.length,
      uniqueIds: idMap.size,
      duplicatesById: duplicatesById.length,
      missingIds: missingIds.length,
      missingTemplateIds: missingTemplateIds.length,
      duplicatesBy_id: duplicatesBy_id.length,
      details: {
        duplicatesById,
        missingIds,
        missingTemplateIds,
        duplicatesBy_id
      }
    };

  } catch (error) {
    console.error('❌ ERRORE:', error);
    throw error;
  } finally {
    if (client) {
      await client.close();
      console.log('🔌 Disconnesso da MongoDB');
    }
  }
}

// Esegui verifica
if (require.main === module) {
  verifyFactoryDuplicates()
    .then(result => {
      console.log('\n✅ Verifica completata!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Verifica fallita:', error);
      process.exit(1);
    });
}

module.exports = { verifyFactoryDuplicates };
