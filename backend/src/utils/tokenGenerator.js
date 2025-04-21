/**
 * Утилита для генерации и проверки JWT токенов
 */
const jwt = require('jsonwebtoken');
const logger = require('./logger');

/**
 * Генерирует JWT токен для пользователя
 * @param {Object} user - Данные пользователя
 * @returns {String} - JWT токен
 */
const generateToken = (user) => {
  try {
    const payload = {
      id: user._id || user.id,
      telegramId: user.telegramId,
      isAdmin: user.isAdmin || false
    };

    const token = jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    return token;
  } catch (error) {
    logger.error(`Error generating token: ${error.message}`);
    throw new Error('Error generating authentication token');
  }
};

/**
 * Проверяет и декодирует JWT токен
 * @param {String} token - JWT токен
 * @returns {Object} - Декодированные данные пользователя
 */
const verifyToken = (token) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded;
  } catch (error) {
    logger.error(`Error verifying token: ${error.message}`);
    throw new Error('Invalid or expired token');
  }
};

module.exports = {
  generateToken,
  verifyToken
}; 