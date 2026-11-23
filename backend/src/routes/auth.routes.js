'use strict';

const express = require('express');
const authController = require('../controllers/auth.controller');
const { requireAuth } = require('../middleware/auth');
const {
  signupLimiter,
  loginLimiter,
  verificationLimiter
} = require('../middleware/auth-rate-limit');

const router = express.Router();

router.post('/auth/signup', signupLimiter, authController.signup);
router.post('/auth/verify-email', verificationLimiter, authController.verifyEmail);
router.post('/auth/login', loginLimiter, authController.login);
router.post('/auth/logout', requireAuth, authController.logout);
router.get('/auth/me', requireAuth, authController.me);

module.exports = router;
