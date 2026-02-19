/**
 * Rate limiting middleware using express-rate-limit.
 * Separate limiters for different endpoint categories.
 */
const rateLimit = require('express-rate-limit');

// General API: 60 requests per minute per IP
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' }
});

// Auth endpoints: 10 requests per minute per IP
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many auth requests, please try again later' }
});

// Webhook endpoint: 30 requests per minute (Mayar sends bursts)
const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many webhook requests' }
});

// Checkout: 5 per minute per IP (prevent abuse)
const checkoutLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many checkout requests, please wait' }
});

// Chat: 15 messages per minute per IP
const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many chat messages, please wait a moment' }
});

module.exports = { apiLimiter, authLimiter, webhookLimiter, checkoutLimiter, chatLimiter };
