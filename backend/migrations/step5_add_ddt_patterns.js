/**
 * STEP 5: Add patterns to DDT templates
 * 
 * Aggiunge pattern di matching a ciascun template DDT per permettere
 * all'euristica 2 di trovare il template corretto senza inferenza AI.
 * 
 * Pattern structure:
 * {
 *   IT: ["chiedi data", "chiedi data di nascita", ...],
 *   EN: ["ask for date", "ask for date of birth", ...],
 *   PT: ["pedir data", "pedir data de nascimento", ...]
 * }
 */

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbName = 'factory';

// Pattern per ciascun tipo di template DDT
const TEMPLATE_PATTERNS = {
  // Date / Data di nascita
  'date': {
    IT: [
      '^(chiedi|richiedi|domanda|acquisisci|raccogli|invita)\\s+(data|data\\s+di\\s+nascita|data\\s+paziente|data\\s+del\\s+paziente|data\\s+nascita|giorno\\s+di\\s+nascita)',
      '^(chiedi|richiedi|domanda|acquisisci|raccogli|invita)\\s+(la\\s+)?data',
      '^(chiedi|richiedi|domanda|acquisisci|raccogli|invita)\\s+(quando|quando\\s+è\\s+nato)',
      'data\\s+(di\\s+)?nascita',
      'data\\s+paziente',
      'quando\\s+è\\s+nato'
    ],
    EN: [
      '^(ask|request|get|collect|acquire)\\s+(for\\s+)?(date|date\\s+of\\s+birth|birth\\s+date|patient\\s+date)',
      '^(ask|request|get|collect|acquire)\\s+(for\\s+)?(when|when\\s+born)',
      'date\\s+of\\s+birth',
      'birth\\s+date',
      'when\\s+born'
    ],
    PT: [
      '^(pedir|solicitar|obter|coletar|adquirir)\\s+(data|data\\s+de\\s+nascimento|data\\s+do\\s+paciente)',
      '^(pedir|solicitar|obter|coletar|adquirir)\\s+(quando|quando\\s+nasceu)',
      'data\\s+de\\s+nascimento',
      'data\\s+do\\s+paciente',
      'quando\\s+nasceu'
    ]
  },
  
  // Name / Nome
  'name': {
    IT: [
      '^(chiedi|richiedi|domanda|acquisisci|raccogli|invita)\\s+(nome|nome\\s+completo|nome\\s+e\\s+cognome|cognome)',
      '^(chiedi|richiedi|domanda|acquisisci|raccogli|invita)\\s+(il\\s+)?nome',
      'nome\\s+completo',
      'nome\\s+e\\s+cognome',
      'come\\s+ti\\s+chiami'
    ],
    EN: [
      '^(ask|request|get|collect|acquire)\\s+(for\\s+)?(name|full\\s+name|first\\s+name|last\\s+name)',
      '^(ask|request|get|collect|acquire)\\s+(for\\s+)?(your|the)\\s+name',
      'full\\s+name',
      'first\\s+and\\s+last\\s+name',
      'what\\s+is\\s+your\\s+name'
    ],
    PT: [
      '^(pedir|solicitar|obter|coletar|adquirir)\\s+(nome|nome\\s+completo|primeiro\\s+nome|sobrenome)',
      '^(pedir|solicitar|obter|coletar|adquirir)\\s+(o\\s+)?nome',
      'nome\\s+completo',
      'primeiro\\s+e\\s+último\\s+nome',
      'qual\\s+é\\s+seu\\s+nome'
    ]
  },
  
  // Phone / Telefono
  'phone': {
    IT: [
      '^(chiedi|richiedi|domanda|acquisisci|raccogli|invita)\\s+(telefono|numero\\s+di\\s+telefono|cellulare|numero\\s+di\\s+cellulare)',
      '^(chiedi|richiedi|domanda|acquisisci|raccogli|invita)\\s+(il\\s+)?(telefono|cellulare)',
      'numero\\s+di\\s+telefono',
      'numero\\s+di\\s+cellulare',
      'numero\\s+telefono'
    ],
    EN: [
      '^(ask|request|get|collect|acquire)\\s+(for\\s+)?(phone|phone\\s+number|telephone|mobile|cell\\s+phone)',
      '^(ask|request|get|collect|acquire)\\s+(for\\s+)?(your|the)\\s+phone',
      'phone\\s+number',
      'telephone\\s+number',
      'mobile\\s+number'
    ],
    PT: [
      '^(pedir|solicitar|obter|coletar|adquirir)\\s+(telefone|número\\s+de\\s+telefone|celular|número\\s+de\\s+celular)',
      '^(pedir|solicitar|obter|coletar|adquirir)\\s+(o\\s+)?(telefone|celular)',
      'número\\s+de\\s+telefone',
      'número\\s+de\\s+celular',
      'telefone\\s+celular'
    ]
  },
  
  // Email
  'email': {
    IT: [
      '^(chiedi|richiedi|domanda|acquisisci|raccogli|invita)\\s+(email|indirizzo\\s+email|mail|e-mail)',
      '^(chiedi|richiedi|domanda|acquisisci|raccogli|invita)\\s+(l\\s+)?(email|mail)',
      'indirizzo\\s+email',
      'indirizzo\\s+mail',
      'e-mail'
    ],
    EN: [
      '^(ask|request|get|collect|acquire)\\s+(for\\s+)?(email|email\\s+address|e-mail|mail)',
      '^(ask|request|get|collect|acquire)\\s+(for\\s+)?(your|the)\\s+email',
      'email\\s+address',
      'e-mail\\s+address'
    ],
    PT: [
      '^(pedir|solicitar|obter|coletar|adquirir)\\s+(email|endereço\\s+de\\s+email|e-mail|correio)',
      '^(pedir|solicitar|obter|coletar|adquirir)\\s+(o\\s+)?email',
      'endereço\\s+de\\s+email',
      'endereço\\s+e-mail'
    ]
  },
  
  // Address / Indirizzo
  'address': {
    IT: [
      '^(chiedi|richiedi|domanda|acquisisci|raccogli|invita)\\s+(indirizzo|residenza|domicilio|via|indirizzo\\s+di\\s+residenza)',
      '^(chiedi|richiedi|domanda|acquisisci|raccogli|invita)\\s+(l\\s+)?indirizzo',
      'indirizzo\\s+di\\s+residenza',
      'indirizzo\\s+domicilio',
      'dove\\s+abiti'
    ],
    EN: [
      '^(ask|request|get|collect|acquire)\\s+(for\\s+)?(address|home\\s+address|residence|street\\s+address)',
      '^(ask|request|get|collect|acquire)\\s+(for\\s+)?(your|the)\\s+address',
      'home\\s+address',
      'street\\s+address',
      'where\\s+do\\s+you\\s+live'
    ],
    PT: [
      '^(pedir|solicitar|obter|coletar|adquirir)\\s+(endereço|residência|domicílio|rua)',
      '^(pedir|solicitar|obter|coletar|adquirir)\\s+(o\\s+)?endereço',
      'endereço\\s+de\\s+residência',
      'endereço\\s+domicílio',
      'onde\\s+você\\s+mora'
    ]
  }
};

// Mapping: nome template → tipo pattern
// Supporta varianti com case-insensitive matching
function getPatternForTemplate(template) {
  const name = (template.name || '').toLowerCase();
  const label = (template.label || '').toLowerCase();
  
  // Match per nome o label
  if (name.includes('date') || label.includes('date') || label.includes('data') || name.includes('data')) {
    return TEMPLATE_PATTERNS.date;
  }
  if (name.includes('name') || label.includes('name') || label.includes('nome') || name.includes('nome')) {
    return TEMPLATE_PATTERNS.name;
  }
  if (name.includes('phone') || name.includes('telefono') || label.includes('phone') || label.includes('telefono') || label.includes('telefone')) {
    return TEMPLATE_PATTERNS.phone;
  }
  if (name.includes('email') || name.includes('mail') || label.includes('email') || label.includes('mail')) {
    return TEMPLATE_PATTERNS.email;
  }
  if (name.includes('address') || name.includes('indirizzo') || label.includes('address') || label.includes('indirizzo') || label.includes('endereço')) {
    return TEMPLATE_PATTERNS.address;
  }
  
  return null;
}

async function step5_addDDTPatterns() {
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('✅ Connesso a MongoDB');
    
    const db = client.db(dbName);
    const collection = db.collection('Task_Templates');
    
    // Query per trovare template DDT (GetData type = 3)
    const query = {
      $or: [
        { type: 3 },
        { type: { $regex: /^datarequest$/i } },
        { type: { $regex: /^data$/i } },
        { name: { $regex: /^(datarequest|getdata|data)$/i } }
      ]
    };
    
    const templates = await collection.find(query).toArray();
    console.log(`\n📋 Trovati ${templates.length} template DDT da processare\n`);
    
    let updatedCount = 0;
    let skippedCount = 0;
    let noPatternCount = 0;
    
    for (const template of templates) {
      const templateName = template.name || template.label || 'unknown';
      const templateId = template.id || template._id?.toString();
      
      // Skip se è il template GetData generico (built-in)
      if (templateName.toLowerCase() === 'getdata' || templateName.toLowerCase() === 'datarequest') {
        console.log(`  ⏭️  Skip template generico: ${templateName}`);
        skippedCount++;
        continue;
      }
      
      // Verifica se ha già pattern
      if (template.patterns && typeof template.patterns === 'object' && Object.keys(template.patterns).length > 0) {
        console.log(`  ✅ Template ${templateName} ha già pattern, skip`);
        skippedCount++;
        continue;
      }
      
      // Cerca pattern appropriato
      const patterns = getPatternForTemplate(template);
      
      if (!patterns) {
        console.log(`  ⚠️  Template ${templateName} (${templateId}) - Nessun pattern disponibile per questo tipo`);
        noPatternCount++;
        continue;
      }
      
      // Aggiorna template con pattern
      const result = await collection.updateOne(
        { _id: template._id },
        {
          $set: {
            patterns: patterns,
            updatedAt: new Date()
          }
        }
      );
      
      if (result.modifiedCount > 0) {
        console.log(`  ✅ Aggiornato: ${templateName} (${templateId})`);
        console.log(`     Pattern IT: ${patterns.IT.length} pattern`);
        console.log(`     Pattern EN: ${patterns.EN.length} pattern`);
        console.log(`     Pattern PT: ${patterns.PT.length} pattern`);
        updatedCount++;
      } else {
        console.log(`  ⚠️  Nessuna modifica per: ${templateName}`);
      }
    }
    
    console.log('\n📊 Riepilogo:');
    console.log(`   Template aggiornati: ${updatedCount}`);
    console.log(`   Template saltati (già con pattern o generici): ${skippedCount}`);
    console.log(`   Template senza pattern disponibile: ${noPatternCount}`);
    console.log(`   Template totali: ${templates.length}`);
    
    // Verifica finale
    const templatesWithPatterns = await collection.countDocuments({
      ...query,
      patterns: { $exists: true, $ne: null }
    });
    
    console.log(`\n✅ Template con pattern dopo migrazione: ${templatesWithPatterns}`);
    console.log('\n🎉 STEP 5 completato con successo');
    
  } catch (error) {
    console.error('❌ Errore durante STEP 5:', error);
    throw error;
  } finally {
    await client.close();
  }
}

// Esegui se chiamato direttamente
if (require.main === module) {
  step5_addDDTPatterns()
    .then(() => {
      console.log('\n✅ Migrazione completata');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Errore durante migrazione:', error);
      process.exit(1);
    });
}

module.exports = { step5_addDDTPatterns };


