/**
 * Конфигурация Sentry для мониторинга ошибок
 * Этот файл содержит все необходимые функции для работы с Sentry
 */
const Sentry = require('@sentry/node');
const { CaptureConsole } = require('@sentry/integrations');
const logger = require('../utils/logger');

// Попытка загрузки интеграции профилирования с обработкой ошибок
let ProfilingIntegration;
try {
  // Пытаемся динамически импортировать модуль профилирования
  ProfilingIntegration = require('@sentry/profiling-node').ProfilingIntegration;
  logger.info('Sentry профилирование успешно загружено');
} catch (error) {
  logger.warn(`Не удалось загрузить модуль профилирования Sentry: ${error.message}`);
  ProfilingIntegration = null;
}

/**
 * Инициализация Sentry
 * @param {Object} app - Express приложение
 * @returns {Boolean} - Результат инициализации
 */
const initSentry = (app) => {
  // Проверяем наличие DSN
  const dsn = process.env.SENTRY_DSN;
  
  if (!dsn) {
    logger.warn('SENTRY_DSN не задан в переменных окружения. Мониторинг ошибок Sentry отключен.');
    return false;
  }
  
  try {
    // Формируем массив интеграций для Sentry
    const integrations = [
      // Включаем захват сообщений консоли
      new CaptureConsole({
        levels: ['error', 'warn']
      })
    ];
    
    // Добавляем профилирование только если оно доступно
    if (ProfilingIntegration) {
      try {
        integrations.push(new ProfilingIntegration());
        logger.info('Sentry профилирование активировано');
      } catch (e) {
        logger.warn(`Не удалось активировать профилирование Sentry: ${e.message}`);
      }
    }

    // Инициализация Sentry
    Sentry.init({
      dsn: dsn,
      environment: process.env.NODE_ENV || 'development',
      integrations: integrations,
      
      // Настраиваем уровень трассировки и профилирования
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,
      profilesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0.5,
      
      // Максимальная длина значений объектов
      maxValueLength: 1000,
      
      // Настройки для бэкенда
      serverName: process.env.APP_NAME || 'backend-api',
      release: process.env.npm_package_version || '1.0.0',
      
      // Исключаем чувствительные данные
      beforeSend(event, hint) {
        const error = hint && hint.originalException;
        
        // Добавляем информацию о типе ошибки
        if (error && error.name) {
          event.tags = event.tags || {};
          event.tags.error_type = error.name;
        }
        
        // Удаляем потенциально конфиденциальные данные
        if (event.request && event.request.headers) {
          delete event.request.headers.authorization;
          delete event.request.headers.cookie;
          
          // Очищаем JWT токены
          if (event.request.headers['x-auth-token']) {
            event.request.headers['x-auth-token'] = '[REDACTED]';
          }
          
          // Очищаем initData Telegram
          if (event.request.headers['telegram-data'] || event.request.headers['x-telegram-init-data']) {
            event.request.headers['telegram-data'] = '[REDACTED]';
            event.request.headers['x-telegram-init-data'] = '[REDACTED]';
          }
        }

        // Удаляем чувствительные данные из тела запроса
        if (event.request && event.request.data) {
          const sensitiveFields = ['password', 'token', 'secret', 'initData', 'auth_date', 'hash'];
          sensitiveFields.forEach(field => {
            if (event.request.data[field]) {
              event.request.data[field] = '[REDACTED]';
            }
          });
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
    // Возвращаем массив с заглушкой middleware
    return [(req, res, next) => next()];
  }
  
  try {
    // В Sentry v7 корректный способ использования requestHandler
    return [Sentry.Handlers.requestHandler({
      // Включаем обработку ошибок в middleware
      serverName: process.env.APP_NAME || 'backend-api',
      // Другие опции по необходимости
      ip: true,
      request: ['headers', 'method', 'url', 'query_string'],
      user: ['id', 'username', 'ip_address']
    })];
  } catch (error) {
    logger.error(`Ошибка при создании Sentry middleware: ${error.message}`);
    return [(req, res, next) => next()];
  }
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
  
  try {
    return Sentry.Handlers.errorHandler();
  } catch (error) {
    logger.error(`Ошибка при создании Sentry error handler: ${error.message}`);
    return (err, req, res, next) => next(err);
  }
};

/**
 * Отправка ошибки в Sentry
 * @param {Error} error - Объект ошибки
 * @param {Object} [options={}] - Дополнительные опции
 * @param {Object} [options.tags={}] - Теги для категоризации ошибки
 * @param {Object} [options.user=null] - Информация о пользователе
 * @param {Object} [options.extra={}] - Дополнительные данные
 * @param {String} [options.level='error'] - Уровень ошибки ('error', 'warning', 'info')
 */
const captureException = (error, { tags = {}, user = null, extra = {}, level = 'error' } = {}) => {
  if (!process.env.SENTRY_DSN) {
    console.error('Error captured but Sentry is not configured:', error);
    return;
  }

  try {
    // Set scope for this specific exception
    Sentry.withScope(scope => {
      // Add user context if available
      if (user) {
        scope.setUser(user);
      }

      // Add additional tags
      Object.entries(tags).forEach(([key, value]) => {
        scope.setTag(key, value);
      });

      // In Sentry 7.x, extra data should be added as contexts
      if (Object.keys(extra).length > 0) {
        scope.setContext('additional', extra);
      }

      // Set error level
      scope.setLevel(level);

      // Send to Sentry
      Sentry.captureException(error);
    });
  } catch (captureError) {
    console.error('Failed to send error to Sentry:', captureError);
    console.error('Original error:', error);
  }
};

/**
 * Отправка сообщения в Sentry
 * @param {String} message - Сообщение
 * @param {Object} [options={}] - Дополнительные опции
 * @param {Object} [options.tags={}] - Теги для категоризации сообщения
 * @param {Object} [options.user=null] - Информация о пользователе
 * @param {Object} [options.extra={}] - Дополнительные данные
 * @param {String} [options.level='info'] - Уровень сообщения ('error', 'warning', 'info')
 */
const captureMessage = (message, { tags = {}, user = null, extra = {}, level = 'info' } = {}) => {
  if (!process.env.SENTRY_DSN) {
    console.log(`Message captured but Sentry is not configured: [${level}] ${message}`);
    return;
  }

  try {
    // Set scope for this specific message
    Sentry.withScope(scope => {
      // Add user context if available
      if (user) {
        scope.setUser(user);
      }

      // Add additional tags
      Object.entries(tags).forEach(([key, value]) => {
        scope.setTag(key, value);
      });

      // In Sentry 7.x, extra data should be added as contexts
      if (Object.keys(extra).length > 0) {
        scope.setContext('additional', extra);
      }

      // Set level
      scope.setLevel(level);

      // Send to Sentry
      Sentry.captureMessage(message);
    });
  } catch (captureError) {
    console.error('Failed to send message to Sentry:', captureError);
    console.error('Original message:', message);
  }
};

/**
 * Добавляет тестовый маршрут для проверки отправки ошибок в Sentry
 * @param {Object} app - Express приложение
 */
const addSentryTestRoute = (app) => {
  // Добавляем только в режиме разработки или если явно указана переменная окружения
  if (process.env.NODE_ENV !== 'production' || process.env.ENABLE_SENTRY_TEST_ROUTE === 'true') {
    app.get('/debug-sentry', function mainHandler(req, res) {
      // Тест отправки ошибки в Sentry
      try {
        throw new Error('Тестовая ошибка для Sentry');
      } catch (e) {
        console.error('Перехваченная тестовая ошибка:', e);
        
        // Отправляем ошибку в Sentry
        captureException(e, {
          tags: {
            source: 'debug-sentry-route',
            test_case: 'manual-error'
          },
          extra: {
            test_info: 'Ручная проверка интеграции с Sentry',
            timestamp: new Date().toISOString()
          }
        });
        
        res.status(200).json({
          message: 'Тестовая ошибка отправлена в Sentry. Проверьте дашборд.',
          error: e.message,
          stack: process.env.NODE_ENV === 'development' ? e.stack : undefined
        });
      }
    });
    
    app.get('/debug-sentry-message', function messageHandler(req, res) {
      // Тест отправки сообщения в Sentry
      const message = 'Тестовое сообщение для Sentry';
      
      captureMessage(message, {
        level: 'info',
        tags: {
          source: 'debug-sentry-route',
          test_case: 'manual-message'
        },
        extra: {
          test_info: 'Ручная проверка отправки сообщений в Sentry',
          timestamp: new Date().toISOString()
        }
      });
      
      res.status(200).json({
        message: 'Тестовое сообщение отправлено в Sentry. Проверьте дашборд.',
        sent_message: message
      });
    });
    
    logger.info('Добавлен тестовый маршрут для Sentry: /debug-sentry и /debug-sentry-message');
  }
};

// Экспортируем Sentry и вспомогательные функции
module.exports = {
  Sentry,
  initSentry,
  sentryMiddleware,
  sentryErrorHandler,
  captureException,
  captureMessage,
  addSentryTestRoute
}; 