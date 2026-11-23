
'use strict';

const crypto = require('crypto');

function generateSecureToken() {
  return crypto.randomBytes(32).toString('base64url');
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token, 'utf8').digest();
}

function generateId() {
  return crypto.randomUUID();
}

module.exports = {
  generateSecureToken,
  hashToken,
  generateId
};
