/**
 * Turning what a server said into what a grower reads.
 *
 * Supabase hands back three quite different kinds of failure — Postgres through
 * PostgREST, GoTrue for anything to do with accounts, and the plain network
 * underneath both — and left alone they surface as
 * `duplicate key value violates unique constraint "growspace_lights_pkey"` or
 * `JWT expired`. Both are true and neither belongs on a phone.
 *
 * So every error goes through here. The raw one is never thrown away — it is
 * what a bug report needs — but what a screen shows is a sentence written for
 * the person holding the phone, in the same voice as the rest of the app.
 *
 * The codes are matched first, since they are the stable part of the contract,
 * and the message text second, because older GoTrue releases send the wording
 * without a code and a phone on a slow update cycle will meet them for years.
 */

/** Postgres SQLSTATE codes that reach a user, and what they actually mean here. */
const POSTGRES_MESSAGES = {
  // 23xxx — integrity constraints, i.e. the things the schema promises.
  23505: 'That has already been added.',
  23503: 'Something else is still using this, so it can’t be removed yet.',
  23502: 'Something required was left blank.',
  23514: 'That value isn’t allowed.',
  // 22xxx — the value itself was the problem.
  '22P02': 'That doesn’t look like a number.',
  22003: 'That number is too large.',
  22001: 'That’s too long to save.',
  // Access and timing.
  42501: 'You don’t have access to that.',
  57014: 'That took too long. Try it again.',
  40001: 'Something else changed that at the same time. Try again.',
  '40P01': 'Something else changed that at the same time. Try again.',
};

/** PostgREST's own codes, which are about the request rather than the data. */
const POSTGREST_MESSAGES = {
  PGRST116: 'That isn’t there any more — it may have been deleted.',
  PGRST301: 'Your session has expired. Sign in again.',
};

/**
 * GoTrue error codes. These are the ones a grower can actually hit; the rest
 * fall through to the generic message rather than being guessed at.
 */
const AUTH_MESSAGES = {
  invalid_credentials: 'That email and password don’t match.',
  email_not_confirmed: 'Confirm your email address first — check your inbox for the link.',
  user_already_exists: 'There’s already an account with that email.',
  email_exists: 'There’s already an account with that email.',
  weak_password: 'That password is too easy to guess. Use at least eight characters.',
  same_password: 'That’s already your password.',
  over_request_rate_limit: 'Too many tries. Wait a minute and try again.',
  over_email_send_rate_limit: 'Too many emails sent. Wait a few minutes before trying again.',
  signup_disabled: 'New accounts aren’t being accepted at the moment.',
  session_expired: 'Your session has expired. Sign in again.',
  session_not_found: 'Your session has expired. Sign in again.',
  validation_failed: 'Check the details and try again.',
};

/**
 * Wordings older GoTrue sends without a code, matched on lowercased text.
 * Ordered, because "email not confirmed" and "invalid login credentials" can
 * both appear in one message and the first is the more useful thing to say.
 */
const AUTH_TEXT_MATCHES = [
  ['email not confirmed', AUTH_MESSAGES.email_not_confirmed],
  ['already registered', AUTH_MESSAGES.user_already_exists],
  ['already been registered', AUTH_MESSAGES.user_already_exists],
  ['invalid login credentials', AUTH_MESSAGES.invalid_credentials],
  ['password should be at least', AUTH_MESSAGES.weak_password],
  ['rate limit', AUTH_MESSAGES.over_request_rate_limit],
  ['for security purposes', AUTH_MESSAGES.over_request_rate_limit],
];

/** What a fetch that never reached the server looks like, across platforms. */
const NETWORK_TEXT = ['network request failed', 'failed to fetch', 'network error', 'timeout'];

const GENERIC = 'Something went wrong. Try again.';
const OFFLINE = 'No connection. Check your network and try again.';

function text(error) {
  return String(error?.message ?? '').toLowerCase();
}

/**
 * Whether the request never made it to the server.
 *
 * Worth telling apart from everything else: it is the one failure where
 * "try again" is honest advice rather than a shrug, and the one the app should
 * retry on its own.
 */
export function isNetworkError(error) {
  if (!error) return false;
  // A fetch that fails to reach the host rejects with a TypeError in React
  // Native, with no status and no code to go on.
  if (error.name === 'TypeError' && !error.status && !error.code) return true;
  return NETWORK_TEXT.some((phrase) => text(error).includes(phrase));
}

/** A request called off deliberately — a stale search, a screen left early. */
export function isAbortError(error) {
  return error?.name === 'AbortError' || text(error).includes('aborted');
}

/** Whether the session is gone and the only way forward is signing in again. */
export function isAuthExpired(error) {
  if (!error) return false;
  if (error.code === 'PGRST301' || error.code === 'session_expired') return true;
  if (error.code === 'session_not_found') return true;
  return text(error).includes('jwt expired') || text(error).includes('jwt is expired');
}

/**
 * Whether trying the same request again could plausibly work.
 *
 * The rule is about whose fault it was. A network drop or a server fault might
 * pass on the second go; a unique violation or a row that isn't there will fail
 * identically however many times it is asked, and retrying only makes the
 * screen sit there longer before saying so.
 */
export function isRetryable(error) {
  if (!error || isAbortError(error)) return false;
  if (isNetworkError(error)) return true;

  const status = Number(error.status ?? error.statusCode ?? 0);
  if (status >= 500) return true;
  // Too many requests and request timeout are the two 4xx worth another go.
  if (status === 408 || status === 429) return true;
  if (status >= 400) return false;

  const code = String(error.code ?? '');
  // Serialization failure and deadlock are Postgres asking to be asked again.
  return code === '40001' || code === '40P01' || code === '57014';
}

/**
 * The sentence to put on screen.
 *
 * `fallback` is for the places that know their own context better than this
 * does — a form that can say "that growspace name is taken" where a shared
 * mapping can only say "that has already been added".
 *
 * @param {unknown} error
 * @param {string} [fallback]
 * @returns {string}
 */
export function messageFor(error, fallback = GENERIC) {
  if (!error) return fallback;
  if (isNetworkError(error)) return OFFLINE;
  if (isAuthExpired(error)) return 'Your session has expired. Sign in again.';

  const code = String(/** @type {any} */ (error).code ?? '');
  if (POSTGREST_MESSAGES[code]) return POSTGREST_MESSAGES[code];
  if (POSTGRES_MESSAGES[code]) return POSTGRES_MESSAGES[code];
  if (AUTH_MESSAGES[code]) return AUTH_MESSAGES[code];

  const lowered = text(error);
  const matched = AUTH_TEXT_MATCHES.find(([phrase]) => lowered.includes(phrase));
  if (matched) return matched[1];

  // A sentence this app wrote about its own failure, which knows more than any
  // mapping can: the half-saves say which half landed, and that is the whole
  // reason a grower knows to press save again rather than start over. It is
  // read off the error rather than out of `.message`, so the cause it was
  // composed from stays in the log where it belongs.
  const summary = /** @type {any} */ (error).summary;
  if (typeof summary === 'string' && summary) return summary;

  return fallback;
}

/**
 * The raw error as one line, for a log or a bug report.
 *
 * Kept beside `messageFor` on purpose: the pair is the whole policy — the user
 * gets the sentence, the log gets everything else, and neither gets the other's.
 */
export function describeError(error) {
  if (!error) return 'no error';
  const parts = [
    /** @type {any} */ (error).code && `code=${/** @type {any} */ (error).code}`,
    /** @type {any} */ (error).status && `status=${/** @type {any} */ (error).status}`,
    /** @type {any} */ (error).details && `details=${/** @type {any} */ (error).details}`,
    /** @type {any} */ (error).hint && `hint=${/** @type {any} */ (error).hint}`,
  ].filter(Boolean);
  return [/** @type {any} */ (error).message ?? String(error), ...parts].join(' · ');
}
