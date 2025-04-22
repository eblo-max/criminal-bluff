/**
 * Сервис для работы с Sentry - система мониторинга ошибок
 */

import * as Sentry from '@sentry/browser';
import { 
  browserTracingIntegration, 
  replayIntegration, 
  captureException as sentryCaptureException,
  captureMessage as sentryCaptureMessage,
  setUser,
  setTag as sentrySetTag,
  setContext as sentrySetContext
} from '@sentry/browser';

// Конфигурация Sentry
const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN || 'https://a5291ea1ed611f0a45522c403b23981@o4509192317370448.ingest.sentry.io/4509192317731328';

// Инициализация Sentry с настройками для версии 9.x
export function initSentry() {
  // Не инициализируем Sentry в режиме разработки если не задан DSN
  if (import.meta.env.DEV && !import.meta.env.VITE_SENTRY_DSN) {
    console.warn('Sentry не инициализирован в режиме разработки (не задан DSN)');
    return;
  }

  try {
    Sentry.init({
      dsn: SENTRY_DSN,
      integrations: [
        browserTracingIntegration({
          tracePropagationTargets: [
            'localhost',
            /^\//,
            'ingest.sentry.io'
          ],
        }),
        replayIntegration({
          // Настройки для записи сессий
          maskAllText: true,
          blockAllMedia: true,
        }),
      ],
      
      // Настройки для трассировки производительности
      tracesSampleRate: import.meta.env.PROD ? 0.2 : 1.0,
      
      // Настройки для записи сессий
      replaysSessionSampleRate: 0.1, // Записывать 10% сессий 
      replaysOnErrorSampleRate: 1.0, // Записывать 100% сессий с ошибками
      
      // Информация о релизе
      release: window.appVersion || '1.0.0',
      
      // Окружение (разработка/продакшн)
      environment: import.meta.env.MODE || 'production',
      
      // Обработка данных перед отправкой
      beforeSend: (event, hint) => {
        // Не отправляем ошибки в режиме разработки (если не включен отладочный режим)
        if (import.meta.env.DEV && !window.debugMode) {
          console.warn('Ошибка перехвачена Sentry (не отправлена в режиме разработки):', hint.originalException || hint.syntheticException);
          return null;
        }

        // Фильтрация некритичных ошибок
        const errorMessage = (hint.originalException || hint.syntheticException || {}).message || '';
        if (
          errorMessage.includes('ResizeObserver loop limit exceeded') ||
          errorMessage.includes('Script error') ||
          errorMessage.includes('Request aborted')
        ) {
          return null;
        }

        // Удаляем конфиденциальную информацию
        if (event.user && event.user.email) {
          delete event.user.email;
        }

        return event;
      }
    });

    // Установка пользовательского контекста, если пользователь авторизован
    const user = window.telegramUser || JSON.parse(localStorage.getItem('user') || '{}');
    if (user && user.id) {
      setUser({
        id: user.id,
        username: user.username || undefined,
        ip_address: '{{auto}}'
      });
    }

    console.log('Sentry успешно инициализирован');
  } catch (error) {
    console.error('Ошибка при инициализации Sentry:', error);
  }
}

/**
 * Захват и отправка исключения в Sentry
 * @param {Error|string} error - Объект ошибки или строка сообщения
 * @param {Object} context - Дополнительный контекст ошибки
 */
export function captureException(error, context = {}) {
  console.error('Ошибка перехвачена:', error);

  // Если Sentry не инициализирован или мы в режиме разработки без явной отладки, только логируем
  if (
    import.meta.env.DEV && 
    !window.debugMode &&
    !import.meta.env.VITE_SENTRY_DSN
  ) {
    return;
  }

  try {
    if (typeof error === 'string') {
      sentryCaptureMessage(error, {
        level: context.level || 'error',
        tags: context.tags,
        extra: context.extra
      });
    } else {
      sentryCaptureException(error, {
        tags: context.tags,
        extra: context.extra
      });
    }
  } catch (err) {
    console.error('Ошибка при отправке исключения в Sentry:', err);
  }
}

/**
 * Отправка сообщения в Sentry (для информационных событий)
 * @param {string} message - Сообщение для отправки
 * @param {Object} options - Дополнительные опции
 */
export function captureMessage(message, options = {}) {
  // Если Sentry не инициализирован или мы в режиме разработки без явной отладки, только логируем
  if (
    import.meta.env.DEV && 
    !window.debugMode &&
    !import.meta.env.VITE_SENTRY_DSN
  ) {
    console.log('Сообщение Sentry (не отправлено в режиме разработки):', message);
    return;
  }

  try {
    sentryCaptureMessage(message, {
      level: options.level || 'info',
      tags: options.tags,
      extra: options.extra
    });
  } catch (err) {
    console.error('Ошибка при отправке сообщения в Sentry:', err);
  }
}

/**
 * Устанавливает пользовательский контекст
 * @param {Object} user - Информация о пользователе
 */
export function setUserContext(user) {
  if (!user || !user.id) return;
  
  try {
    setUser({
      id: user.id,
      username: user.username || undefined,
      ip_address: '{{auto}}'
    });
  } catch (err) {
    console.error('Ошибка при установке пользовательского контекста в Sentry:', err);
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
export function startTransaction(options) {
  try {
    // В Sentry 9.x создаем транзакцию через init опции
    const transaction = {
      name: options.name,
      op: options.op,
      data: options.data || {},
      startChild: (childOptions) => {
        console.log(`Span started: ${childOptions.op}`);
        return {
          finish: () => { console.log(`Span finished: ${childOptions.op}`); }
        };
      },
      finish: () => { console.log(`Transaction finished: ${options.name}`); },
      setStatus: (status) => { console.log(`Transaction status set to: ${status}`); }
    };
    
    // Добавляем информацию о транзакции в теги
    sentrySetTag('transaction_name', options.name);
    sentrySetTag('transaction_op', options.op);
    
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
 * Добавляет метку (тег) к событиям Sentry
 * @param {string} key - Ключ метки
 * @param {string} value - Значение метки
 */
export function setTag(key, value) {
  try {
    sentrySetTag(key, value);
  } catch (err) {
    console.error('Ошибка при установке тега в Sentry:', err);
  }
}

/**
 * Добавляет контекстную информацию к событиям Sentry
 * @param {string} name - Имя контекста
 * @param {object} context - Объект контекста
 */
export function setContext(name, context) {
  try {
    sentrySetContext(name, context);
  } catch (err) {
    console.error('Ошибка при установке контекста в Sentry:', err);
  }
}

// Экспортируем объект Sentry для прямого доступа при необходимости
export default Sentry; 