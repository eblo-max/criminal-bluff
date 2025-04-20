/**
 * Authentication middleware for Telegram Mini App
 * Verifies Telegram initData for security
 */
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { User } = require('../models');
const logger = require('../utils/logger');

/**
 * Verify the Telegram WebApp initData
 * @param {string} initData - The raw initData string from Telegram WebApp
 * @returns {boolean} - Whether the initData is valid
 */
const verifyTelegramWebAppData = (initData) => {
  try {
    // In development mode, we can skip verification
    if (process.env.NODE_ENV === 'development' && process.env.SKIP_TELEGRAM_AUTH === 'true') {
      return true;
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      logger.error('TELEGRAM_BOT_TOKEN is not set');
      return false;
    }

    // Parse init data string
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    params.delete('hash');

    // Sort parameters
    const paramsList = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    // Generate secret key
    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(botToken)
      .digest();

    // Calculate expected hash
    const expectedHash = crypto
      .createHmac('sha256', secretKey)
      .update(paramsList)
      .digest('hex');

    // Verify hash
    return hash === expectedHash;
  } catch (error) {
    logger.error(`Error verifying Telegram data: ${error.message}`);
    return false;
  }
};

/**
 * Authentication middleware
 */
const authMiddleware = async (req, res, next) => {
  try {
    // Check for Authorization header
    const token = req.headers.authorization?.split(' ')[1];
    // Or check for initData from Telegram
    const initData = req.headers['telegram-data'] || req.body.initData;

    // If no token or initData is provided
    if (!token && !initData) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please provide valid credentials.'
      });
    }

    // If JWT token is provided
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Find user
        const user = await User.findOne({ telegramId: decoded.telegramId });
        if (!user) {
          return res.status(401).json({
            success: false,
            message: 'User not found.'
          });
        }
        
        // Attach user to request
        req.user = user;
        return next();
      } catch (error) {
        return res.status(401).json({
          success: false,
          message: 'Invalid or expired token.'
        });
      }
    }

    // If Telegram initData is provided
    if (initData) {
      // Verify Telegram data
      const isValid = verifyTelegramWebAppData(initData);
      if (!isValid) {
        return res.status(401).json({
          success: false,
          message: 'Invalid Telegram data.'
        });
      }

      // Parse user data from initData
      const params = new URLSearchParams(initData);
      const user = JSON.parse(params.get('user') || '{}');
      
      if (!user.id) {
        return res.status(401).json({
          success: false,
          message: 'User ID not found in Telegram data.'
        });
      }

      // Find or create user
      const dbUser = await User.findOne({ telegramId: user.id });
      if (!dbUser) {
        return res.status(401).json({
          success: false,
          message: 'User not found. Please create a profile first.'
        });
      }

      // Attach user to request
      req.user = dbUser;
      
      // Generate JWT token for further requests
      const token = jwt.sign(
        { telegramId: user.id },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRATION || '1d' }
      );
      
      // Add token to response header
      res.setHeader('X-Auth-Token', token);
      
      return next();
    }
  } catch (error) {
    logger.error(`Auth error: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Authentication error. Please try again.'
    });
  }
};

module.exports = authMiddleware; 