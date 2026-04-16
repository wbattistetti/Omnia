import { describe, expect, it } from 'vitest';
import { buildUseCaseTree, moveUseCaseKeyToFolder, renameFolderPrefix } from '../tree/useCaseTreeModel';

describe('useCaseTreeModel', () => {
  it('builds folder hierarchy from dot-name keys', () => {
    const tree = buildUseCaseTree([
      { id: '1', key: 'booking.hotel.checkin', label: 'Usecase:booking.hotel.checkin', steps: [] },
      { id: '2', key: 'booking.hotel.checkout', label: 'Usecase:booking.hotel.checkout', steps: [] },
    ]);
    expect(tree[0]?.name).toBe('booking');
    expect(tree[0]?.children[0]?.name).toBe('hotel');
  });

  it('renames folder recursively', () => {
    const next = renameFolderPrefix(
      [
        { id: '1', key: 'booking.hotel.checkin', label: 'Usecase:booking.hotel.checkin', steps: [] },
        { id: '2', key: 'booking.hotel.checkout', label: 'Usecase:booking.hotel.checkout', steps: [] },
      ],
      'booking.hotel',
      'stay'
    );
    expect(next[0].key).toBe('booking.stay.checkin');
    expect(next[1].key).toBe('booking.stay.checkout');
    expect(next[0].label).toBe('Usecase:booking.stay.checkin');
    expect(next[1].label).toBe('Usecase:booking.stay.checkout');
  });

  it('moves one use case under another folder', () => {
    const moved = moveUseCaseKeyToFolder(
      { id: '1', key: 'booking.hotel.checkin', label: 'Usecase:booking.hotel.checkin', steps: [] },
      'support.tickets'
    );
    expect(moved.key).toBe('support.tickets.checkin');
    expect(moved.label).toBe('Usecase:support.tickets.checkin');
  });
});

