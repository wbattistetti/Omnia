#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RESPONSE_EDITOR_DIR = path.join(__dirname, '../src/components/TaskEditor/ResponseEditor');

const FORBIDDEN_PATTERNS = [
  { pattern: /\.subData\s*\|\|/, message: 'subData fallback detected' },
  { pattern: /\.subSlots\s*\|\|/, message: 'subSlots fallback detected' },
  { pattern: /\._id\s*\|\|/, message: '_id fallback detected' },
  { pattern: /\.name\s*\|\|/, message: 'name fallback detected' },
  { pattern: /subNodes.*\|\|.*subData/, message: 'subNodes || subData fallback chain' },
  { pattern: /subData.*\|\|.*subSlots/, message: 'subData || subSlots fallback chain' },
  { pattern: /convertStepsArrayToDictionary/, message: 'convertStepsArrayToDictionary usage (deprecated)' },
  { pattern: /normalizeStepsToDictionary/, message: 'normalizeStepsToDictionary usage (deprecated)' },
  { pattern: /backward compatibility|fallback to|legacy/i, message: 'Legacy fallback comment detected' },
];

function getAllFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      if (!file.startsWith('.') && file !== 'node_modules' && file !== 'dist' && file !== '__tests__') {
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
    FORBIDDEN_PATTERNS.forEach(({ pattern, message }) => {
      if (pattern.test(line)) {
        violations.push({
          line: index + 1,
          content: line.trim(),
          message,
        });
      }
    });
  });

  return violations;
}

function main() {
  console.log('🔍 Verifying No Fallbacks...\n');

  if (!fs.existsSync(RESPONSE_EDITOR_DIR)) {
    console.error(`❌ ResponseEditor directory not found: ${RESPONSE_EDITOR_DIR}`);
    process.exit(1);
  }

  const files = getAllFiles(RESPONSE_EDITOR_DIR);
  let totalViolations = 0;

  files.forEach(file => {
    const violations = checkFile(file);
    if (violations.length > 0) {
      const relativePath = path.relative(process.cwd(), file);
      console.error(`\n❌ ${relativePath}:`);
      violations.forEach(v => {
        console.error(`   Line ${v.line}: ${v.content}`);
        console.error(`   Error: ${v.message}`);
      });
      totalViolations += violations.length;
    }
  });

  if (totalViolations > 0) {
    console.error(`\n❌ Found ${totalViolations} violation(s)`);
    console.error('Migration fallbacks are not allowed. Use strict validators instead.');
    process.exit(1);
  }

  console.log('✅ No fallbacks detected!');
  process.exit(0);
}

main();
