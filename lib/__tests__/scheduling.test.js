// The clock and calendar maths behind a scheduled action. Supabase and the
// notification module are stubbed: what is tested here is what the reminder
// would be told, not the booking of it.
jest.mock('../supabase', () => ({ supabase: {} }));
jest.mock('../notifications', () => ({
  SCHEDULE_CHANNEL: 'scheduled-actions',
  cancelReminder: jest.fn(),
  scheduleReminderAt: jest.fn(),
}));
jest.mock('../../components/DateField', () => ({
  toDateString: (date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
      date.getDate()
    ).padStart(2, '0')}`,
}));

import {
  allowsWholePlace,
  dueAt,
  formatMinutes,
  minutesOf,
  overdueActions,
  reminderText,
  scheduleKindLabel,
  scheduleStatus,
  scheduleSummary,
  targetKindFor,
  targetSummary,
} from '../scheduling';

const action = (overrides) => ({
  id: 'a1',
  kind: 'sow',
  subject: 'Chilli',
  due_on: '2026-08-05',
  due_minutes: 510,
  done_on: null,
  note: null,
  ...overrides,
});

describe('formatMinutes', () => {
  it('reads minutes past midnight as a 24-hour clock', () => {
    expect(formatMinutes(510)).toBe('08:30');
    expect(formatMinutes(0)).toBe('00:00');
    expect(formatMinutes(1439)).toBe('23:59');
  });

  it('has nothing to show for no time set', () => {
    expect(formatMinutes(null)).toBeNull();
    expect(formatMinutes(undefined)).toBeNull();
  });
});

describe('minutesOf', () => {
  it('takes the clock part of a picked time', () => {
    expect(minutesOf(new Date(2026, 7, 5, 8, 30))).toBe(510);
    expect(minutesOf(new Date(2026, 7, 5, 0, 0))).toBe(0);
  });

  it('round-trips through formatMinutes', () => {
    expect(formatMinutes(minutesOf(new Date(2026, 7, 5, 17, 45)))).toBe('17:45');
  });
});

describe('dueAt', () => {
  it('builds a local moment from the day and the time', () => {
    const due = dueAt(action());
    expect(due.getFullYear()).toBe(2026);
    expect(due.getMonth()).toBe(7);
    expect(due.getDate()).toBe(5);
    expect(due.getHours()).toBe(8);
    expect(due.getMinutes()).toBe(30);
  });

  it('falls back to midnight when no time was set', () => {
    const due = dueAt(action({ due_minutes: null }));
    expect(due.getHours()).toBe(0);
    expect(due.getMinutes()).toBe(0);
  });

  it('has no moment without a day', () => {
    expect(dueAt(action({ due_on: null }))).toBeNull();
    expect(dueAt(null)).toBeNull();
  });
});

describe('scheduleStatus', () => {
  const today = '2026-08-05';

  it('calls a ticked-off action done, whenever it was due', () => {
    expect(scheduleStatus(action({ done_on: '2026-08-04', due_on: '2026-08-01' }), today)).toBe(
      'done'
    );
  });

  it('leaves a missed day overdue rather than moving it', () => {
    expect(scheduleStatus(action({ due_on: '2026-08-01' }), today)).toBe('overdue');
  });

  it('separates today from what is still ahead', () => {
    expect(scheduleStatus(action({ due_on: today }), today)).toBe('due');
    expect(scheduleStatus(action({ due_on: '2026-08-09' }), today)).toBe('upcoming');
  });
});

describe('overdueActions', () => {
  it('picks out only what is still open and past its day', () => {
    const actions = [
      action({ id: 'missed', due_on: '2026-08-01' }),
      action({ id: 'done', due_on: '2026-08-01', done_on: '2026-08-02' }),
      action({ id: 'today', due_on: '2026-08-05' }),
      action({ id: 'ahead', due_on: '2026-08-20' }),
    ];
    expect(overdueActions(actions, '2026-08-05').map((entry) => entry.id)).toEqual(['missed']);
  });
});

describe('scheduleSummary', () => {
  it('names the action and its reminder time', () => {
    expect(scheduleSummary(action())).toBe('Sow · 08:30');
  });

  it('leaves the time out when there is none', () => {
    expect(scheduleSummary(action({ due_minutes: null }))).toBe('Sow');
  });
});

describe('reminderText', () => {
  it('says what is to be done and to what', () => {
    expect(reminderText(action())).toEqual({
      title: 'Sow: Chilli',
      body: 'Scheduled in Plannter for today.',
    });
  });

  it('uses the note the grower wrote when there is one', () => {
    expect(reminderText(action({ note: 'Soak them overnight first' })).body).toBe(
      'Soak them overnight first'
    );
  });
});

describe('scheduleKindLabel', () => {
  it('falls back rather than showing a raw value', () => {
    expect(scheduleKindLabel('feed')).toBe('Feed');
    expect(scheduleKindLabel('nonsense')).toBe('Action');
  });
});

describe('targetKindFor', () => {
  it('offers the plants standing in a growspace', () => {
    expect(targetKindFor('feed', 'growspace')).toBe('plants');
    expect(targetKindFor('water', 'growspace')).toBe('plants');
  });

  it('offers the sowings in a station instead', () => {
    expect(targetKindFor('feed', 'station')).toBe('sowings');
    expect(targetKindFor('transplant', 'station')).toBe('sowings');
    expect(targetKindFor('thin', 'station')).toBe('sowings');
  });

  it('offers nothing for a transplant out of a growspace, which holds no sowings', () => {
    expect(targetKindFor('transplant', 'growspace')).toBeNull();
    expect(targetKindFor('thin', 'growspace')).toBeNull();
  });

  it('offers nothing for the kinds that name no targets at all', () => {
    expect(targetKindFor('sow', 'station')).toBeNull();
    expect(targetKindFor('other', 'growspace')).toBeNull();
    expect(targetKindFor('nonsense', 'growspace')).toBeNull();
  });
});

describe('allowsWholePlace', () => {
  it('lets a feed or a water mean the whole space', () => {
    expect(allowsWholePlace('feed')).toBe(true);
    expect(allowsWholePlace('water')).toBe(true);
  });

  it('makes a transplant or a thin say what it is for', () => {
    expect(allowsWholePlace('transplant')).toBe(false);
    expect(allowsWholePlace('thin')).toBe(false);
    expect(allowsWholePlace('nonsense')).toBe(false);
  });
});

describe('targetSummary', () => {
  const target = (label) => ({ label });

  it('names them while there are few enough to read', () => {
    expect(targetSummary([target('Basil'), target('Chilli')])).toBe('Basil, Chilli');
  });

  it('counts the rest once there are too many', () => {
    expect(
      targetSummary([target('Basil'), target('Chilli'), target('Puma'), target('Roxa')])
    ).toBe('Basil, Chilli +2');
  });

  it('is nothing at all when the plan is for the whole place', () => {
    expect(targetSummary([])).toBeNull();
    expect(targetSummary(undefined)).toBeNull();
  });

  it('ignores a target whose label never made it', () => {
    expect(targetSummary([target('Basil'), target(null)])).toBe('Basil');
  });
});
