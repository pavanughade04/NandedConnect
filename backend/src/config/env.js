'use strict';

const dotenv = require('dotenv');

dotenv.config();

function requiredString(name) {
  const value = process.env[name];

  if (!value || value.trim() === '') {
    throw new Error(`Missing required configuration: ${name}`);
  }

  return value.trim();
}

function integerInRange(name, value, minimum, maximum) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`Invalid configuration: ${name}`);
  }

  return parsed;
}

function booleanValue(name, value, defaultValue) {
  if (value === undefined || value === '') {
    return defaultValue;
  }

  if (value !== 'true' && value !== 'false') {
    throw new Error(`Invalid configuration: ${name}`);
  }

  return value === 'true';
}

function frontendOriginValue(nodeEnv) {
  const configuredOrigin = process.env.FRONTEND_ORIGIN;
  const origin = configuredOrigin && configuredOrigin.trim() !== ''
    ? configuredOrigin.trim()
    : nodeEnv === 'production'
      ? null
      : 'http://127.0.0.1:5501';

  if (!origin) {
    throw new Error('Missing required configuration: FRONTEND_ORIGIN');
  }

  let parsedOrigin;

  try {
    parsedOrigin = new URL(origin);
  } catch {
    throw new Error('Invalid configuration: FRONTEND_ORIGIN');
  }

  if (
    !['http:', 'https:'].includes(parsedOrigin.protocol) ||
    parsedOrigin.pathname !== '/' ||
    parsedOrigin.search !== '' ||
    parsedOrigin.hash !== ''
  ) {
    throw new Error('Invalid configuration: FRONTEND_ORIGIN');
  }

  return parsedOrigin.origin;
}

function loadEnvironment() {
  const nodeEnv = process.env.NODE_ENV && process.env.NODE_ENV.trim();

  if (!nodeEnv) {
    throw new Error('Missing required configuration: NODE_ENV');
  }

  const port = integerInRange('PORT', process.env.PORT || '3000', 1, 65535);
  const databaseName = requiredString('PGDATABASE');

  if (databaseName !== 'nandedconnect_dev') {
    throw new Error('Invalid configuration: PGDATABASE must be nandedconnect_dev');
  }

  if (!['development', 'test', 'production'].includes(nodeEnv)) {
    throw new Error('Invalid configuration: NODE_ENV');
  }

  const ssl = booleanValue('PGSSL', process.env.PGSSL, false);

  if (nodeEnv === 'production' && process.env.PGSSL !== 'true') {
    throw new Error('Invalid configuration: PGSSL must be true in production');
  }

  return Object.freeze({
    nodeEnv,
    port,
    frontendOrigin: frontendOriginValue(nodeEnv),
    database: Object.freeze({
      host: requiredString('PGHOST'),
      port: integerInRange('PGPORT', process.env.PGPORT || '5432', 1, 65535),
      database: databaseName,
      user: requiredString('PGUSER'),
      password: requiredString('PGPASSWORD'),
      ssl
    })
  });
}

module.exports = {
  loadEnvironment
};
