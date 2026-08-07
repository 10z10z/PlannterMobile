/**
 * Runs before the test framework, and so before any module `import`s.
 *
 * `lib/supabase.js` throws at import time when its two variables are missing,
 * which is deliberate — a dev server started without a `.env` should say so
 * rather than fail later inside `createClient`. In a test run that check would
 * fire on any module that transitively reaches the client, including the ones
 * that go on to mock it, so the variables are supplied here. They point nowhere:
 * every test that touches data mocks `lib/supabase` outright, and a test that
 * forgot to should fail on a refused connection rather than reach a real
 * project.
 */
process.env.EXPO_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
