class AppError extends Error {
  constructor(message, statusCode, errorCode) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message, details = []) {
    super(message, 400, 'VALIDATION_ERROR');
    this.details = details;
  }
}

class ResourceNotFoundError extends AppError {
  constructor(resource, id) {
    super(`${resource} с ID ${id} не найден`, 404, 'RESOURCE_NOT_FOUND');
    this.resource = resource;
    this.resourceId = id;
  }
}

class GameLogicError extends AppError {
  constructor(message) {
    super(message, 400, 'GAME_LOGIC_ERROR');
  }
}

class AuthorizationError extends AppError {
  constructor(message = 'Недостаточно прав для выполнения операции') {
    super(message, 403, 'AUTHORIZATION_ERROR');
  }
}

class DatabaseError extends AppError {
  constructor(message, originalError) {
    super(message, 500, 'DATABASE_ERROR');
    this.originalError = originalError;
  }
}

module.exports = {
  AppError,
  ValidationError,
  ResourceNotFoundError,
  GameLogicError,
  AuthorizationError,
  DatabaseError
}; 