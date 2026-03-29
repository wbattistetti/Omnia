import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { FontProvider } from '@context/FontContext';
import TaskRow from '../TaskRow';
import { TaskRowHeader } from '../tasks/TaskRowHeader';
import { TaskRowBody } from '../tasks/TaskRowBody';

const setup = (props?: Partial<React.ComponentProps<typeof TaskRow>>) => {
  const onEditPrimary = vi.fn();
  const onDelete = vi.fn();
  const utils = render(
    <FontProvider>
      <TaskRow
        header={
          <TaskRowHeader showMessageIcon label="Custom" color="#a21caf" />
        }
        body={
          <TaskRowBody>
            <span>Hello</span>
          </TaskRowBody>
        }
        color="#a21caf"
        onEditPrimary={onEditPrimary}
        onDelete={onDelete}
        draggable
        selected={false}
        {...props}
      />
    </FontProvider>
  );
  return { onEditPrimary, onDelete, ...utils };
};

describe('TaskRow', () => {
  test('shows actions on hover to the right of text', () => {
    setup();
    expect(screen.getByTitle('Modifica messaggio')).toBeInTheDocument();
    expect(screen.getByTitle('Elimina messaggio')).toBeInTheDocument();
  });

  test('pencil invokes onEditPrimary', () => {
    const { onEditPrimary } = setup();
    fireEvent.click(screen.getByTitle('Modifica messaggio'));
    expect(onEditPrimary).toHaveBeenCalled();
  });

  test('delete triggers onDelete', () => {
    const { onDelete } = setup();
    fireEvent.click(screen.getByTitle('Elimina messaggio'));
    expect(onDelete).toHaveBeenCalled();
  });
});
