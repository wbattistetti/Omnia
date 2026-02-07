#!/usr/bin/env node

/**
 * Verify Domain Layer Purity
 *
 * This script verifies that core/domain/ does not import:
 * - React
 * - Zustand
 * - Hooks
 * - UI components
 *
 * Usage: node scripts/verify-domain-purity.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DOMAIN_DIR = path.join(__dirname, '../src/components/TaskEditor/ResponseEditor/core/domain');
const FORBIDDEN_IMPORTS = [
  'react',
  'zustand',
  'react-dom',
  'hooks',
  'components',
  'features',
];

const FORBIDDEN_PATTERNS = [
  /from ['"]react['"]/i,
  /from ['"]zustand['"]/i,
  /from ['"]react-dom['"]/i,
  /from ['"]@responseEditor\/hooks\//i,
  /from ['"]@responseEditor\/components\//i,
  /from ['"]@responseEditor\/features\//i,
  /from ['"]\.\.\/hooks\//i,
  /from ['"]\.\.\/components\//i,
  /from ['"]\.\.\/features\//i,
];

function getAllFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      // Skip test directories
      if (file !== '__tests__' && file !== '__mocks__') {
        getAllFiles(filePath, fileList);
      }
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      fileList.push(filePath);
    }
  });

  return fileList;
}

function checkFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const violations = [];

  lines.forEach((line, index) => {
    // Check for forbidden imports
    FORBIDDEN_PATTERNS.forEach(pattern => {
      if (pattern.test(line)) {
        violations.push({
          line: index + 1,
          content: line.trim(),
          reason: `Forbidden import pattern detected: ${pattern}`,
        });
      }
    });
  });

  return violations;
}

function main() {
  console.log('🔍 Verifying Domain Layer Purity...\n');

  if (!fs.existsSync(DOMAIN_DIR)) {
    console.error(`❌ Domain directory not found: ${DOMAIN_DIR}`);
    process.exit(1);
  }

  const files = getAllFiles(DOMAIN_DIR);
  let totalViolations = 0;

  files.forEach(file => {
    const violations = checkFile(file);
    if (violations.length > 0) {
      const relativePath = path.relative(process.cwd(), file);
      console.error(`\n❌ ${relativePath}:`);
      violations.forEach(v => {
        console.error(`   Line ${v.line}: ${v.content}`);
        console.error(`   Reason: ${v.reason}`);
      });
      totalViolations += violations.length;
    }
  });

  if (totalViolations > 0) {
    console.error(`\n❌ Found ${totalViolations} violation(s) in domain layer`);
    console.error('Domain layer must remain pure (no React, Zustand, hooks, or UI imports)');
    process.exit(1);
  }

  console.log('✅ Domain layer is pure!');
  process.exit(0);
}

main();
