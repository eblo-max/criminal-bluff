/**
 * ErrorService - Сервис для обработки и мониторинга ошибок
 */
import * as Sentry from '@sentry/browser';
import { Integrations } from '@sentry/tracing';

class ErrorService {
  /**
   * Конструктор сервиса ошибок
   */
  constructor() {
    this.isInitialized = false;
    this.sentryDsn = process.env.SENTRY_DSN || '';
    this.environment = process.env.NODE_ENV || 'development';
    this.version = process.env.APP_VERSION || '1.0.0';
  }

  /**
   * Инициализация сервиса
   * @param {Object} telegramUser - Информация о пользователе Telegram (опционально)
   */
  init(telegramUser = null) {
    // Если DSN не указан или сервис уже инициализирован, выходим
    if (!this.sentryDsn || this.isInitialized) {
      return false;
    }

    try {
      // Инициализация Sentry
      Sentry.init({
        dsn: this.sentryDsn,
        integrations: [new Integrations.BrowserTracing()],
        tracesSampleRate: this.environment === 'production' ? 0.1 : 1.0,
        environment: this.environment,
        release: this.version,
        
        // Фильтрация неважных ошибок
        beforeSend(event) {
          // Игнорируем ошибки CORS и ошибки от расширений браузера
          if (event.message && (
            event.message.includes('Cross-Origin Request Blocked') ||
            event.message.includes('Extension') ||
            event.message.includes('ResizeObserver loop')
          )) {
            return null;
          }
          
          // Исключаем некоторые URL из трассировки
          if (event.request && event.request.url) {
            const url = event.request.url;
            if (url.includes('chrome-extension://') || 
                url.includes('moz-extension://')) {
              return null;
            }
          }
          
          return event;
        }
      });
      
      // Если передан пользователь Telegram, устанавливаем контекст пользователя
      if (telegramUser) {
        this.setUser(telegramUser);
      }
      
      this.isInitialized = true;
      console.log('Sentry initialized successfully');
      return true;
    } catch (error) {
      console.error('Error initializing Sentry:', error);
      return false;
    }
  }
  
  /**
   * Установка информации о пользователе
   * @param {Object} user - Информация о пользователе
   */
  setUser(user) {
    if (!this.isInitialized || !user) {
      return;
    }
    
    try {
      Sentry.setUser({
        id: user.telegramId || user.id,
        username: user.username,
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim()
      });
    } catch (error) {
      console.error('Error setting user context:', error);
    }
  }
  
  /**
   * Очистка информации о пользователе
   */
  clearUser() {
    if (!this.isInitialized) {
      return;
    }
    
    try {
      Sentry.setUser(null);
    } catch (error) {
      console.error('Error clearing user context:', error);
    }
  }
  
  /**
   * Отправка ошибки в Sentry
   * @param {Error} error - Объект ошибки
   * @param {Object} [additionalData={}] - Дополнительная информация
   */
  captureException(error, additionalData = {}) {
    if (!this.isInitialized) {
      console.error(error);
      return;
    }
    
    try {
      Sentry.withScope(scope => {
        // Добавляем дополнительную информацию
        if (additionalData.tags) {
          Object.entries(additionalData.tags).forEach(([key, value]) => {
            scope.setTag(key, value);
          });
        }
        
        if (additionalData.extra) {
          Object.entries(additionalData.extra).forEach(([key, value]) => {
            scope.setExtra(key, value);
          });
        }
        
        if (additionalData.level) {
          scope.setLevel(additionalData.level);
        }
        
        // Отправляем ошибку
        Sentry.captureException(error);
      });
    } catch (captureError) {
      console.error('Error sending exception to Sentry:', captureError);
      console.error('Original error:', error);
    }
  }
  
  /**
   * Отправка сообщения в Sentry
   * @param {String} message - Текст сообщения
   * @param {String} [level='info'] - Уровень сообщения ('info', 'warning', 'error')
   */
  captureMessage(message, level = 'info') {
    if (!this.isInitialized) {
      console.log(message);
      return;
    }
    
    try {
      Sentry.captureMessage(message, level);
    } catch (error) {
      console.error('Error sending message to Sentry:', error);
    }
  }
  
  /**
   * Создание и возврат транзакции
   * @param {Object} options - Параметры транзакции
   * @param {String} options.name - Имя транзакции
   * @param {String} options.op - Тип операции
   * @param {Object} [options.data={}] - Дополнительные данные
   * @returns {Object|null} - Объект транзакции или null
   */
  startTransaction(options) {
    if (!this.isInitialized) {
      // Возвращаем объект-заглушку, чтобы не вызывать ошибки при использовании
      return {
        finish: () => {},
        setStatus: () => {}
      };
    }
    
    try {
      const transaction = Sentry.startTransaction(options);
      return transaction;
    } catch (error) {
      console.error('Error starting transaction:', error);
      // Возвращаем объект-заглушку, чтобы не вызывать ошибки при использовании
      return {
        finish: () => {},
        setStatus: () => {}
      };
    }
  }
}

// Экспортируем инстанс сервиса
export default new ErrorService(); 