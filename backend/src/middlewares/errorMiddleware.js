const logger = require('../utils/logger');

class AppError extends Error {
  constructor(message, statusCode = 500, errors = []) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Обертка для асинхронных функций
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

const errorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  // Логируем ошибку
  if (err.statusCode === 500) {
    logger.error(`${err.name}: ${err.message}\n${err.stack}`);
  } else {
    logger.warn(`${err.statusCode} - ${err.message}`);
  }

  // В режиме разработки отправляем полную информацию об ошибке
  if (process.env.NODE_ENV === 'development') {
    return res.status(err.statusCode).json({
      success: false,
      status: err.status,
      error: err,
      message: err.message,
      errors: err.errors,
      stack: err.stack
    });
  }

  // В продакшене отправляем только нужную информацию
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      success: false,
      status: err.status,
      message: err.message,
      errors: err.errors
    });
  }

  // Для неизвестных ошибок отправляем общее сообщение
  return res.status(500).json({
    success: false,
    status: 'error',
    message: 'Что-то пошло не так'
  });
};

module.exports = {
  AppError,
  asyncHandler,
  errorHandler
}; 