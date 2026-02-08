/**
 * Fix: Mappa correttamente le action IDs ai nuovi enum (6-19)
 *
 * Questo script corregge le action che non sono state mappate correttamente
 * durante la migrazione iniziale.
 *
 * Esegui con: node backend/migrations/fix_action_types.js
 */

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbFactory = 'factory';

const TaskType = {
  SendSMS: 6,
  SendEmail: 7,
  EscalateToHuman: 8,
  EscalateToGuardVR: 9,
  ReadFromBackend: 10,
  WriteToBackend: 11,
  LogData: 12,
  LogLabel: 13,
  PlayJingle: 14,
  Jump: 15,
  HangUp: 16,
  Assign: 17,
  Clear: 18,
  WaitForAgent: 19
};

// ✅ Mapping dettagliato: id/name → enum (CASE-INSENSITIVE)
const ACTION_MAPPING = {
  // SendSMS
  'sendsms': TaskType.SendSMS,
  'send-sms': TaskType.SendSMS,
  // SendEmail
  'sendemail': TaskType.SendEmail,
  'send-email': TaskType.SendEmail,
  '24c98977-2585-4215-ac46-922001a02c1a': TaskType.SendEmail, // Send Email template ID
  // EscalateToHuman
  'escalatetohuman': TaskType.EscalateToHuman,
  'escalate-to-human': TaskType.EscalateToHuman,
  'escalatetohuman-template': TaskType.EscalateToHuman,
  'tohuman': TaskType.EscalateToHuman,
  'to-human': TaskType.EscalateToHuman,
  // EscalateToGuardVR
  'escalatetoguardvr': TaskType.EscalateToGuardVR,
  'escalate-to-guard-vr': TaskType.EscalateToGuardVR,
  'toguardvr': TaskType.EscalateToGuardVR,
  'to-guard-vr': TaskType.EscalateToGuardVR,
  '49f4b669-0215-4955-811a-91ab01363687': TaskType.EscalateToGuardVR, // To Bot Guard
  // ReadFromBackend
  'readfrombackend': TaskType.ReadFromBackend,
  'read-from-backend': TaskType.ReadFromBackend,
  'readfrombackend-template': TaskType.ReadFromBackend,
  'readbackend': TaskType.ReadFromBackend,
  // WriteToBackend
  'writetobackend': TaskType.WriteToBackend,
  'write-to-backend': TaskType.WriteToBackend,
  'writetobackend-template': TaskType.WriteToBackend,
  'writebackend': TaskType.WriteToBackend,
  // LogData
  'logdata': TaskType.LogData,
  'log-data': TaskType.LogData,
  'ea7ccaa5-e499-455d-8229-533efd70c7f8': TaskType.LogData, // Log Data
  'registerdata': TaskType.LogData,
  // LogLabel
  'loglabel': TaskType.LogLabel,
  'log-label': TaskType.LogLabel,
  '25543b84-840f-4cbb-944e-e3d54d01aafe': TaskType.LogLabel, // Log Label
  // PlayJingle
  'playjingle': TaskType.PlayJingle,
  'play-jingle': TaskType.PlayJingle,
  '4e0c27cb-3286-4341-adb9-ab9d56d652db': TaskType.PlayJingle, // Play Jingle
  'jingle': TaskType.PlayJingle,
  // Jump
  'jump': TaskType.Jump,
  'cf406ebb-007a-4f31-b671-1a180594a69c': TaskType.Jump, // Jump
  'skip': TaskType.Jump,
  // HangUp
  'hangup': TaskType.HangUp,
  'hang-up': TaskType.HangUp,
  '9563e605-7c9f-4fe4-ab42-e0a65904ee70': TaskType.HangUp, // Hang Up
  'close': TaskType.HangUp,
  // Assign
  'assign': TaskType.Assign,
  'f90bfda0-2534-4c50-a433-626107faaff4': TaskType.Assign, // Assign
  // Clear
  'clear': TaskType.Clear,
  'fdcd8cc4-fe13-4fb5-885e-83443e2c8e1b': TaskType.Clear, // Clear
  // WaitForAgent
  'waitforagent': TaskType.WaitForAgent,
  'wait-for-agent': TaskType.WaitForAgent,
  'waitforagent-template': TaskType.WaitForAgent,
  'waitagent': TaskType.WaitForAgent,
  // Question (potrebbe essere SayMessage o altro)
  'aa96dab7-2b9a-4845-bda3-51571163a198': 0, // Question → SayMessage
  // Message (SayMessage)
  '654412d5-381e-43e3-b780-4d26e85ce37e': 0, // Message → SayMessage
  'a6422ac7-f897-4fd6-b0cf-a60ba99e8b30': 0, // Message → SayMessage
};

function findActionType(task) {
  // Cerca per id
  const id = (task.id || '').toLowerCase().trim();
  if (ACTION_MAPPING[id] !== undefined) {
    return ACTION_MAPPING[id];
  }

  // Cerca per name
  const name = (task.name || '').toLowerCase().trim();
  if (ACTION_MAPPING[name] !== undefined) {
    return ACTION_MAPPING[name];
  }

  // Cerca per label (parziale)
  const label = (task.label || '').toLowerCase().trim();
  if (label.includes('send sms') || label.includes('sms')) return TaskType.SendSMS;
  if (label.includes('send email') || label.includes('email')) return TaskType.SendEmail;
  if (label.includes('escalate to human') || label.includes('to human')) return TaskType.EscalateToHuman;
  if (label.includes('escalate to guard') || label.includes('to guard')) return TaskType.EscalateToGuardVR;
  if (label.includes('read from backend') || label.includes('read backend')) return TaskType.ReadFromBackend;
  if (label.includes('write to backend') || label.includes('write backend')) return TaskType.WriteToBackend;
  if (label.includes('log data')) return TaskType.LogData;
  if (label.includes('log label')) return TaskType.LogLabel;
  if (label.includes('play jingle') || label.includes('jingle')) return TaskType.PlayJingle;
  if (label.includes('jump')) return TaskType.Jump;
  if (label.includes('hang up') || label.includes('close')) return TaskType.HangUp;
  if (label.includes('assign')) return TaskType.Assign;
  if (label.includes('clear')) return TaskType.Clear;
  if (label.includes('wait for agent') || label.includes('wait agent')) return TaskType.WaitForAgent;

  return null; // Non trovato
}

async function fixActionTypes() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Connesso a MongoDB\n');

    const db = client.db(dbFactory);
    const coll = db.collection('Tasks');

    // Trova tutti i task che potrebbero essere action
    const allTasks = await coll.find({}).toArray();
    console.log(`📋 Trovati ${allTasks.length} task\n`);

    let fixedCount = 0;
    const fixes = [];

    for (const task of allTasks) {
      // Se type è già corretto (6-19), salta
      if (typeof task.type === 'number' && task.type >= 6 && task.type <= 19) {
        continue;
      }

      // Se type è 0 (SayMessage) ma potrebbe essere un'action, verifica
      if (task.type === 0 || task.type === undefined || typeof task.type === 'string') {
        const actionType = findActionType(task);
        if (actionType !== null && actionType !== task.type) {
          fixes.push({
            id: task.id,
            label: task.label,
            oldType: task.type,
            newType: actionType
          });
        }
      }
    }

    console.log(`🔍 Trovate ${fixes.length} action da correggere\n`);

    if (fixes.length === 0) {
      console.log('✅ Nessuna correzione necessaria');
      return;
    }

    // Preview
    console.log('📝 Preview correzioni:');
    fixes.slice(0, 10).forEach((fix, idx) => {
      console.log(`   ${idx + 1}. ${fix.id}: "${fix.label}" (${fix.oldType} → ${fix.newType})`);
    });
    if (fixes.length > 10) {
      console.log(`   ... e altri ${fixes.length - 10} correzioni\n`);
    }

    // Applica correzioni
    console.log('🔄 Applicazione correzioni...\n');
    for (const fix of fixes) {
      await coll.updateOne(
        { id: fix.id },
        { $set: { type: fix.newType } }
      );
      fixedCount++;
    }

    console.log(`\n${'='.repeat(80)}`);
    console.log('📊 RIEPILOGO CORREZIONI');
    console.log('='.repeat(80));
    console.log(`   Action corrette: ${fixedCount}`);
    console.log('='.repeat(80));
    console.log('\n🎉 CORREZIONI COMPLETATE');

  } catch (error) {
    console.error('\n❌ Errore durante le correzioni:', error);
    throw error;
  } finally {
    await client.close();
    console.log('\n✅ Connessione chiusa');
  }
}

// Esegui se chiamato direttamente
if (require.main === module) {
  fixActionTypes()
    .then(() => {
      console.log('\n✅ Script completato');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Script fallito:', error);
      process.exit(1);
    });
}

module.exports = { fixActionTypes };

