'use strict';

const { loadEnvironment } = require('./config/env');
const { createApp } = require('./app');
const { initializeAuthSecurity } = require('./services/auth.service');

async function startServer() {
  const environment = loadEnvironment();
  await initializeAuthSecurity();
  const app = createApp();
  const server = app.listen(environment.port, () => {
    console.log(`NandedConnect API listening on port ${environment.port}`);
  });

  server.on('error', () => {
    console.error('NandedConnect API failed to start');
    process.exitCode = 1;
  });

  return server;
}

startServer().catch((error) => {
  console.error('NandedConnect API configuration is invalid');
  process.exitCode = 1;
});
