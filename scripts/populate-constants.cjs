/**
 * Script per popolare la collezione Constants nel database Factory
 * Contiene costanti multilingua (mesi, titoli, separatori) senza hardcoding nel codice
 */

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const DB_NAME = 'factory';

const constants = [
  // ============================================================================
  // MONTHS - ITALIANO
  // ============================================================================
  {
    _id: 'months_IT',
    type: 'months',
    locale: 'IT',
    scope: 'global',
    version: '1.0',
    values: {
      full: ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'],
      abbr: ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'],
      abbrWithDot: ['gen.', 'feb.', 'mar.', 'apr.', 'mag.', 'giu.', 'lug.', 'ago.', 'set.', 'ott.', 'nov.', 'dic.']
    },
    mapping: {
      'gennaio': 1, 'gen': 1, 'gen.': 1,
      'febbraio': 2, 'feb': 2, 'feb.': 2,
      'marzo': 3, 'mar': 3, 'mar.': 3,
      'aprile': 4, 'apr': 4, 'apr.': 4,
      'maggio': 5, 'mag': 5, 'mag.': 5,
      'giugno': 6, 'giu': 6, 'giu.': 6,
      'luglio': 7, 'lug': 7, 'lug.': 7,
      'agosto': 8, 'ago': 8, 'ago.': 8,
      'settembre': 9, 'set': 9, 'set.': 9,
      'ottobre': 10, 'ott': 10, 'ott.': 10,
      'novembre': 11, 'nov': 11, 'nov.': 11,
      'dicembre': 12, 'dic': 12, 'dic.': 12
    }
  },

  // ============================================================================
  // MONTHS - INGLESE
  // ============================================================================
  {
    _id: 'months_EN',
    type: 'months',
    locale: 'EN',
    scope: 'global',
    version: '1.0',
    values: {
      full: ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'],
      abbr: ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'],
      abbrWithDot: ['jan.', 'feb.', 'mar.', 'apr.', 'may.', 'jun.', 'jul.', 'aug.', 'sep.', 'oct.', 'nov.', 'dec.']
    },
    mapping: {
      'january': 1, 'jan': 1, 'jan.': 1,
      'february': 2, 'feb': 2, 'feb.': 2,
      'march': 3, 'mar': 3, 'mar.': 3,
      'april': 4, 'apr': 4, 'apr.': 4,
      'may': 5,
      'june': 6, 'jun': 6, 'jun.': 6,
      'july': 7, 'jul': 7, 'jul.': 7,
      'august': 8, 'aug': 8, 'aug.': 8,
      'september': 9, 'sep': 9, 'sep.': 9,
      'october': 10, 'oct': 10, 'oct.': 10,
      'november': 11, 'nov': 11, 'nov.': 11,
      'december': 12, 'dec': 12, 'dec.': 12
    }
  },

  // ============================================================================
  // MONTHS - PORTOGHESE
  // ============================================================================
  {
    _id: 'months_PT',
    type: 'months',
    locale: 'PT',
    scope: 'global',
    version: '1.0',
    values: {
      full: ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'],
      abbr: ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'],
      abbrWithDot: ['jan.', 'fev.', 'mar.', 'abr.', 'mai.', 'jun.', 'jul.', 'ago.', 'set.', 'out.', 'nov.', 'dez.']
    },
    mapping: {
      'janeiro': 1, 'jan': 1, 'jan.': 1,
      'fevereiro': 2, 'fev': 2, 'fev.': 2,
      'março': 3, 'mar': 3, 'mar.': 3,
      'abril': 4, 'abr': 4, 'abr.': 4,
      'maio': 5, 'mai': 5, 'mai.': 5,
      'junho': 6, 'jun': 6, 'jun.': 6,
      'julho': 7, 'jul': 7, 'jul.': 7,
      'agosto': 8, 'ago': 8, 'ago.': 8,
      'setembro': 9, 'set': 9, 'set.': 9,
      'outubro': 10, 'out': 10, 'out.': 10,
      'novembro': 11, 'nov': 11, 'nov.': 11,
      'dezembro': 12, 'dez': 12, 'dez.': 12
    }
  },

  // ============================================================================
  // SEPARATORS - DATE
  // ============================================================================
  {
    _id: 'separators_date',
    type: 'separators',
    locale: 'global',
    scope: 'global',
    version: '1.0',
    values: {
      chars: ['/', '-', '.', ' '],
      pattern: '[\\s/\\-\\.]+'
    }
  },

  // ============================================================================
  // TITLES - ITALIANO
  // ============================================================================
  {
    _id: 'titles_IT',
    type: 'titles',
    locale: 'IT',
    scope: 'global',
    version: '1.0',
    values: {
      full: ['dottore', 'dottoressa', 'ingegnere', 'ragioniere', 'professore', 'professoressa'],
      abbr: ['dott', 'ing', 'rag', 'prof'],
      abbrWithDot: ['dott.', 'ing.', 'rag.', 'prof.']
    },
    mapping: {
      'dottore': 'dott',
      'dottoressa': 'dott',
      'dott': 'dott',
      'dott.': 'dott',
      'ingegnere': 'ing',
      'ing': 'ing',
      'ing.': 'ing',
      'ragioniere': 'rag',
      'rag': 'rag',
      'rag.': 'rag',
      'professore': 'prof',
      'professoressa': 'prof',
      'prof': 'prof',
      'prof.': 'prof'
    }
  },

  // ============================================================================
  // TITLES - INGLESE
  // ============================================================================
  {
    _id: 'titles_EN',
    type: 'titles',
    locale: 'EN',
    scope: 'global',
    version: '1.0',
    values: {
      full: ['mister', 'missus', 'miss', 'doctor', 'professor', 'engineer'],
      abbr: ['mr', 'mrs', 'ms', 'dr', 'prof', 'eng'],
      abbrWithDot: ['mr.', 'mrs.', 'ms.', 'dr.', 'prof.', 'eng.']
    },
    mapping: {
      'mister': 'mr',
      'mr': 'mr',
      'mr.': 'mr',
      'missus': 'mrs',
      'mrs': 'mrs',
      'mrs.': 'mrs',
      'miss': 'ms',
      'ms': 'ms',
      'ms.': 'ms',
      'doctor': 'dr',
      'dr': 'dr',
      'dr.': 'dr',
      'professor': 'prof',
      'prof': 'prof',
      'prof.': 'prof',
      'engineer': 'eng',
      'eng': 'eng',
      'eng.': 'eng'
    }
  },

  // ============================================================================
  // TITLES - PORTOGHESE
  // ============================================================================
  {
    _id: 'titles_PT',
    type: 'titles',
    locale: 'PT',
    scope: 'global',
    version: '1.0',
    values: {
      full: ['senhor', 'senhora', 'doutor', 'doutora', 'engenheiro', 'engenheira'],
      abbr: ['sr', 'sra', 'dr', 'dra', 'eng'],
      abbrWithDot: ['sr.', 'sra.', 'dr.', 'dra.', 'eng.']
    },
    mapping: {
      'senhor': 'sr',
      'sr': 'sr',
      'sr.': 'sr',
      'senhora': 'sra',
      'sra': 'sra',
      'sra.': 'sra',
      'doutor': 'dr',
      'doutora': 'dra',
      'dr': 'dr',
      'dr.': 'dr',
      'dra': 'dra',
      'dra.': 'dra',
      'engenheiro': 'eng',
      'engenheira': 'eng',
      'eng': 'eng',
      'eng.': 'eng'
    }
  }
];

async function populateConstants() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');

    const db = client.db(DB_NAME);
    const constantsCollection = db.collection('Constants');

    // Verifica se la collezione esiste, altrimenti creala
    const collections = await db.listCollections({ name: 'Constants' }).toArray();
    if (collections.length === 0) {
      await db.createCollection('Constants');
      console.log('✅ Created Constants collection\n');
    }

    let inserted = 0;
    let updated = 0;

    for (const constant of constants) {
      const existing = await constantsCollection.findOne({ _id: constant._id });

      if (existing) {
        await constantsCollection.updateOne(
          { _id: constant._id },
          { $set: constant }
        );
        updated++;
        console.log(`✅ Updated: ${constant._id}`);
      } else {
        await constantsCollection.insertOne(constant);
        inserted++;
        console.log(`✅ Inserted: ${constant._id}`);
      }
    }

    console.log(`\n${'='.repeat(70)}`);
    console.log(`📊 SUMMARY`);
    console.log(`${'='.repeat(70)}\n`);
    console.log(`✅ Constants inserted: ${inserted}`);
    console.log(`✅ Constants updated: ${updated}`);
    console.log(`\n✅ All constants populated!`);

  } catch (error) {
    console.error('❌ Error:', error);
    console.error(error.stack);
  } finally {
    await client.close();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

populateConstants().catch(console.error);

