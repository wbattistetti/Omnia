#!/usr/bin/env node

/**
 * Verifica che i file rimossi non siano più referenziati nel codice
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const removedFiles = [
  'src/components/SidebarOLD',
  'src/components/ChatSimulator/DDEBubbleChat.tsx',
  'src/utils/contractWizardOrchestrator.ts',
  'src/utils/semanticContractBuilder.ts',
];

const patternsToCheck = [
  { pattern: /SidebarOLD/g, name: 'SidebarOLD', exclude: [] },
  { 
    pattern: /ChatSimulator\/DDEBubbleChat/g, 
    name: 'ChatSimulator/DDEBubbleChat',
    exclude: [
      /@responseEditor\/ChatSimulator\/DDEBubbleChat/g,
      /\.\/TaskEditor\/ResponseEditor\/ChatSimulator\/DDEBubbleChat/g,
    ]
  },
  { 
    pattern: /contractWizardOrchestrator/g, 
    name: 'contractWizardOrchestrator',
    exclude: [/@utils\/wizard\/orchestrator/g]
  },
  { 
    pattern: /semanticContractBuilder/g, 
    name: 'semanticContractBuilder',
    exclude: [/@utils\/contract\/buildEntity/g]
  },
];

function getAllFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      if (!file.startsWith('.') && file !== 'node_modules' && file !== 'dist' && file !== '__tests__' && file !== 'archive') {
        getAllFiles(filePath, fileList);
      }
    } else if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js') || file.endsWith('.jsx')) {
      fileList.push(filePath);
    }
  });

  return fileList;
}

function checkPatterns() {
  console.log('🔍 Checking for references to removed files...\n');

  const srcPath = path.join(projectRoot, 'src');
  const backendPath = path.join(projectRoot, 'backend');

  const allFiles = [
    ...getAllFiles(srcPath),
    ...getAllFiles(backendPath),
  ];

  let foundIssues = false;

  patternsToCheck.forEach((patternConfig) => {
    const { pattern, name } = patternConfig;
    console.log(`Checking for: ${name}...`);
    const matches = [];

    allFiles.forEach(filePath => {
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        const fileMatches = content.match(pattern);

        if (fileMatches) {
          // Check if it's an excluded (new correct) path
          const isExcluded = patternConfig.exclude && patternConfig.exclude.some(excludePattern => 
            content.match(excludePattern)
          );
          
          if (!isExcluded) {
            const relativePath = path.relative(projectRoot, filePath);
            matches.push(relativePath);
          }
        }
      } catch (error) {
        // Skip binary files or read errors
      }
    });

    if (matches.length > 0) {
      console.log(`   ❌ Found ${matches.length} references:`);
      matches.forEach(m => console.log(`      - ${m}`));
      foundIssues = true;
    } else {
      console.log(`   ✅ No references found`);
    }
  });

  return foundIssues;
}

function checkImports() {
  console.log('\n🔍 Checking for broken imports...\n');

  try {
    // Try to build to catch import errors
    console.log('Running TypeScript check...');
    execSync('npx tsc --noEmit', { cwd: projectRoot, stdio: 'inherit' });
    console.log('✅ TypeScript check passed');
    return false;
  } catch (error) {
    console.log('❌ TypeScript check failed - there may be broken imports');
    return true;
  }
}

// Main
console.log('🚀 Starting cleanup verification...\n');

const patternIssues = checkPatterns();
const importIssues = checkImports();

console.log('\n📊 Summary:');
if (patternIssues || importIssues) {
  console.log('❌ Verification FAILED - Issues found');
  process.exit(1);
} else {
  console.log('✅ Verification PASSED - No issues found');
  process.exit(0);
}
