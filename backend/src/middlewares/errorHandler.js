/**
 * Global error handling middleware
 */
const logger = require('../utils/logger');

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
  logger.error(`${statusCode} - ${message} - ${req.originalUrl} - ${req.method} - ${req.ip}`);
  if (err.stack) {
    logger.error(err.stack);
  }

  // Send response
  res.status(statusCode).json(errorResponse(statusCode, message, err.stack));
};

// Export error handler
module.exports = errorHandler; 