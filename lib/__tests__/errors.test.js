import {
  describeError,
  isAbortError,
  isAuthExpired,
  isNetworkError,
  isRetryable,
  messageFor,
} from '../errors';

/** What supabase-js hands back from a failed PostgREST call. */
const postgrest = (code, message = 'raw postgres text') => ({
  code,
  message,
  details: null,
  hint: null,
});

/** What GoTrue hands back, which carries a status where PostgREST does not. */
const auth = (code, message = 'raw auth text', status = 400) => ({ code, message, status });

describe('isNetworkError', () => {
  it('recognises a fetch that never reached the host', () => {
    const failure = new TypeError('Network request failed');
    expect(isNetworkError(failure)).toBe(true);
  });

  it('recognises the other platforms’ wordings', () => {
    expect(isNetworkError(new Error('Failed to fetch'))).toBe(true);
    expect(isNetworkError(new Error('Network Error'))).toBe(true);
  });

  it('treats a bare TypeError with no status or code as a network failure', () => {
    expect(isNetworkError(new TypeError('something odd'))).toBe(true);
  });

  it('does not claim a server error is a network one', () => {
    expect(isNetworkError(postgrest('23505'))).toBe(false);
    expect(isNetworkError(auth('invalid_credentials'))).toBe(false);
  });

  it('is false for nothing at all', () => {
    expect(isNetworkError(null)).toBe(false);
    expect(isNetworkError(undefined)).toBe(false);
  });
});

describe('isAbortError', () => {
  it('recognises a request called off deliberately', () => {
    const cancelled = new Error('The operation was aborted');
    cancelled.name = 'AbortError';
    expect(isAbortError(cancelled)).toBe(true);
  });

  it('leaves real failures alone', () => {
    expect(isAbortError(postgrest('23505'))).toBe(false);
  });
});

describe('isAuthExpired', () => {
  it('recognises PostgREST refusing an expired token', () => {
    expect(isAuthExpired(postgrest('PGRST301', 'JWT expired'))).toBe(true);
  });

  it('recognises the wording alone, without a code', () => {
    expect(isAuthExpired(new Error('JWT expired'))).toBe(true);
  });

  it('recognises a session that is simply gone', () => {
    expect(isAuthExpired(auth('session_not_found'))).toBe(true);
  });

  it('does not confuse a wrong password with an expired session', () => {
    expect(isAuthExpired(auth('invalid_credentials'))).toBe(false);
  });
});

describe('isRetryable', () => {
  it('retries a dropped connection', () => {
    expect(isRetryable(new TypeError('Network request failed'))).toBe(true);
  });

  it('retries a server fault', () => {
    expect(isRetryable({ status: 500, message: 'boom' })).toBe(true);
    expect(isRetryable({ status: 503, message: 'unavailable' })).toBe(true);
  });

  it('retries only the two 4xx worth retrying', () => {
    expect(isRetryable({ status: 408, message: 'timeout' })).toBe(true);
    expect(isRetryable({ status: 429, message: 'slow down' })).toBe(true);
    expect(isRetryable({ status: 400, message: 'bad request' })).toBe(false);
    expect(isRetryable({ status: 404, message: 'gone' })).toBe(false);
  });

  it('does not retry a constraint the data will break again', () => {
    expect(isRetryable(postgrest('23505'))).toBe(false);
    expect(isRetryable(postgrest('23503'))).toBe(false);
    expect(isRetryable(postgrest('PGRST116'))).toBe(false);
  });

  it('retries what Postgres asks to be asked again', () => {
    expect(isRetryable(postgrest('40001'))).toBe(true);
    expect(isRetryable(postgrest('40P01'))).toBe(true);
    expect(isRetryable(postgrest('57014'))).toBe(true);
  });

  it('never retries a request that was called off', () => {
    const cancelled = new Error('aborted');
    cancelled.name = 'AbortError';
    expect(isRetryable(cancelled)).toBe(false);
  });

  it('is false for nothing at all', () => {
    expect(isRetryable(null)).toBe(false);
  });
});

describe('messageFor', () => {
  it('never returns the raw database text', () => {
    const raw = 'duplicate key value violates unique constraint "growspaces_pkey"';
    expect(messageFor(postgrest('23505', raw))).not.toContain('duplicate key');
  });

  it('says what an integrity failure meant', () => {
    expect(messageFor(postgrest('23505'))).toMatch(/already been added/i);
    expect(messageFor(postgrest('23503'))).toMatch(/still using this/i);
    expect(messageFor(postgrest('23502'))).toMatch(/required was left blank/i);
  });

  it('says a row is gone rather than showing PGRST116', () => {
    expect(messageFor(postgrest('PGRST116'))).toMatch(/isn’t there any more/i);
  });

  it('puts the network first, whatever else the error carries', () => {
    const offline = new TypeError('Network request failed');
    expect(messageFor(offline)).toMatch(/no connection/i);
  });

  it('maps the auth codes a grower can actually hit', () => {
    expect(messageFor(auth('invalid_credentials'))).toMatch(/don’t match/i);
    expect(messageFor(auth('email_not_confirmed'))).toMatch(/confirm your email/i);
    expect(messageFor(auth('user_already_exists'))).toMatch(/already an account/i);
    expect(messageFor(auth('weak_password'))).toMatch(/too easy to guess/i);
  });

  it('falls back to the wording when an older GoTrue sends no code', () => {
    expect(messageFor(new Error('Invalid login credentials'))).toMatch(/don’t match/i);
    expect(messageFor(new Error('Email not confirmed'))).toMatch(/confirm your email/i);
    expect(messageFor(new Error('User already registered'))).toMatch(/already an account/i);
  });

  it('prefers an unconfirmed email over a credentials mismatch', () => {
    const both = new Error('Email not confirmed: invalid login credentials');
    expect(messageFor(both)).toMatch(/confirm your email/i);
  });

  it('uses the caller’s wording when it knows its own context better', () => {
    const named = messageFor(postgrest('23505'), 'That growspace name is taken.');
    // A mapped code still wins: the caller's fallback is for what isn't mapped.
    expect(named).toMatch(/already been added/i);
    expect(messageFor(postgrest('XX000'), 'That growspace name is taken.')).toBe(
      'That growspace name is taken.'
    );
  });

  it('has something to say about an error it has never seen', () => {
    expect(messageFor(new Error('nobody has ever seen this'))).toMatch(/something went wrong/i);
    expect(messageFor(null)).toMatch(/something went wrong/i);
  });

  it('shows a sentence this app wrote about its own half-finished save', () => {
    // The half-saves know which half landed, which is more than any mapping
    // can work out — and it is the whole reason a grower knows to press save
    // again rather than start over. Before this, "the growspace was saved but
    // its grids weren't" reached the screen as "something went wrong".
    const failure = new Error('The growspace was saved, but its grids weren’t: 23514 violates …');
    // @ts-expect-error - the annotation the data layer puts on a partial save
    failure.summary = 'The growspace was saved, but its grids weren’t';

    expect(messageFor(failure)).toBe('The growspace was saved, but its grids weren’t');
    // Only the summary: the cause it was composed from stays in the message,
    // where a log can have it and a user can't.
    expect(messageFor(failure)).not.toContain('23514');
  });

  it('still prefers a mapped code to a summary', () => {
    const failure = new Error('nope');
    // @ts-expect-error - a summary is no reason to stop reading the code
    failure.summary = 'Half of it saved.';
    // @ts-expect-error - and this one has a code worth reading
    failure.code = '23505';

    expect(messageFor(failure)).toMatch(/already been added/i);
  });
});

describe('describeError', () => {
  it('keeps everything the user was spared', () => {
    const raw = {
      message: 'duplicate key value violates unique constraint',
      code: '23505',
      details: 'Key (id)=(1) already exists.',
      hint: null,
    };
    const described = describeError(raw);
    expect(described).toContain('duplicate key');
    expect(described).toContain('code=23505');
    expect(described).toContain('details=Key (id)=(1) already exists.');
  });

  it('handles an error with nothing on it', () => {
    expect(describeError(null)).toBe('no error');
    expect(describeError(new Error('plain'))).toBe('plain');
  });
});
