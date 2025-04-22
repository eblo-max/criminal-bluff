/**
 * Служба логирования (замена Sentry)
 * Простая реализация логирования в консоль
 */

/**
 * Инициализация службы логирования
 */
export function initSentry() {
  console.log('Логирование инициализировано');
}

/**
 * Логирование исключения
 * @param {Error|string} error - Объект ошибки или строка сообщения
 * @param {Object} context - Дополнительный контекст ошибки
 */
export function captureException(error, context = {}) {
  console.error('Перехвачена ошибка:', error, context);
}

/**
 * Отправка информационного сообщения
 * @param {string} message - Сообщение для логирования
 * @param {Object} options - Дополнительные опции
 */
export function captureMessage(message, options = {}) {
  console.log('Сообщение:', message, options);
}

/**
 * Установка информации о пользователе
 * @param {Object} user - Информация о пользователе
 */
export function setUserContext(user) {
  console.log('Установлена информация о пользователе:', user);
}

/**
 * Начинает новую транзакцию для отслеживания производительности
 * @param {Object} options - Опции транзакции
 * @returns {Object} - Объект транзакции-заглушки
 */
export function startTransaction(options) {
  console.log('Начата транзакция:', options.name, options);
  
  // Возвращаем заглушку транзакции с теми же методами
  return {
    name: options.name,
    op: options.op,
    data: options.data || {},
    startChild: (childOptions) => {
      console.log(`Начат дочерний span: ${childOptions.op}`);
      return {
        finish: () => { console.log(`Завершен дочерний span: ${childOptions.op}`); }
      };
    },
    finish: () => { console.log(`Транзакция завершена: ${options.name}`); },
    setStatus: (status) => { console.log(`Установлен статус транзакции: ${status}`); },
    setData: (data) => { console.log(`Установлены данные транзакции:`, data); }
  };
}

/**
 * Добавляет метку (тег)
 * @param {string} key - Ключ метки
 * @param {string} value - Значение метки
 */
export function setTag(key, value) {
  console.log(`Установлен тег: ${key}=${value}`);
}

/**
 * Добавляет контекстную информацию
 * @param {string} name - Имя контекста
 * @param {object} context - Объект контекста
 */
export function setContext(name, context) {
  console.log(`Установлен контекст [${name}]:`, context);
}

// Экспортируем объект сервиса для унификации с другими сервисами
export const sentryService = {
  initSentry,
  captureException,
  captureMessage,
  setUserContext,
  startTransaction,
  setTag,
  setContext
};

// Экспортируем заглушку для обратной совместимости
export default {
  captureException,
  captureMessage
}; 