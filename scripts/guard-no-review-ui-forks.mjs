#!/usr/bin/env node
/**
 * Fails if the review portal (or Omnia composer) imports legacy fork UI panels.
 * Run: node scripts/guard-no-review-ui-forks.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

const FORBIDDEN_IMPORTS = [
  'ReviewTaskPanel',
  'ReviewKnowledgeBasePanel',
  'ReviewBackendPanel',
  'ReviewConversationPanel',
  'UseCaseReviewPanel',
  'ReviewPortalBackendPanel',
  'ReviewPortalConversationPanel',
  'ReviewPortalDerivedBackends',
];

const SCAN_DIRS = [
  path.join(REPO_ROOT, 'use-case-review-portal/src'),
  path.join(REPO_ROOT, 'src/components/TaskEditor/EditorHost/editors/aiAgentEditor'),
];

function walkFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, name.name);
    if (name.isDirectory()) out.push(...walkFiles(full));
    else if (/\.(tsx?|jsx?|mjs)$/.test(name.name)) out.push(full);
  }
  return out;
}

const violations = [];

for (const dir of SCAN_DIRS) {
  for (const file of walkFiles(dir)) {
    const content = fs.readFileSync(file, 'utf8');
    for (const symbol of FORBIDDEN_IMPORTS) {
      if (content.includes(symbol)) {
        violations.push(`${path.relative(REPO_ROOT, file)}: references ${symbol}`);
      }
    }
  }
}

if (violations.length > 0) {
  console.error('Review UI fork guard failed:\n');
  for (const v of violations) console.error(`  - ${v}`);
  console.error('\nUse Editor*Panel from AIAgentEditorDockPanels instead.');
  process.exit(1);
}

console.log('Review UI fork guard: OK (no legacy fork imports in portal/composer).');
