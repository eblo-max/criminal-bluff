/**
 * ErrorService - Сервис для обработки и мониторинга ошибок
 */
import * as Sentry from '@sentry/react';

class ErrorService {
  /**
   * Конструктор сервиса ошибок
   */
  constructor() {
    this.isInitialized = false;
  }

  /**
   * Инициализация сервиса ошибок и Sentry
   * @param {Object} telegramUser - Информация о пользователе Telegram
   * @returns {Boolean} - Успешность инициализации
   */
  init(telegramUser = null) {
    // Если Sentry уже инициализирован, не инициализируем повторно
    if (this.isInitialized) {
      return true;
    }
    
    // Если DSN не указан, не инициализируем Sentry
    const dsn = import.meta.env.VITE_SENTRY_DSN;
    if (!dsn) {
      console.warn('Sentry DSN не указан. Мониторинг ошибок отключен.');
      return false;
    }
    
    try {
      // Инициализируем Sentry
      Sentry.init({
        dsn: dsn,
        environment: import.meta.env.VITE_NODE_ENV || 'development',
        release: import.meta.env.VITE_APP_VERSION || '1.0.0',
        
        // В Sentry 9.x интеграции настраиваются автоматически
        // Настройка для трассировки запросов
        tracePropagationTargets: [
          window.location.origin, 
          /^https:\/\/api\./, 
          /^https:\/\/[\w-]+\.railway\.app/
        ],
        
        // Настройки для трассировки транзакций
        tracesSampleRate: import.meta.env.VITE_NODE_ENV === 'production' ? 0.2 : 1.0,
        
        // Настройки для Session Replay
        replaysSessionSampleRate: 0.1,
        replaysOnErrorSampleRate: 1.0,
        
        beforeSend(event, hint) {
          const error = hint && hint.originalException;
          
          // Добавляем информацию о типе ошибки
          if (error && error.name) {
            event.tags = event.tags || {};
            event.tags.error_type = error.name;
          }
          
          // Редактируем или удаляем чувствительную информацию
          if (event.request && event.request.url) {
            // Проверяем URL на содержание токенов
            if (event.request.url.includes('token=') || 
                event.request.url.includes('auth=') || 
                event.request.url.includes('initData=')) {
              // Редактируем URL, удаляя чувствительные параметры
              event.request.url = event.request.url.replace(
                /([?&])(token|auth|initData)=([^&]+)/g, 
                '$1$2=[REDACTED]'
              );
            }
          }
          
          // Исключаем ошибки веб-расширений
          if (hint && hint.originalException && 
              (String(hint.originalException).includes('extension') || 
               String(hint.originalException).includes('adblock')
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
      
      // Добавляем глобальный обработчик необработанных ошибок
      window.addEventListener('error', (event) => {
        this.captureException(event.error || new Error(event.message), {
          tags: { mechanism: 'onerror' }
        });
      });
      
      // Добавляем глобальный обработчик необработанных промисов
      window.addEventListener('unhandledrejection', (event) => {
        this.captureException(event.reason || new Error('Unhandled Promise rejection'), {
          tags: { mechanism: 'onunhandledrejection' }
        });
      });
      
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
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
        ip_address: '{{auto}}'
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
        
        // Добавляем данные о Telegram WebApp, если доступны
        if (window.Telegram?.WebApp) {
          scope.setTag('telegram_platform', window.Telegram.WebApp.platform || 'unknown');
          scope.setTag('telegram_version', window.Telegram.WebApp.version || 'unknown');
          scope.setContext('Telegram WebApp', {
            colorScheme: window.Telegram.WebApp.colorScheme,
            viewportHeight: window.Telegram.WebApp.viewportHeight,
            viewportStableHeight: window.Telegram.WebApp.viewportStableHeight,
            initDataUnsafe: !!window.Telegram.WebApp.initDataUnsafe
          });
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
   * Начинает новую транзакцию для мониторинга производительности
   * @param {Object} options - Опции транзакции
   * @param {String} options.name - Название транзакции
   * @param {String} options.op - Тип операции
   * @param {Object} [options.data] - Дополнительные данные
   * @returns {Transaction} - Объект транзакции
   */
  startTransaction(options) {
    if (!this.isInitialized) {
      console.warn('Sentry не инициализирован. Транзакция не будет отслеживаться.');
      // Возвращаем заглушку транзакции
      return {
        startChild: () => ({ finish: () => {} }),
        finish: () => {},
        setStatus: () => {}
      };
    }

    try {
      // Создаем транзакцию с помощью API Sentry 7.x
      const transaction = Sentry.startTransaction(options);
      
      // Устанавливаем текущую транзакцию для автоматического связывания с последующими событиями
      Sentry.getCurrentHub().configureScope(scope => {
        scope.setSpan(transaction);
      });
      
      return transaction;
    } catch (error) {
      console.error('Error starting transaction:', error);
      // Возвращаем заглушку транзакции в случае ошибки
      return {
        startChild: () => ({ finish: () => {} }),
        finish: () => {},
        setStatus: () => {}
      };
    }
  }

  /**
   * Добавляет метку (тег) ко всем последующим событиям
   * @param {String} key - Ключ метки
   * @param {String} value - Значение метки
   */
  setTag(key, value) {
    if (!this.isInitialized) {
      return;
    }
    
    try {
      Sentry.setTag(key, value);
    } catch (error) {
      console.error('Error setting tag:', error);
    }
  }

  /**
   * Добавляет дополнительный контекст ко всем последующим событиям
   * @param {String} name - Название контекста
   * @param {Object} context - Объект с контекстной информацией
   */
  setContext(name, context) {
    if (!this.isInitialized) {
      return;
    }
    
    try {
      Sentry.setContext(name, context);
    } catch (error) {
      console.error('Error setting context:', error);
    }
  }
}

// Экспортируем инстанс сервиса
export default new ErrorService(); 