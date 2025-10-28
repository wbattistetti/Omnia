#!/usr/bin/env node

/**
 * 🚀 SCRIPT PER SOSTITUIRE TUTTI I CONSOLE.LOG CON IL SISTEMA DI LOGGING STRUTTURATO
 * 
 * Questo script trova e sostituisce tutti i console.log nell'applicazione
 * con il nuovo sistema di logging centralizzato.
 */

const fs = require('fs');
const path = require('path');

// 🎯 PATTERN PER TROVARE I LOG
const LOG_PATTERNS = [
  /console\.log\(/g,
  /console\.warn\(/g,
  /console\.info\(/g,
  /console\.error\(/g
];

// 🎯 COMPONENTI DA PROCESSARE
const COMPONENTS_TO_PROCESS = [
  'src/components',
  'src/hooks',
  'src/services',
  'src/flows'
];

// 🎯 FILE DA ESCLUDERE
const EXCLUDE_FILES = [
  'Logger.ts',
  'node_modules',
  '.git',
  'dist',
  'build'
];

/**
 * 🔍 TROVA TUTTI I FILE TYPESCRIPT/REACT
 */
function findTsFiles(dir) {
  const files = [];
  
  function traverse(currentDir) {
    const items = fs.readdirSync(currentDir);
    
    for (const item of items) {
      const fullPath = path.join(currentDir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        if (!EXCLUDE_FILES.some(exclude => fullPath.includes(exclude))) {
          traverse(fullPath);
        }
      } else if (item.endsWith('.ts') || item.endsWith('.tsx')) {
        files.push(fullPath);
      }
    }
  }
  
  traverse(dir);
  return files;
}

/**
 * 🔧 SOSTITUISCI I LOG IN UN FILE
 */
function replaceLogsInFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    
    // 🎯 AGGIUNGI IMPORT DEL LOGGER SE NON ESISTE
    if (!content.includes('from \'@/utils/Logger\'') && !content.includes('from "@/utils/Logger"')) {
      // Trova la riga degli import
      const importLines = content.split('\n').filter(line => line.trim().startsWith('import'));
      if (importLines.length > 0) {
        const lastImportIndex = content.lastIndexOf(importLines[importLines.length - 1]);
        const insertIndex = content.indexOf('\n', lastImportIndex) + 1;
        
        content = content.slice(0, insertIndex) + 
                 "import { debug, info, warn, error } from '@/utils/Logger';\n" + 
                 content.slice(insertIndex);
        modified = true;
      }
    }
    
    // 🎯 SOSTITUISCI I CONSOLE.LOG
    const originalContent = content;
    
    // Pattern per console.log con messaggi strutturati
    content = content.replace(
      /console\.log\(['"`]([^'"`]*?)\[([^\]]*?)\][^'"`]*?['"`],?\s*([^)]*?)\)/g,
      (match, prefix, component, data) => {
        modified = true;
        return `debug('${component.trim()}', '${prefix.trim()}', ${data || 'undefined'})`;
      }
    );
    
    // Pattern per console.error
    content = content.replace(
      /console\.error\(['"`]([^'"`]*?)\[([^\]]*?)\][^'"`]*?['"`],?\s*([^)]*?)\)/g,
      (match, prefix, component, data) => {
        modified = true;
        return `error('${component.trim()}', '${prefix.trim()}', ${data || 'undefined'})`;
      }
    );
    
    // Pattern per console.warn
    content = content.replace(
      /console\.warn\(['"`]([^'"`]*?)\[([^\]]*?)\][^'"`]*?['"`],?\s*([^)]*?)\)/g,
      (match, prefix, component, data) => {
        modified = true;
        return `warn('${component.trim()}', '${prefix.trim()}', ${data || 'undefined'})`;
      }
    );
    
    // 🎯 COMMENTA I LOG SEMPLICI (per ora)
    content = content.replace(/console\.log\(/g, '// console.log(');
    content = content.replace(/console\.warn\(/g, '// console.warn(');
    content = content.replace(/console\.info\(/g, '// console.info(');
    
    if (modified || content !== originalContent) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✅ Processed: ${filePath}`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message);
    return false;
  }
}

/**
 * 🚀 MAIN FUNCTION
 */
function main() {
  console.log('🚀 Starting log replacement process...');
  
  let totalFiles = 0;
  let processedFiles = 0;
  
  for (const componentDir of COMPONENTS_TO_PROCESS) {
    if (fs.existsSync(componentDir)) {
      const files = findTsFiles(componentDir);
      totalFiles += files.length;
      
      for (const file of files) {
        if (replaceLogsInFile(file)) {
          processedFiles++;
        }
      }
    }
  }
  
  console.log(`\n🎯 SUMMARY:`);
  console.log(`📁 Total files found: ${totalFiles}`);
  console.log(`✅ Files processed: ${processedFiles}`);
  console.log(`🔧 Log replacement completed!`);
  
  console.log(`\n🚀 NEXT STEPS:`);
  console.log(`1. Check for any import errors`);
  console.log(`2. Test the application`);
  console.log(`3. Use enableDebug() when you need to debug`);
}

// 🎯 ESEGUI LO SCRIPT
if (require.main === module) {
  main();
}

module.exports = { findTsFiles, replaceLogsInFile };
