
'use strict';

const express = require('express');
const helmet = require('helmet');
const { loadEnvironment } = require('./config/env');
const healthRoutes = require('./routes/health.routes');
const authRoutes = require('./routes/auth.routes');

function isStateChangingAuthRequest(req) {
  return req.path.startsWith('/auth/') && !['GET', 'HEAD', 'OPTIONS'].includes(req.method);
}

function originFromReferer(referer) {
  try {
    return new URL(referer).origin;
  } catch {
    return null;
  }
}

function requestOriginIsTrusted(req, trustedOrigin) {
  const origin = req.headers.origin;
  const referer = req.headers.referer;

  if (origin && origin !== trustedOrigin) {
    return false;
  }

  if (referer && originFromReferer(referer) !== trustedOrigin) {
    return false;
  }

  return true;
}

function createApp() {
  const app = express();
  const environment = loadEnvironment();

  app.disable('x-powered-by');
  app.use(helmet());

  app.use((req, res, next) => {
    const origin = req.headers.origin;

    if (
      isStateChangingAuthRequest(req) &&
      !requestOriginIsTrusted(req, environment.frontendOrigin)
    ) {
      return res.status(403).json({ error: 'untrusted_origin' });
    }

    if (origin === environment.frontendOrigin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Vary', 'Origin');
    }

    if (req.method === 'OPTIONS') {
      if (origin !== environment.frontendOrigin) {
        return res.sendStatus(403);
      }

      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader(
        'Access-Control-Allow-Headers',
        'Content-Type'
      );

      return res.sendStatus(204);
    }

    next();
  });

  app.use(express.json({ limit: '100kb' }));
  app.use(healthRoutes);
  app.use(authRoutes);

  app.use((req, res) => {
    res.status(404).json({ error: 'not_found' });
  });

  app.use((error, req, res, next) => {
    const status = error.type === 'entity.parse.failed' ? 400 : 500;

    console.error('Request handling error', { status });

    res.status(status).json({
      error: status === 400 ? 'invalid_request' : 'internal_error'
    });
  });

  return app;
}

module.exports = {
  createApp
};
