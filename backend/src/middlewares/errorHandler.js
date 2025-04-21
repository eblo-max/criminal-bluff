/**
 * Global error handling middleware
 */
const logger = require('../utils/logger');
const { captureException } = require('../config/sentry');

/**
 * Error response structure
 * @param {number} statusCode - HTTP status code
 * @param {string} message - Error message
 * @param {string} stack - Error stack trace (only in development)
 * @returns {Object} Structured error response
 */
const errorResponse = (statusCode, message, stack) => {
  const response = {
    success: false,
    status: statusCode,
    message
  };

  // Add stack trace only in development
  if (process.env.NODE_ENV === 'development' && stack) {
    response.stack = stack;
  }

  return response;
};

/**
 * Global error handling middleware
 */
const errorHandler = (err, req, res, next) => {
  // Default to 500 if no status is specified
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Server Error';

  // Log the error
  const errorLogMessage = `${statusCode} - ${message} - ${req.originalUrl} - ${req.method} - ${req.ip}`;
  if (statusCode >= 500) {
    logger.error(errorLogMessage);
    if (err.stack) {
      logger.error(err.stack);
    }
    
    // Отправляем ошибку в Sentry для серьезных ошибок
    captureException(err, {
      tags: {
        method: req.method,
        url: req.originalUrl
      },
      user: req.user ? {
        id: req.user._id,
        telegramId: req.user.telegramId,
        username: req.user.username
      } : undefined,
      extra: {
        query: req.query,
        params: req.params,
        // Не отправляем тело запроса, так как оно может содержать чувствительные данные
        // body: req.body 
      }
    });
  } else {
    // Для ошибок клиента просто логируем
    logger.warn(errorLogMessage);
  }

  // Send response
  res.status(statusCode).json(errorResponse(statusCode, message, err.stack));
};

// Export error handler
module.exports = errorHandler; 