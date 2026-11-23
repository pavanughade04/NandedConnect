
'use strict';

const { pool } = require('../db/pool');
const {
  hashPassword,
  verifyPassword
} = require('../security/password');
const { generateId, generateSecureToken, hashToken } = require('../security/tokens');
const { normalizeEmail, validatePassword } = require('../security/validation');

// This value is only used for malformed login inputs and is never persisted,
// returned, or logged. The dummy hash itself is initialized once and shared.
const DUMMY_PASSWORD_FALLBACK = 'invalid-login-password-fallback';
let dummyPasswordHashPromise;

function initializeAuthSecurity() {
  if (!dummyPasswordHashPromise) {
    // The generated plaintext exists only for this asynchronous hash
    // operation and is never persisted, returned, or logged.
    dummyPasswordHashPromise = hashPassword(generateSecureToken());
  }

  return dummyPasswordHashPromise;
}

async function verifyWithDummyHash(password) {
  const dummyHash = await initializeAuthSecurity();
  await verifyPassword(dummyHash, password);
}

async function rollbackSafely(client, originalError) {
  try {
    await client.query('ROLLBACK');
  } catch (rollbackError) {
    if (!originalError) {
      throw rollbackError;
    }
  }
}

async function signup({ name, email, password }) {
  if (
    typeof name !== 'string' ||
    name.trim().length < 2 ||
    name.trim().length > 100 ||
    !normalizeEmail(email) ||
    !validatePassword(password)
  ) {
    return { error: 'invalid_input' };
  }

  const normalizedEmail = normalizeEmail(email);
  const passwordHash = await hashPassword(password);

  const userId = generateId();
  const verificationId = generateId();
  const verificationToken = generateSecureToken();
  const verificationHash = hashToken(verificationToken);

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    await client.query(
      `INSERT INTO public.users
       (id, email_normalized, password_hash, status, created_at, updated_at)
       VALUES ($1, $2, $3, 'pending', NOW(), NOW())`,
      [userId, normalizedEmail, passwordHash]
    );

    await client.query(
      `INSERT INTO public.user_profiles
       (user_id, display_name, created_at, updated_at)
       VALUES ($1, $2, NOW(), NOW())`,
      [userId, name.trim()]
    );

    await client.query(
      `INSERT INTO public.email_verification_tokens
       (id, user_id, token_hash, expires_at, created_at)
       VALUES ($1, $2, $3, NOW() + INTERVAL '24 hours', NOW())`,
      [verificationId, userId, verificationHash]
    );

    await client.query('COMMIT');

    return { success: true };
  } catch (error) {
    await rollbackSafely(client, error);

    if (error.code === '23505') {
      return { success: true };
    }

    throw error;
  } finally {
    client.release();
  }
}


async function verifyEmail(token) {
  if (
    typeof token !== 'string' ||
    !/^[A-Za-z0-9_-]{43}$/.test(token)
  ) {
    return { error: 'invalid_or_expired_token' };
  }

  const tokenHash = hashToken(token);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const result = await client.query(
      `SELECT
         t.id AS token_id,
         u.id AS user_id
       FROM public.email_verification_tokens t
       JOIN public.users u ON u.id = t.user_id
       WHERE t.token_hash = $1
         AND t.used_at IS NULL
         AND t.revoked_at IS NULL
         AND t.expires_at > NOW()
         AND u.status = 'pending'
       FOR UPDATE OF t, u`,
      [tokenHash]
    );

    if (result.rowCount !== 1) {
      await rollbackSafely(client);
      return { error: 'invalid_or_expired_token' };
    }

    const { token_id, user_id } = result.rows[0];

    await client.query(
      `UPDATE public.email_verification_tokens
       SET used_at = NOW()
       WHERE id = $1`,
      [token_id]
    );

    await client.query(
      `UPDATE public.users
       SET status = 'active',
           email_verified_at = NOW(),
           updated_at = NOW()
       WHERE id = $1`,
      [user_id]
    );

    await client.query('COMMIT');

    return { success: true };
  } catch (error) {
    await rollbackSafely(client, error);
    throw error;
  } finally {
    client.release();
  }
}

async function login({ email, password }) {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail || !validatePassword(password)) {
    await verifyWithDummyHash(
      typeof password === 'string' ? password : DUMMY_PASSWORD_FALLBACK
    );
    return { error: 'invalid_credentials' };
  }

  const result = await pool.query(
    `SELECT id, password_hash
     FROM public.users
     WHERE email_normalized = $1
       AND status = 'active'
       AND email_verified_at IS NOT NULL
     LIMIT 1`,
    [normalizedEmail]
  );

  if (result.rowCount !== 1) {
    await verifyWithDummyHash(password);
    return { error: 'invalid_credentials' };
  }

  const user = result.rows[0];

  const passwordMatches = await verifyPassword(
    user.password_hash,
    password
  );

  if (!passwordMatches) {
    return { error: 'invalid_credentials' };
  }

  const sessionId = generateId();
  const sessionToken = generateSecureToken();
  const sessionHash = hashToken(sessionToken);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    await client.query(
      `INSERT INTO public.sessions
       (id, user_id, token_hash, created_at, last_used_at, expires_at)
       VALUES ($1, $2, $3, NOW(), NOW(), NOW() + INTERVAL '7 days')`,
      [sessionId, user.id, sessionHash]
    );

    await client.query('COMMIT');
  } catch (error) {
    await rollbackSafely(client, error);
    throw error;
  } finally {
    client.release();
  }

  return {
    success: true,
    sessionId,
    sessionToken
  };
}

async function logout({ sessionId, userId }) {
  if (!sessionId || !userId) {
    return { error: 'invalid_session' };
  }

  await pool.query(
    `UPDATE public.sessions
     SET revoked_at = NOW(),
         revocation_reason = 'user_logout'
     WHERE id = $1
       AND user_id = $2
       AND revoked_at IS NULL`,
    [sessionId, userId]
  );

  return { success: true };
}


module.exports = {
  initializeAuthSecurity,
  signup,
  verifyEmail,
  login,
  logout
};
