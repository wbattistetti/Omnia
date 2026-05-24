/**
 * Sincronizza manuale designer TS → backend/data/designer-manual-for-tutor.md
 * Esegui dopo modifiche a src/domain/activeTutor/manuals/*
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const manualsDir = path.join(root, 'src', 'domain', 'activeTutor', 'manuals');

const MANUAL_FILES = [
  'manualWizardIntro.ts',
  'manualOverview.ts',
  'manualGlossary.ts',
  'manualTask.ts',
  'manualKnowledgeBase.ts',
  'manualBackend.ts',
  'manualPrompts.ts',
  'manualErrorHandling.ts',
  'manualDati.ts',
  'manualVoce.ts',
  'manualTutorQA.ts',
];

/** Estrae tutti i template literal da export const NAME = `...` */
function extractManualSections(fileContent) {
  const sections = [];
  const re = /export const \w+ = `([\s\S]*?)`;/g;
  let m;
  while ((m = re.exec(fileContent)) !== null) {
    sections.push(m[1].trim());
  }
  return sections;
}

const parts = [];
for (const file of MANUAL_FILES) {
  const content = fs.readFileSync(path.join(manualsDir, file), 'utf8');
  parts.push(...extractManualSections(content));
}

const full = parts.join('\n\n');
const outPath = path.join(root, 'backend', 'data', 'designer-manual-for-tutor.md');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, `${full}\n`, 'utf8');
console.log(`Wrote ${outPath} (${full.length} chars)`);
