/**
 * Active Tutor — retrieval per tab dal manuale markdown (mirror dominio TS).
 */

const { loadDesignerManualForTutor } = require('./loadDesignerManualForTutor');

function splitManualSections(fullManual) {
  const lines = fullManual.split('\n');
  const sections = [];
  let heading = '';
  let bodyLines = [];

  const flush = () => {
    if (!heading.trim()) return;
    sections.push({ heading: heading.trim(), body: bodyLines.join('\n').trim() });
  };

  for (const line of lines) {
    if (line.startsWith('## ')) {
      flush();
      heading = line.slice(3);
      bodyLines = [];
    } else {
      bodyLines.push(line);
    }
  }
  flush();
  return sections;
}

function headingMatchesPhase(heading, phaseKey) {
  const h = heading.toUpperCase();
  switch (phaseKey) {
    case 'task':
      return h.includes('TASK') && !h.includes('ERROR');
    case 'knowledgeBase':
      return h.includes('KNOWLEDGE BASE') || h.includes('KNOWLEDGE');
    case 'backend':
      return h.includes('BACKEND') && !h.includes('KNOWLEDGE');
    case 'prompts':
      return h.includes('PROMPTS') || h.includes('PROMPT');
    case 'errorHandling':
      return h.includes('ERROR HANDLING');
    case 'dati':
      return h.includes('DATI') || h.includes('DATA');
    case 'voce':
      return h.includes('VOCE') || h.includes('VOICE');
    default:
      return false;
  }
}

function findSectionForPhase(sections, phaseKey) {
  return sections.find((s) => headingMatchesPhase(s.heading, phaseKey)) ?? null;
}

function findMatchingSubsectionInSection(question, section) {
  const q = String(question || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
  if (!q.trim()) return null;

  const subHeadings = [...section.body.matchAll(/^### (.+)$/gm)].map((m) => (m[1] || '').trim());
  for (const sub of subHeadings) {
    const norm = sub
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{M}/gu, '');
    if (norm.length >= 4 && q.includes(norm.slice(0, Math.min(norm.length, 24)))) {
      const start = section.body.indexOf(`### ${sub}`);
      if (start < 0) continue;
      const rest = section.body.slice(start);
      const next = rest.slice(4).search(/^### /m);
      const chunk = next >= 0 ? rest.slice(0, next + 4) : rest;
      return `### ${sub}\n${chunk.replace(/^### .+\n?/, '').trim()}`.trim();
    }
  }
  return null;
}

function phaseLabelToKey(label) {
  const l = String(label || '').toLowerCase();
  if (l.includes('task')) return 'task';
  if (l.includes('knowledge')) return 'knowledgeBase';
  if (l.includes('backend')) return 'backend';
  if (l.includes('prompt')) return 'prompts';
  if (l.includes('error')) return 'errorHandling';
  if (l.includes('dati')) return 'dati';
  if (l.includes('voce')) return 'voce';
  return 'task';
}

/**
 * @param {object} params
 * @param {string} params.question
 * @param {string} [params.activePhaseLabel]
 */
function retrieveManualForTutor(params) {
  const full = loadDesignerManualForTutor();
  const sections = splitManualSections(full);
  const activeKey = phaseLabelToKey(params.activePhaseLabel);

  const section = findSectionForPhase(sections, activeKey);
  const chunks = [];
  if (section) {
    chunks.push(`## ${section.heading}\n\n${section.body}`);
    const inner = findMatchingSubsectionInSection(params.question || '', section);
    if (inner) {
      chunks.push(`### Sezione rilevante\n\n${inner}`);
    }
  }

  if (chunks.length === 0) return 'NESSUN CONTENUTO MANUALE PER QUESTA FASE.';
  return chunks.join('\n\n---\n\n');
}

module.exports = { retrieveManualForTutor, phaseLabelToKey };
