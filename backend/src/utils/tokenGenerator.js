/**
 * Утилита для генерации и проверки JWT токенов
 */
const jwt = require('jsonwebtoken');
const logger = require('./logger');

/**
 * Генерирует JWT токен для пользователя
 * @param {Object} user - объект пользователя
 * @returns {string} JWT токен
 */
const generateToken = (user) => {
  try {
    return jwt.sign(
      { 
        userId: user._id,
        telegramId: user.telegramId,
        username: user.username
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
  } catch (error) {
    logger.error(`Error generating token: ${error.message}`);
    throw error;
  }
};

/**
 * Верифицирует JWT токен
 * @param {string} token - JWT токен
 * @returns {Object} декодированные данные токена
 */
const verifyToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    logger.error(`Error verifying token: ${error.message}`);
    throw error;
  }
};

module.exports = {
  generateToken,
  verifyToken
}; 