/**
 * A stand-in for the Supabase client, holding its tables in memory.
 *
 * The seam is the client itself rather than HTTP. Everything above it is real:
 * a test drives the dialog, which calls the hook, which calls the function in
 * `lib/` that builds the query — so the mapping, the error handling and the
 * cache invalidation are all under test, and only the round trip is not. MSW
 * would put the seam one layer lower and buy a PostgREST URL grammar nobody
 * here writes by hand.
 *
 * What it deliberately doesn't do is resolve embeds. `select('*, light:grow_lights(*)')`
 * returns the seeded row as it stands, so a fixture for that query is written
 * with the embed already on it. Teaching the fake to join would mean teaching it
 * this schema's twenty foreign keys, and the tests would then be proving the
 * fake joins correctly rather than proving the app reads what it is given.
 * Column lists are ignored for the same reason: what is seeded is what comes
 * back.
 *
 * Filters, ordering and the insert/update/delete side *are* honoured, because
 * those decide which rows a screen sees and are the part a query gets wrong.
 */

const clone = (value) =>
  value === undefined || value === null ? value : JSON.parse(JSON.stringify(value));

/** PostgREST's comparison operators, as far as this app uses them. */
const OPERATORS = {
  eq: (a, b) => a === b,
  neq: (a, b) => a !== b,
  gt: (a, b) => a > b,
  gte: (a, b) => a >= b,
  lt: (a, b) => a < b,
  lte: (a, b) => a <= b,
  is: (a, b) => a === b,
  in: (a, b) => b.includes(a),
};

function test(row, { column, operator, value, negated }) {
  const compare = OPERATORS[operator];
  if (!compare) throw new Error(`fake supabase: unsupported operator "${operator}"`);
  const outcome = compare(row[column], value);
  return negated ? !outcome : outcome;
}

/**
 * One arm of an `.or()` string: `growspace_id.not.is.null` or `status.eq.sown`.
 * The value is the remainder rather than the next segment, since a value can
 * itself contain a dot.
 */
function parseCondition(text) {
  const parts = text.split('.');
  const column = parts.shift();
  const negated = parts[0] === 'not';
  if (negated) parts.shift();
  const operator = parts.shift();
  const raw = parts.join('.');
  const value = raw === 'null' ? null : raw;
  return { column, operator, value, negated };
}

class FakeQuery {
  /**
   * @param {Map<string, any[]>} tables
   * @param {string} table
   * @param {{ nextId: () => string, failures: Map<string, any[]> }} store
   */
  constructor(tables, table, store) {
    this.tables = tables;
    this.table = table;
    this.store = store;
    this.action = 'select';
    this.payload = null;
    this.conditions = [];
    this.sorts = [];
    this.rowLimit = null;
    this.returning = false;
    this.shape = 'many';
  }

  rows() {
    if (!this.tables.has(this.table)) this.tables.set(this.table, []);
    return this.tables.get(this.table);
  }

  matching() {
    return this.rows().filter((row) =>
      this.conditions.every((condition) =>
        condition.matches ? condition.matches(row) : test(row, condition)
      )
    );
  }

  /** On a write this is the request to send the affected rows back. */
  select() {
    this.returning = true;
    return this;
  }

  insert(values) {
    this.action = 'insert';
    this.payload = Array.isArray(values) ? values : [values];
    return this;
  }

  update(values) {
    this.action = 'update';
    this.payload = values;
    return this;
  }

  upsert(values) {
    this.action = 'upsert';
    this.payload = Array.isArray(values) ? values : [values];
    return this;
  }

  delete() {
    this.action = 'delete';
    return this;
  }

  filterBy(operator, column, value, negated = false) {
    this.conditions.push({ column, operator, value, negated });
    return this;
  }

  eq(column, value) {
    return this.filterBy('eq', column, value);
  }
  neq(column, value) {
    return this.filterBy('neq', column, value);
  }
  gt(column, value) {
    return this.filterBy('gt', column, value);
  }
  gte(column, value) {
    return this.filterBy('gte', column, value);
  }
  lt(column, value) {
    return this.filterBy('lt', column, value);
  }
  lte(column, value) {
    return this.filterBy('lte', column, value);
  }
  is(column, value) {
    return this.filterBy('is', column, value);
  }
  in(column, values) {
    return this.filterBy('in', column, values);
  }
  not(column, operator, value) {
    return this.filterBy(operator, column, value, true);
  }

  or(text) {
    const arms = text.split(',').map(parseCondition);
    this.conditions.push({
      column: null,
      operator: 'or',
      value: null,
      negated: false,
      // Handled here rather than in OPERATORS, which compares one column.
      matches: (row) => arms.some((arm) => test(row, arm)),
    });
    return this;
  }

  order(column, { ascending = true } = {}) {
    this.sorts.push({ column, ascending });
    return this;
  }

  limit(count) {
    this.rowLimit = count;
    return this;
  }

  single() {
    this.shape = 'single';
    return this;
  }

  maybeSingle() {
    this.shape = 'maybe';
    return this;
  }

  run() {
    const queued = this.store.failures.get(this.table);
    if (queued?.length) {
      // `skip` lets a failure be aimed at the second or third query against a
      // table rather than the next one, which is what the hand-rolled
      // multi-write paths need: a swap is three writes and the interesting
      // failure is the middle one.
      if (queued[0].skip > 0) queued[0].skip -= 1;
      else return { data: null, error: queued.shift().error };
    }

    let result;
    switch (this.action) {
      case 'insert':
      case 'upsert': {
        result = this.payload.map((values) => {
          const row = { id: this.store.nextId(), created_at: new Date().toISOString(), ...values };
          const existing =
            this.action === 'upsert' ? this.rows().findIndex((it) => it.id === row.id) : -1;
          if (existing >= 0) this.rows()[existing] = { ...this.rows()[existing], ...row };
          else this.rows().push(row);
          return row;
        });
        break;
      }
      case 'update': {
        result = this.matching().map((row) => Object.assign(row, this.payload));
        break;
      }
      case 'delete': {
        result = this.matching();
        const removed = new Set(result);
        this.tables.set(
          this.table,
          this.rows().filter((row) => !removed.has(row))
        );
        break;
      }
      default: {
        result = this.matching();
        for (const { column, ascending } of [...this.sorts].reverse()) {
          result = [...result].sort((a, b) => {
            if (a[column] === b[column]) return 0;
            const order = a[column] > b[column] ? 1 : -1;
            return ascending ? order : -order;
          });
        }
        if (this.rowLimit !== null) result = result.slice(0, this.rowLimit);
      }
    }

    const data = clone(result);

    if (this.shape === 'single') {
      if (data.length !== 1) {
        return {
          data: null,
          // PGRST116 is what PostgREST returns when `.single()` doesn't get
          // exactly one row, and `lib/errors.js` has a sentence for it.
          error: {
            code: 'PGRST116',
            message: 'JSON object requested, multiple (or no) rows returned',
          },
        };
      }
      return { data: data[0], error: null };
    }
    if (this.shape === 'maybe') {
      return { data: data[0] ?? null, error: null };
    }
    // A write without `.select()` sends nothing back, which is worth keeping:
    // code that reads `data` off an un-selected insert is a real bug.
    if (this.action !== 'select' && !this.returning) return { data: null, error: null };
    return { data, error: null };
  }

  /** Awaiting the builder is what runs it — the client works the same way. */
  then(resolve, reject) {
    return Promise.resolve()
      .then(() => this.run())
      .then(resolve, reject);
  }
}

/**
 * @param {object} [options]
 * @param {any} [options.session] What `auth.getSession()` reports. Defaults to a
 *   signed-in user, since all but the auth screens run behind one.
 */
export function createFakeSupabase({ session = defaultSession() } = {}) {
  const tables = new Map();
  const failures = new Map();
  let counter = 0;

  const store = {
    failures,
    nextId: () => `00000000-0000-4000-8000-${String(++counter).padStart(12, '0')}`,
  };

  let currentSession = session;
  const listeners = new Set();

  /**
   * Auth is jest mocks over these, rather than a fake GoTrue. A screen that
   * signs in cares about two things — that it asked, and what it did with the
   * answer — so a test says what the answer is with `mockResolvedValueOnce` and
   * the succeeding case is the default. Kept in one place so `reset()` can put
   * them back: a `…Once` queued by a test that then failed would otherwise be
   * waiting for the next one.
   */
  const authDefaults = {
    getSession: async () => ({ data: { session: currentSession }, error: null }),
    getUser: async () => ({ data: { user: currentSession?.user ?? null }, error: null }),
    signInWithPassword: async () => ({
      data: { session: currentSession, user: currentSession?.user ?? null },
      error: null,
    }),
    signUp: async () => ({
      data: { session: currentSession, user: currentSession?.user ?? null },
      error: null,
    }),
    signOut: async () => {
      currentSession = null;
      listeners.forEach((listener) => listener('SIGNED_OUT', null));
      return { error: null };
    },
    onAuthStateChange: (listener) => {
      listeners.add(listener);
      return { data: { subscription: { unsubscribe: () => listeners.delete(listener) } } };
    },
  };

  // The cast is for the typechecker only: the six of them have six different
  // signatures, and jest.fn's own types insist a group like this is one shape.
  const auth = Object.fromEntries(
    Object.entries(authDefaults).map(([name, impl]) => [name, jest.fn(/** @type {any} */ (impl))])
  );

  const client = {
    from: (table) => new FakeQuery(tables, table, store),
    rpc: jest.fn(async () => ({ data: null, error: null })),
    auth,
  };

  return {
    client,

    /** Put rows in a table. Called again for the same table, it adds to it. */
    seed(table, rows) {
      if (!tables.has(table)) tables.set(table, []);
      tables.get(table).push(...clone(Array.isArray(rows) ? rows : [rows]));
      return this;
    },

    /** What a table holds now — for asserting on what a save actually wrote. */
    rows(table) {
      return clone(tables.get(table) ?? []);
    },

    /**
     * Make the next query against a table fail. Queued, so a test can fail the
     * first attempt and let the retry through.
     *
     * `after` lets a later query be the one that fails — `{ after: 1 }` waves
     * the next one through and fails the one behind it. That is how the
     * multi-write paths are tested: `swapPlants` is three writes with no
     * transaction under them, and what it leaves behind depends entirely on
     * which of the three didn't land.
     *
     * @param {string} table
     * @param {any} [error]
     * @param {{ after?: number }} [options]
     */
    failNext(table, error = { code: '08006', message: 'connection failure' }, { after = 0 } = {}) {
      if (!failures.has(table)) failures.set(table, []);
      failures.get(table).push({ error, skip: after });
      return this;
    },

    setSession(next) {
      currentSession = next;
      listeners.forEach((listener) => listener(next ? 'SIGNED_IN' : 'SIGNED_OUT', next));
    },

    reset() {
      tables.clear();
      failures.clear();
      counter = 0;
      currentSession = session;
      listeners.clear();
      client.rpc.mockReset().mockImplementation(async () => ({ data: null, error: null }));
      for (const [name, impl] of Object.entries(authDefaults)) {
        auth[name].mockReset().mockImplementation(/** @type {any} */ (impl));
      }
    },
  };
}

export function defaultSession(user = { id: 'user-1', email: 'grower@example.com' }) {
  return { user, access_token: 'test-token', refresh_token: 'test-refresh' };
}

/**
 * The one the manual mock installs, and the one tests seed and read.
 *
 * It lives here rather than in `lib/__mocks__/supabase.js` so that a test can
 * import it by name: jest gives each test file its own module registry, so
 * `jest.mock('../lib/supabase')` and an import of this module land on the same
 * instance — and unlike the mock, this file is what it says it is to the
 * typechecker.
 */
export const fake = createFakeSupabase();
