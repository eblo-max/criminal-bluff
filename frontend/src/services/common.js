/**
 * Общее состояние приложения
 * Используется для предотвращения циклических зависимостей между сервисами
 */
export const sharedState = {
  // Флаги состояния приложения
  isAppInitialized: false,
  isTelegramReady: false,
  isUserDataLoaded: false,
  
  // Данные пользователя
  userData: null,
  
  // Параметры темы Telegram
  themeParams: null,
  
  // Текущий экран
  currentScreen: null,
  
  /**
   * Логирование сообщений приложения
   * @param {string} message - сообщение для логирования
   * @param {string} level - уровень сообщения (log, info, warn, error)
   */
  log(message, level = 'log') {
    const prefix = '[Criminal Bluff] ';
    
    switch (level) {
      case 'info':
        console.info(prefix + message);
        break;
      case 'warn':
        console.warn(prefix + message);
        break;
      case 'error':
        console.error(prefix + message);
        break;
      default:
        console.log(prefix + message);
    }
  },
  
  /**
   * Безопасная манипуляция DOM-элементами
   * @param {string} selector - CSS-селектор для элемента
   * @param {Function} callback - функция, выполняемая с элементом
   * @returns {boolean} - успешность операции
   */
  safelyManipulateDOM(selector, callback) {
    try {
      const element = document.querySelector(selector);
      if (element) {
        callback(element);
        return true;
      }
      return false;
    } catch (error) {
      this.log(`Ошибка при работе с DOM (${selector}): ${error.message}`, 'error');
      return false;
    }
  },
  
  /**
   * Показать сообщение об ошибке
   * @param {string} message - текст сообщения
   */
  showErrorMessage(message) {
    try {
      // Попытка использовать имеющийся элемент ошибки
      let errorElement = document.getElementById('error-message');
      
      // Если элемент не существует, создаем его
      if (!errorElement) {
        errorElement = document.createElement('div');
        errorElement.id = 'error-message';
        errorElement.style.cssText = `
          position: fixed;
          bottom: 20px;
          left: 50%;
          transform: translateX(-50%);
          background-color: var(--error-color, #f44336);
          color: white;
          padding: 12px 24px;
          border-radius: 8px;
          font-size: 16px;
          z-index: 9999;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
          max-width: 80%;
          text-align: center;
          opacity: 0;
          transition: opacity 0.3s ease;
        `;
        document.body.appendChild(errorElement);
      }
      
      // Устанавливаем текст сообщения
      errorElement.textContent = message;
      
      // Показываем сообщение
      setTimeout(() => {
        errorElement.style.opacity = '1';
      }, 10);
      
      // Скрываем сообщение через 3 секунды
      setTimeout(() => {
        errorElement.style.opacity = '0';
        
        // Удаляем элемент после анимации скрытия
        setTimeout(() => {
          if (errorElement && errorElement.parentNode) {
            errorElement.parentNode.removeChild(errorElement);
          }
        }, 300);
      }, 3000);
    } catch (error) {
      // В случае ошибки при показе сообщения, выводим в консоль
      this.log(`Не удалось показать сообщение об ошибке: ${message}`, 'error');
      this.log(error.message, 'error');
    }
  }
}; 