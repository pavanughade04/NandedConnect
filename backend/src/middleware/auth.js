
'use strict';

const { pool } = require('../db/pool');
const { COOKIE_NAME } = require('../security/cookies');
const { hashToken } = require('../security/tokens');

function getCookie(req, name) {
  const cookieHeader = req.headers.cookie;

  if (!cookieHeader) {
    return null;
  }

  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=');

    if (separator === -1) {
      continue;
    }

    const cookieName = part.slice(0, separator).trim();

    if (cookieName === name) {
      return part.slice(separator + 1).trim();
    }
  }

  return null;
}

async function requireAuth(req, res, next) {
  try {
    const token = getCookie(req, COOKIE_NAME);

    if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    const tokenHash = hashToken(token);

    const result = await pool.query(
      `SELECT
         s.id AS session_id,
         s.user_id,
         u.email_normalized,
         u.status
       FROM public.sessions s
       JOIN public.users u ON u.id = s.user_id
       WHERE s.token_hash = $1
         AND s.revoked_at IS NULL
         AND s.expires_at > NOW()
         AND u.status = 'active'
         AND u.email_verified_at IS NOT NULL
       LIMIT 1`,
      [tokenHash]
    );

    if (result.rowCount !== 1) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    const session = result.rows[0];

    req.auth = {
      sessionId: session.session_id,
      userId: session.user_id,
      email: session.email_normalized
    };

    next();
  } catch (error) {
    next(error);
  }
}

module.exports = {
  requireAuth
};
