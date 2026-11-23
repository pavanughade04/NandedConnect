'use strict';

const express = require('express');
const { pool } = require('../db/pool');

const router = express.Router();

const ERROR_CATEGORIES = new Map([
  ['28P01', 'authentication_failed'],
  ['28000', 'authentication_failed'],
  ['3D000', 'database_not_found'],
  ['ECONNREFUSED', 'connection_refused'],
  ['ENOTFOUND', 'host_unreachable'],
  ['EAI_AGAIN', 'host_unreachable'],
  ['EHOSTUNREACH', 'host_unreachable'],
  ['ENETUNREACH', 'host_unreachable'],
  ['ETIMEDOUT', 'host_unreachable'],
  ['DEPTH_ZERO_SELF_SIGNED_CERT', 'ssl_error'],
  ['UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'ssl_error'],
  ['ERR_TLS_CERT_ALTNAME_INVALID', 'ssl_error'],
  ['ERR_TLS_CERT_UNKNOWN', 'ssl_error'],
  ['ERR_SSL_WRONG_VERSION_NUMBER', 'ssl_error'],
  ['08001', 'query_error'],
  ['08003', 'query_error'],
  ['08004', 'query_error'],
  ['08006', 'query_error'],
  ['08007', 'query_error'],
  ['08P01', 'query_error'],
  ['57P01', 'query_error'],
  ['57P02', 'query_error'],
  ['57P03', 'query_error']
]);

function classifyReadinessError(error) {
  return ERROR_CATEGORIES.get(error && error.code) || 'unknown_database_error';
}

router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'nandedconnect-api'
  });
});

router.get('/health/ready', async (req, res) => {
  try {
    await pool.query('SELECT 1');

    res.status(200).json({
      status: 'ready',
      service: 'nandedconnect-api'
    });
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Database readiness check failed', {
        category: classifyReadinessError(error)
      });
    }

    res.status(503).json({
      status: 'unavailable',
      service: 'nandedconnect-api'
    });
  }
});

module.exports = router;
