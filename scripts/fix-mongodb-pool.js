const fs = require('fs');
const path = require('path');

const serverPath = path.join(__dirname, '..', 'backend', 'server.js');
let content = fs.readFileSync(serverPath, 'utf8');

// Pattern 1: Sostituisci "const client = new MongoClient(uri);" seguito da "await client.connect();"
// con "const client = await getMongoClient();" e rimuovi "await client.connect();"
content = content.replace(
  /const client = new MongoClient\(uri\);\s*\n\s*try\s*{\s*\n\s*await client\.connect\(\);/g,
  'const client = await getMongoClient();\n  try {'
);

// Pattern 2: Rimuovi "await client.close();" in finally blocks
content = content.replace(
  /\s*}\s*finally\s*{\s*\n\s*await client\.close\(\);\s*\n\s*}/g,
  '\n  // ✅ NON chiudere la connessione se usi il pool\n  }'
);

// Pattern 3: Rimuovi "await client.close();" standalone (non in finally)
content = content.replace(
  /\s*await client\.close\(\);\s*\n/g,
  '\n  // ✅ NON chiudere la connessione se usi il pool\n'
);

// Pattern 4: Rimuovi "await client.close();" in catch blocks (se presente)
content = content.replace(
  /catch\s*\([^)]*\)\s*{\s*\n\s*if\s*\(client\)\s*await client\.close\(\);\s*\n/g,
  'catch (e) {\n    // ✅ NON chiudere la connessione se usi il pool\n'
);

// Pattern 5: Sostituisci pattern con "await client.close().catch(...)"
content = content.replace(
  /\s*await client\.close\(\)\.catch\([^)]*\);\s*\n/g,
  '\n  // ✅ NON chiudere la connessione se usi il pool\n'
);

// Pattern 6: Gestisci casi con "const client = new MongoClient(uri);" senza try immediato
content = content.replace(
  /const client = new MongoClient\(uri\);\s*\n\s*await client\.connect\(\);/g,
  'const client = await getMongoClient();'
);

// Salva il file modificato
fs.writeFileSync(serverPath, content, 'utf8');
console.log('✅ MongoDB pool fixes applied successfully');
