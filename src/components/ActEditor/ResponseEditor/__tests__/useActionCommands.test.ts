import React from 'react';
import { render } from '@testing-library/react';
import useActionCommands from '../../ResponseEditor/useActionCommands';
import { Escalation } from '../../ResponseEditor/types';

const makeModel = (): Escalation[] => ([
  { actions: [ { actionId: 'sayMessage', text: 'A' }, { actionId: 'DataRequest', text: 'B' } ] },
  { actions: [ { actionId: 'readFromBackend', text: 'C' } ] },
]);

const Harness = React.forwardRef((props: { initial?: Escalation[] }, ref: React.Ref<any>) => {
  const [model, setModel] = React.useState<Escalation[]>(props.initial || makeModel());
  const api = useActionCommands(setModel);
  React.useImperativeHandle(ref, () => ({ ...api, getModel: () => model, setModel }));
  return null;
});
Harness.displayName = 'Harness';

describe('useActionCommands', () => {
  test('editAction updates text', () => {
    const ref = React.createRef<any>();
    render(<Harness ref={ref} />);
    ref.current.editAction(0, 1, 'NEW');
    const model: Escalation[] = ref.current.getModel();
    expect(model[0].actions[1].text).toBe('NEW');
  });

  test('deleteAction removes action', () => {
    const ref = React.createRef<any>();
    render(<Harness ref={ref} />);
    ref.current.deleteAction(0, 0);
    const model: Escalation[] = ref.current.getModel();
    expect(model[0].actions.map(a => a.actionId)).toEqual(['DataRequest']);
  });

  test('moveAction moves within same escalation', () => {
    const ref = React.createRef<any>();
    render(<Harness ref={ref} />);
    // move action index 0 after index 1 within escalation 0
    ref.current.moveAction(0, 0, 0, 1, 'after');
    const model: Escalation[] = ref.current.getModel();
    expect(model[0].actions.map(a => a.actionId)).toEqual(['DataRequest', 'sayMessage']);
  });

  test('moveAction moves across escalations', () => {
    const ref = React.createRef<any>();
    render(<Harness ref={ref} />);
    ref.current.moveAction(0, 1, 1, 0, 'before');
    const model: Escalation[] = ref.current.getModel();
    expect(model[0].actions.map(a => a.actionId)).toEqual(['sayMessage']);
    expect(model[1].actions.map(a => a.actionId)).toEqual(['DataRequest', 'readFromBackend']);
  });

  test('dropFromViewer normalizes and inserts', () => {
    const ref = React.createRef<any>();
    render(<Harness ref={ref} />);
    const incoming = { action: { id: 'hangUp', icon: 'PhoneOff', color: 'text-red-500', label: { en: 'Hang Up' } } };
    ref.current.dropFromViewer(incoming, { escalationIdx: 1, actionIdx: 0 }, 'after');
    const model: Escalation[] = ref.current.getModel();
    expect(model[1].actions[1].actionId).toBe('hangUp');
    expect(model[1].actions[1].icon).toBe('PhoneOff');
  });
});
