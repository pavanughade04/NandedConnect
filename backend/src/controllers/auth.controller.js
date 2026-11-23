'use strict';

const authService = require('../services/auth.service');
const {
  setSessionCookie,
  clearSessionCookie
} = require('../security/cookies');

const SESSION_MAX_AGE = 7 * 24 * 60 * 60;

async function signup(req, res, next) {
  try {
    const result = await authService.signup(req.body || {});

    if (result.error) {
      return res.status(400).json({
        error: result.error
      });
    }

    return res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

async function verifyEmail(req, res, next) {
  try {
    const result = await authService.verifyEmail(
      req.body?.token
    );

    if (result.error) {
      return res.status(400).json({
        error: result.error
      });
    }

    return res.status(200).json({
      success: true
    });
  } catch (error) {
    next(error);
  }
}

async function login(req, res, next) {
  try {
    const result = await authService.login(req.body || {});

    if (result.error) {
      return res.status(401).json({
        error: 'invalid_credentials'
      });
    }

    setSessionCookie(
      res,
      result.sessionToken,
      SESSION_MAX_AGE
    );

    return res.status(200).json({
      success: true
    });
  } catch (error) {
    next(error);
  }
}

async function logout(req, res, next) {
  try {
    await authService.logout({
      sessionId: req.auth.sessionId,
      userId: req.auth.userId
    });

    clearSessionCookie(res);

    return res.status(200).json({
      success: true
    });
  } catch (error) {
    next(error);
  }
}

async function me(req, res) {
  return res.status(200).json({
    authenticated: true,
    user: {
      id: req.auth.userId,
      email: req.auth.email
    }
  });
}

module.exports = {
  signup,
  verifyEmail,
  login,
  logout,
  me
};
