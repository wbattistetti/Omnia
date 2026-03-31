/**
 * Repository stays aligned with DialogueTaskService template cache for project template rows.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { taskRepository } from '../../TaskRepository';
import DialogueTaskService from '../../DialogueTaskService';
import { TaskType, TemplateSource } from '@types/taskTypes';
import { syncProjectTemplateRowFromDialogueTask } from '../projectTemplateRepositorySync';

describe('syncProjectTemplateRowFromDialogueTask', () => {
  beforeEach(async () => {
    for (const t of taskRepository.getAllTasks()) {
      await taskRepository.deleteTask(t.id);
    }
  });

  it('copies dataContract from dialogue template into TaskRepository project template row', () => {
    taskRepository.createTask(
      TaskType.UtteranceInterpretation,
      null,
      { source: TemplateSource.Project, label: 'Label A' },
      'tmpl-sync-1',
      undefined
    );

    DialogueTaskService.registerExternalTemplates([
      {
        id: 'tmpl-sync-1',
        label: 'Label A',
        type: TaskType.UtteranceInterpretation,
        templateId: null,
        source: 'Project',
        dataContract: {
          templateId: 'tmpl-sync-1',
          engines: [{ type: 'grammarflow', enabled: true, grammarFlow: { nodes: [] } }],
        },
      } as any,
    ]);

    const cached = DialogueTaskService.getTemplate('tmpl-sync-1');
    expect(cached).toBeTruthy();
    (cached as any).dataContract = {
      templateId: 'tmpl-sync-1',
      engines: [{ type: 'grammarflow', enabled: true, grammarFlow: { semanticSets: [{ id: 's1', name: 'S' }] } }],
    };

    syncProjectTemplateRowFromDialogueTask('tmpl-sync-1', cached!);

    const row = taskRepository.getTask('tmpl-sync-1');
    expect(row?.dataContract?.engines?.[0]?.grammarFlow?.semanticSets?.[0]?.name).toBe('S');
  });

  it('does not overwrite instance rows', () => {
    taskRepository.createTask(
      TaskType.UtteranceInterpretation,
      '00000000-0000-4000-8000-000000000099',
      { source: TemplateSource.Project },
      'inst-1',
      undefined
    );

    syncProjectTemplateRowFromDialogueTask('inst-1', {
      id: 'inst-1',
      label: 'X',
      dataContract: { engines: [] },
    } as any);

    const row = taskRepository.getTask('inst-1');
    expect(row?.dataContract).toBeUndefined();
  });
});

describe('markTemplateAsModified syncs repository', () => {
  beforeEach(async () => {
    for (const t of taskRepository.getAllTasks()) {
      await taskRepository.deleteTask(t.id);
    }
  });

  it('updates TaskRepository when template cache changes before mark', () => {
    taskRepository.createTask(
      TaskType.UtteranceInterpretation,
      null,
      { source: TemplateSource.Project },
      'tmpl-mark-1',
      undefined
    );

    DialogueTaskService.registerExternalTemplates([
      {
        id: 'tmpl-mark-1',
        label: 'T',
        type: TaskType.UtteranceInterpretation,
        templateId: null,
        source: 'Project',
        dataContract: { engines: [] },
      } as any,
    ]);

    const t = DialogueTaskService.getTemplate('tmpl-mark-1')!;
    (t as any).dataContract = { engines: [{ type: 'regex', enabled: true, patterns: ['^a$'] }] };

    DialogueTaskService.markTemplateAsModified('tmpl-mark-1');

    expect(taskRepository.getTask('tmpl-mark-1')?.dataContract?.engines?.[0]?.patterns?.[0]).toBe('^a$');
  });
});
