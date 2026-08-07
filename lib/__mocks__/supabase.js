import { fake } from '../../test/fakeSupabase';

/**
 * What `jest.mock('../../lib/supabase')` gets.
 *
 * One fake per test file, not per test — a module mock is created when the
 * module is first required, and jest gives each test file its own registry. The
 * per-test half is `fake.reset()`, which a `beforeEach` calls to empty the
 * tables. Tests reach the controls by importing `fake` from `test/fakeSupabase`,
 * which is the same object this hands over.
 */
export const supabase = fake.client;
