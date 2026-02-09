/**
 * Script per verificare se file archiviati sono ancora necessari
 * Cerca riferimenti a file archiviati nel codice backend e frontend
 */

const fs = require('fs');
const path = require('path');

const ARCHIVE_DIRS = [
  'scripts/archive/backend',
  'scripts/archive/migrations',
];

const SEARCH_DIRS = [
  'backend',
  'src',
];

// Estrai nome file senza estensione
function getBaseName(filename) {
  return filename.replace(/\.(js|cjs|ts|tsx)$/, '');
}

// Cerca riferimenti a un file nel codice
function findReferences(baseName, searchDirs) {
  const references = [];
  const patterns = [
    new RegExp(`require\\(['"]\\./.*${baseName}['"]\\)`, 'i'),
    new RegExp(`require\\(['"]\\.\\./.*${baseName}['"]\\)`, 'i'),
    new RegExp(`require\\(['"]${baseName}['"]\\)`, 'i'),
    new RegExp(`import.*from ['"]\\./.*${baseName}['"]`, 'i'),
    new RegExp(`import.*from ['"]\\.\\./.*${baseName}['"]`, 'i'),
    new RegExp(`import.*from ['"]${baseName}['"]`, 'i'),
  ];

  function searchInFile(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      patterns.forEach((pattern, idx) => {
        if (pattern.test(content)) {
          const lines = content.split('\n');
          lines.forEach((line, lineNum) => {
            if (pattern.test(line)) {
              references.push({
                file: filePath,
                line: lineNum + 1,
                content: line.trim(),
              });
            }
          });
        }
      });
    } catch (err) {
      // Ignora errori di lettura
    }
  }

  function searchInDir(dir) {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        // Skip node_modules e altre directory non rilevanti
        if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist') {
          continue;
        }

        if (entry.isDirectory()) {
          searchInDir(fullPath);
        } else if (entry.isFile() && /\.(js|ts|tsx|jsx)$/.test(entry.name)) {
          searchInFile(fullPath);
        }
      }
    } catch (err) {
      // Ignora errori
    }
  }

  searchDirs.forEach(dir => {
    if (fs.existsSync(dir)) {
      searchInDir(dir);
    }
  });

  return references;
}

// Main
console.log('🔍 Verifica file archiviati...\n');

const neededFiles = [];
const allArchived = [];

ARCHIVE_DIRS.forEach(archiveDir => {
  if (!fs.existsSync(archiveDir)) {
    return;
  }

  const files = fs.readdirSync(archiveDir);
  files.forEach(file => {
    if (!/\.(js|cjs)$/.test(file)) {
      return;
    }

    allArchived.push({ archiveDir, file });
    const baseName = getBaseName(file);
    const references = findReferences(baseName, SEARCH_DIRS);

    if (references.length > 0) {
      neededFiles.push({
        file,
        archiveDir,
        baseName,
        references,
      });
    }
  });
});

console.log(`📊 Totale file archiviati: ${allArchived.length}\n`);

if (neededFiles.length > 0) {
  console.log('⚠️  FILE ARCHIVIATI MA ANCORA NECESSARI:\n');
  neededFiles.forEach(({ file, archiveDir, references }) => {
    console.log(`  ❌ ${file}`);
    console.log(`     Archivio: ${archiveDir}`);
    console.log(`     Riferimenti trovati: ${references.length}`);
    references.slice(0, 3).forEach(ref => {
      console.log(`       - ${ref.file}:${ref.line}`);
      console.log(`         ${ref.content.substring(0, 80)}...`);
    });
    if (references.length > 3) {
      console.log(`       ... e altri ${references.length - 3} riferimenti`);
    }
    console.log('');
  });
} else {
  console.log('✅ Nessun file archivato è ancora necessario!\n');
}

console.log('✅ Verifica completata!');
