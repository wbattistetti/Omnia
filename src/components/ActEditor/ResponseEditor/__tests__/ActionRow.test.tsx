import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ActionRow from '../../ResponseEditor/ActionRow';

const setup = (props?: Partial<React.ComponentProps<typeof ActionRow>>) => {
  const onEdit = vi.fn();
  const onDelete = vi.fn();
  const utils = render(
    <ActionRow
      icon={<span data-testid="ico" />}
      label="Custom"
      text="Hello"
      color="#a21caf"
      onEdit={onEdit}
      onDelete={onDelete}
      draggable
      selected={false}
      actionId="customAction"
      hovered={true}
      {...props}
    />
  );
  return { onEdit, onDelete, ...utils };
};

describe('ActionRow', () => {
  test('shows actions on hover to the right of text', () => {
    setup();
    expect(screen.getByTestId('ico')).toBeInTheDocument();
    // Pencil and Trash are buttons with titles
    expect(screen.getByTitle('Modifica messaggio')).toBeInTheDocument();
    expect(screen.getByTitle('Elimina messaggio')).toBeInTheDocument();
  });

  test('enters edit mode via pencil and confirms', () => {
    const { onEdit } = setup();
    fireEvent.click(screen.getByTitle('Modifica messaggio'));
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'World' } });
    fireEvent.click(screen.getByTitle('Conferma modifica'));
    expect(onEdit).toHaveBeenCalledWith('World');
  });

  test('delete triggers onDelete', () => {
    const { onDelete } = setup();
    fireEvent.click(screen.getByTitle('Elimina messaggio'));
    expect(onDelete).toHaveBeenCalled();
  });
});
