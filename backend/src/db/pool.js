'use strict';

const { Pool } = require('pg');
const { loadEnvironment } = require('../config/env');

const environment = loadEnvironment();

// Constructing a Pool does not connect or execute a query. Connections are
// created only when a future service explicitly checks one out.
const pool = new Pool({
  host: environment.database.host,
  port: environment.database.port,
  database: environment.database.database,
  user: environment.database.user,
  password: environment.database.password,
  ssl: environment.database.ssl ? { rejectUnauthorized: true } : false
});

module.exports = {
  pool
};
