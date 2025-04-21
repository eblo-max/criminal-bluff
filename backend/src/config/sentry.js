/**
 * Конфигурация Sentry для мониторинга ошибок
 */
const Sentry = require('@sentry/node');
const { CaptureConsole } = require('@sentry/integrations');
const { ProfilingIntegration } = require('@sentry/profiling-node');
const { nodeProfilingIntegration } = require('@sentry/profiling-node');
const logger = require('../utils/logger');

/**
 * Инициализация Sentry
 * @param {Object} app - Express приложение
 */
const initSentry = (app) => {
  // Проверяем наличие DSN
  const dsn = process.env.SENTRY_DSN;
  
  if (!dsn) {
    logger.warn('SENTRY_DSN не задан в переменных окружения. Мониторинг ошибок Sentry отключен.');
    return false;
  }
  
  try {
    // Инициализация Sentry
    Sentry.init({
      dsn: dsn,
      environment: process.env.NODE_ENV || 'development',
      integrations: [
        // Включаем трассировку Express
        new Sentry.Integrations.Http({ tracing: true }),
        new Tracing.Integrations.Express({ app }),
        // Enable console capturing integration
        new CaptureConsole({
          levels: ['error']
        }),
        // Enable profiling integration
        nodeProfilingIntegration(),
        new ProfilingIntegration(),
      ],
      
      // Настраиваем уровень трассировки
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,
      
      // Максимальная длина значений объектов
      maxValueLength: 1000,
      
      // Настройки для бэкенда
      serverName: 'criminal-bluff-api',
      release: process.env.npm_package_version || '1.0.0',
      
      // Исключаем чувствительные данные
      beforeSend(event) {
        // Удаляем потенциально конфиденциальные данные
        if (event.request && event.request.headers) {
          delete event.request.headers.authorization;
          delete event.request.headers.cookie;
        }
        return event;
      }
    });
    
    logger.info('Sentry успешно инициализирован');
    return true;
  } catch (error) {
    logger.error(`Ошибка инициализации Sentry: ${error.message}`);
    return false;
  }
};

/**
 * Middleware для запроса Sentry
 * @returns {Array} - Массив middleware для Express
 */
const sentryMiddleware = (app) => {
  const dsn = process.env.SENTRY_DSN;
  
  if (!dsn) {
    return [];
  }
  
  return [
    // Обработчики запроса
    Sentry.Handlers.requestHandler(),
    
    // Трассировка
    Sentry.Handlers.tracingHandler(),
  ];
};

/**
 * Middleware для обработки ошибок Sentry
 * @returns {Function} - Middleware для обработки ошибок
 */
const sentryErrorHandler = () => {
  const dsn = process.env.SENTRY_DSN;
  
  if (!dsn) {
    return (err, req, res, next) => next(err);
  }
  
  return Sentry.Handlers.errorHandler({
    shouldHandleError(error) {
      // Отправляем в Sentry только серьезные ошибки (коды >= 500)
      // или явно помеченные для отправки
      return error.status >= 500 || error.sendToSentry === true;
    }
  });
};

/**
 * Отправка ошибки в Sentry
 * @param {Error} error - Объект ошибки
 * @param {Object} [additionalData={}] - Дополнительные данные для контекста
 * @param {String} [level='error'] - Уровень ошибки ('error', 'warning', 'info')
 */
const captureException = (error, additionalData = {}, level = 'error') => {
  const dsn = process.env.SENTRY_DSN;
  
  if (!dsn) {
    logger.error(`Error (not sent to Sentry): ${error.message}`, { error });
    return;
  }
  
  try {
    // Добавляем дополнительный контекст
    Sentry.configureScope((scope) => {
      // Устанавливаем уровень
      scope.setLevel(level);
      
      // Добавляем тэги и контекст
      if (additionalData.tags) {
        Object.entries(additionalData.tags).forEach(([key, value]) => {
          scope.setTag(key, value);
        });
      }
      
      if (additionalData.user) {
        scope.setUser(additionalData.user);
      }
      
      if (additionalData.extra) {
        Object.entries(additionalData.extra).forEach(([key, value]) => {
          scope.setExtra(key, value);
        });
      }
    });
    
    // Отправляем ошибку
    Sentry.captureException(error);
  } catch (captureError) {
    logger.error(`Ошибка при отправке исключения в Sentry: ${captureError.message}`);
  }
};

/**
 * Начать транзакцию для отслеживания производительности
 * @param {Object} options - Опции транзакции
 * @param {string} options.op - Тип операции
 * @param {string} options.name - Название транзакции
 * @param {Object} [options.data={}] - Дополнительные данные транзакции
 * @param {Object} [options.tags] - Tags to associate with the transaction
 * @returns {Object} - Объект транзакции
 */
const startTransaction = (options) => {
  const dsn = process.env.SENTRY_DSN;
  
  if (!dsn) {
    // Если Sentry не настроен, возвращаем заглушку
    return {
      finish: () => {},
      setStatus: () => {},
      setData: () => {},
      setTag: () => {}
    };
  }
  
  try {
    const transaction = Sentry.startTransaction({
      op: options.op || 'default',
      name: options.name || 'unnamed',
      data: options.data || {},
      tags: options.tags || {}
    });
    
    // Set transaction on the scope
    Sentry.getCurrentHub().configureScope(scope => {
      scope.setSpan(transaction);
    });
    
    return transaction;
  } catch (error) {
    logger.error(`Ошибка при создании транзакции Sentry: ${error.message}`);
    
    // Возвращаем заглушку в случае ошибки
    return {
      finish: () => {},
      setStatus: () => {},
      setData: () => {},
      setTag: () => {}
    };
  }
};

/**
 * Отправка сообщения в Sentry
 * @param {String} message - Сообщение
 * @param {String} [level='info'] - Уровень сообщения ('error', 'warning', 'info')
 * @param {Object} [additionalData={}] - Дополнительные данные для контекста
 */
const captureMessage = (message, level = 'info', additionalData = {}) => {
  const dsn = process.env.SENTRY_DSN;
  
  if (!dsn) {
    return;
  }
  
  try {
    // Добавляем дополнительный контекст
    Sentry.configureScope((scope) => {
      // Устанавливаем уровень
      scope.setLevel(level);
      
      // Добавляем тэги и контекст
      if (additionalData.tags) {
        Object.entries(additionalData.tags).forEach(([key, value]) => {
          scope.setTag(key, value);
        });
      }
      
      if (additionalData.user) {
        scope.setUser(additionalData.user);
      }
      
      if (additionalData.extra) {
        Object.entries(additionalData.extra).forEach(([key, value]) => {
          scope.setExtra(key, value);
        });
      }
    });
    
    // Отправляем сообщение
    Sentry.captureMessage(message, level);
  } catch (captureError) {
    logger.error(`Ошибка при отправке сообщения в Sentry: ${captureError.message}`);
  }
};

module.exports = {
  initSentry,
  sentryMiddleware,
  sentryErrorHandler,
  captureException,
  captureMessage,
  startTransaction,
  Sentry
}; 