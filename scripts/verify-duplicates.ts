/**
 * Script di verifica duplicati in TaskInstances, Project Templates e Factory Templates
 *
 * Verifica:
 * 1. Duplicati tra TaskInstances e Project Templates
 * 2. Duplicati tra Project Templates e Factory Templates
 * 3. Duplicati interni a ciascuna categoria
 * 4. TaskInstances che referenziano TemplateId non presenti
 */

import { taskRepository } from '../src/services/TaskRepository';
import { DialogueTaskService } from '../src/services/DialogueTaskService';
import { taskTemplateService } from '../src/services/TaskTemplateService';

interface DuplicateReport {
  id: string;
  sources: string[];
  details: {
    source: string;
    type?: number;
    templateId?: string | null;
    hasDataContract?: boolean;
    hasSemanticContract?: boolean;
  }[];
}

async function verifyDuplicates() {
  console.log('═══════════════════════════════════════════════════════════════════════════');
  console.log('🔍 VERIFICA DUPLICATI: TaskInstances, Project Templates, Factory Templates');
  console.log('═══════════════════════════════════════════════════════════════════════════\n');

  // ✅ A. Carica tutte le TaskInstances
  const allProjectTaskInstances = taskRepository.getAllTasks().filter(task => {
    if (!task) return false;
    if (task.type === undefined || task.type === null) {
      return false;
    }
    return true;
  });

  console.log(`📦 TaskInstances del progetto: ${allProjectTaskInstances.length}`);

  // ✅ B. Carica tutti i template del progetto
  const allProjectTemplates = DialogueTaskService.getAllTemplates().map(template => {
    return {
      ...template,
      dataContract: template.dataContract || template.semanticContract || null,
      semanticContract: template.semanticContract
    };
  });

  console.log(`📦 Template del progetto: ${allProjectTemplates.length}`);

  // ✅ C. Carica tutti i template di factory
  await taskTemplateService.initialize();
  const allFactoryTemplatesRaw = await taskTemplateService.getAllTemplates();
  const allFactoryTemplates = allFactoryTemplatesRaw.map(factoryTemplate => {
    const factoryTemplateAny = factoryTemplate as any;
    return {
      id: factoryTemplate.id,
      label: factoryTemplate.label,
      type: factoryTemplate.type,
      name: factoryTemplateAny.name,
      dataContract: factoryTemplateAny.nlpContract || factoryTemplateAny.dataContract || factoryTemplateAny.semanticContract || null,
      semanticContract: factoryTemplateAny.semanticContract,
      ...factoryTemplateAny
    };
  });

  console.log(`📦 Template di factory: ${allFactoryTemplates.length}\n`);

  // ✅ D. Verifica duplicati
  const idMap = new Map<string, DuplicateReport>();

  // Aggiungi TaskInstances
  allProjectTaskInstances.forEach(task => {
    if (!idMap.has(task.id)) {
      idMap.set(task.id, {
        id: task.id,
        sources: [],
        details: []
      });
    }
    const report = idMap.get(task.id)!;
    if (!report.sources.includes('TaskInstance')) {
      report.sources.push('TaskInstance');
      report.details.push({
        source: 'TaskInstance',
        type: task.type,
        templateId: task.templateId,
        hasDataContract: !!(task as any).dataContract,
        hasSemanticContract: !!(task as any).semanticContract
      });
    }
  });

  // Aggiungi Project Templates
  allProjectTemplates.forEach(template => {
    if (!idMap.has(template.id)) {
      idMap.set(template.id, {
        id: template.id,
        sources: [],
        details: []
      });
    }
    const report = idMap.get(template.id)!;
    if (!report.sources.includes('ProjectTemplate')) {
      report.sources.push('ProjectTemplate');
      report.details.push({
        source: 'ProjectTemplate',
        type: template.type,
        templateId: template.templateId,
        hasDataContract: !!template.dataContract,
        hasSemanticContract: !!template.semanticContract
      });
    }
  });

  // Aggiungi Factory Templates
  allFactoryTemplates.forEach(template => {
    if (!idMap.has(template.id)) {
      idMap.set(template.id, {
        id: template.id,
        sources: [],
        details: []
      });
    }
    const report = idMap.get(template.id)!;
    if (!report.sources.includes('FactoryTemplate')) {
      report.sources.push('FactoryTemplate');
      report.details.push({
        source: 'FactoryTemplate',
        type: template.type,
        templateId: template.templateId,
        hasDataContract: !!template.dataContract,
        hasSemanticContract: !!template.semanticContract
      });
    }
  });

  // ✅ Trova duplicati (ID presente in più di una fonte)
  const duplicates = Array.from(idMap.values()).filter(report => report.sources.length > 1);

  console.log('═══════════════════════════════════════════════════════════════════════════');
  console.log(`🔴 DUPLICATI TROVATI: ${duplicates.length}`);
  console.log('═══════════════════════════════════════════════════════════════════════════\n');

  if (duplicates.length === 0) {
    console.log('✅ Nessun duplicato trovato! Tutti gli ID sono univoci.\n');
  } else {
    duplicates.forEach((dup, idx) => {
      console.log(`${idx + 1}. ID: ${dup.id}`);
      console.log(`   Presente in: ${dup.sources.join(', ')}`);
      dup.details.forEach(detail => {
        console.log(`   - ${detail.source}:`);
        console.log(`     Type: ${detail.type}`);
        console.log(`     TemplateId: ${detail.templateId || 'null'}`);
        console.log(`     HasDataContract: ${detail.hasDataContract}`);
        console.log(`     HasSemanticContract: ${detail.hasSemanticContract}`);
      });
      console.log('');
    });
  }

  // ✅ Verifica TaskInstances che referenziano TemplateId non presenti
  console.log('═══════════════════════════════════════════════════════════════════════════');
  console.log('🔍 VERIFICA TemplateId REFERENZIATI');
  console.log('═══════════════════════════════════════════════════════════════════════════\n');

  const allTemplateIds = new Set<string>();
  allProjectTemplates.forEach(t => allTemplateIds.add(t.id));
  allFactoryTemplates.forEach(t => allTemplateIds.add(t.id));

  const missingTemplates: Array<{ taskId: string; templateId: string }> = [];
  allProjectTaskInstances.forEach(task => {
    if (task.templateId && !allTemplateIds.has(task.templateId)) {
      missingTemplates.push({
        taskId: task.id,
        templateId: task.templateId
      });
    }
  });

  if (missingTemplates.length === 0) {
    console.log('✅ Tutti i TemplateId referenziati sono presenti!\n');
  } else {
    console.log(`⚠️ TemplateId mancanti: ${missingTemplates.length}\n`);
    missingTemplates.forEach(missing => {
      console.log(`   - TaskInstance ${missing.taskId} referenzia TemplateId ${missing.templateId} (NON TROVATO)`);
    });
    console.log('');
  }

  // ✅ Statistiche finali
  console.log('═══════════════════════════════════════════════════════════════════════════');
  console.log('📊 STATISTICHE FINALI');
  console.log('═══════════════════════════════════════════════════════════════════════════\n');
  console.log(`TaskInstances: ${allProjectTaskInstances.length}`);
  console.log(`Project Templates: ${allProjectTemplates.length}`);
  console.log(`Factory Templates: ${allFactoryTemplates.length}`);
  console.log(`ID univoci totali: ${idMap.size}`);
  console.log(`Duplicati: ${duplicates.length}`);
  console.log(`TemplateId mancanti: ${missingTemplates.length}\n`);

  return {
    duplicates,
    missingTemplates,
    stats: {
      taskInstances: allProjectTaskInstances.length,
      projectTemplates: allProjectTemplates.length,
      factoryTemplates: allFactoryTemplates.length,
      uniqueIds: idMap.size,
      duplicatesCount: duplicates.length,
      missingTemplatesCount: missingTemplates.length
    }
  };
}

// Esegui verifica
if (typeof window !== 'undefined') {
  // Browser environment
  (window as any).verifyDuplicates = verifyDuplicates;
  console.log('✅ Script caricato. Esegui: await verifyDuplicates()');
} else {
  // Node environment
  verifyDuplicates().catch(console.error);
}

export { verifyDuplicates };
