/**
 * Общее состояние приложения
 * Используется для предотвращения циклических зависимостей между сервисами
 */
export const sharedState = {
  // Флаги состояния приложения
  isAppInitialized: false,
  isTelegramReady: false,
  isUserDataLoaded: false,
  isInitialized: false,
  
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
   * @param {Object} data - дополнительные данные для логирования
   */
  log(message, level = 'log', data = null) {
    const prefix = '[Criminal Bluff] ';
    
    try {
      const formattedMessage = data 
        ? `${prefix}${message} ${JSON.stringify(data)}`
        : `${prefix}${message}`;
        
      switch (level) {
        case 'info':
          console.info(formattedMessage);
          break;
        case 'warn':
          console.warn(formattedMessage);
          break;
        case 'error':
          console.error(formattedMessage);
          break;
        default:
          console.log(formattedMessage);
      }
      
      // Добавляем сообщение в отладочный лог, если он есть
      this.addToDebugLog(message, level);
    } catch (error) {
      console.error(`[Criminal Bluff] Ошибка логирования: ${error.message}`);
    }
  },
  
  /**
   * Добавляет сообщение в визуальный отладочный лог
   * @param {string} message - сообщение для логирования
   * @param {string} level - уровень сообщения (log, info, warn, error)
   */
  addToDebugLog(message, level = 'log') {
    if (!window.debugMode) return;
    
    try {
      const debugLog = document.getElementById('debug-log');
      if (!debugLog) return;
      
      const logItem = document.createElement('div');
      logItem.style.marginBottom = '3px';
      logItem.style.borderLeft = '3px solid';
      logItem.style.paddingLeft = '5px';
      
      // Устанавливаем цвет в зависимости от уровня
      switch (level) {
        case 'info':
          logItem.style.borderColor = '#2196f3';
          break;
        case 'warn':
          logItem.style.borderColor = '#ff9800';
          break;
        case 'error':
          logItem.style.borderColor = '#f44336';
          break;
        default:
          logItem.style.borderColor = '#4caf50';
      }
      
      // Добавляем временную метку
      const timestamp = new Date().toLocaleTimeString();
      logItem.textContent = `${timestamp}: ${message}`;
      
      // Добавляем в начало, чтобы новые сообщения были сверху
      debugLog.insertBefore(logItem, debugLog.firstChild);
      
      // Ограничиваем количество сообщений
      if (debugLog.children.length > 30) {
        debugLog.removeChild(debugLog.lastChild);
      }
    } catch (e) {
      // Молча игнорируем ошибки в отладочном логе
    }
  },
  
  /**
   * Проверяет, загружен ли DOM
   * @returns {boolean} - готов ли DOM
   */
  isDOMReady() {
    return document.readyState === 'complete' || document.readyState === 'interactive';
  },
  
  /**
   * Безопасная манипуляция DOM-элементами
   * @param {string} selector - CSS-селектор для элемента
   * @param {Function} callback - функция, выполняемая с элементом
   * @param {boolean} waitForElement - ждать ли появления элемента
   * @param {number} timeout - таймаут ожидания элемента в мс
   * @returns {boolean} - успешность операции
   */
  safelyManipulateDOM(selector, callback, waitForElement = false, timeout = 1000) {
    try {
      // Если DOM не готов и нам нужно дождаться элемента, откладываем выполнение
      if (!this.isDOMReady() && waitForElement) {
        this.log(`DOM не готов для ${selector}, откладываем манипуляцию`, 'info');
        setTimeout(() => {
          this.safelyManipulateDOM(selector, callback, waitForElement, timeout);
        }, 50);
        return false;
      }
      
      const element = document.querySelector(selector);
      
      if (element) {
        // Элемент найден, безопасно выполняем функцию
        try {
          callback(element);
          return true;
        } catch (callbackError) {
          this.log(`Ошибка в функции обратного вызова для ${selector}: ${callbackError.message}`, 'error');
          return false;
        }
      } else if (waitForElement && timeout > 0) {
        // Если элемент не найден, но мы хотим подождать его появления
        this.log(`Элемент ${selector} не найден, ожидаем...`, 'info');
        setTimeout(() => {
          this.safelyManipulateDOM(selector, callback, waitForElement, timeout - 100);
        }, 100);
        return false;
      } else {
        // Элемент не найден и мы не ждем
        this.log(`Элемент не найден: ${selector}`, 'warn');
        return false;
      }
    } catch (error) {
      this.log(`Ошибка при работе с DOM (${selector}): ${error.message}`, 'error');
      return false;
    }
  },
  
  /**
   * Безопасное создание или обновление HTML-элемента
   * @param {string} id - ID элемента
   * @param {string} tag - HTML-тег для создания элемента
   * @param {Object} styles - CSS-стили для элемента
   * @param {string} content - HTML-содержимое элемента
   * @param {string} parent - ID родительского элемента (опционально)
   * @returns {HTMLElement|null} - созданный или обновленный элемент
   */
  createOrUpdateElement(id, tag, styles = {}, content = '', parent = null) {
    try {
      if (!id || !tag) {
        this.log('Не указан ID или тег элемента', 'error');
        return null;
      }
      
      // Ищем существующий элемент
      let element = document.getElementById(id);
      
      // Если элемента нет, создаем его
      if (!element) {
        element = document.createElement(tag);
        element.id = id;
        
        // Если указан родитель, добавляем элемент к нему
        if (parent) {
          const parentElement = typeof parent === 'string' 
            ? document.getElementById(parent) 
            : parent;
            
          if (parentElement) {
            parentElement.appendChild(element);
          } else {
            document.body.appendChild(element);
          }
        } else {
          document.body.appendChild(element);
        }
      }
      
      // Применяем стили
      if (styles && typeof styles === 'object') {
        Object.keys(styles).forEach(key => {
          element.style[key] = styles[key];
        });
      }
      
      // Устанавливаем содержимое, если оно указано
      if (content !== undefined && content !== null) {
        element.innerHTML = content;
      }
      
      return element;
    } catch (error) {
      this.log(`Ошибка при создании/обновлении элемента ${id}: ${error.message}`, 'error');
      return null;
    }
  },
  
  /**
   * Показать сообщение об ошибке
   * @param {string} message - текст сообщения
   * @param {number} duration - длительность отображения в мс (по умолчанию 3000)
   */
  showErrorMessage(message, duration = 3000) {
    try {
      // Создаем или обновляем элемент ошибки
      const errorElement = this.createOrUpdateElement('error-message', 'div', {
        position: 'fixed',
        bottom: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        backgroundColor: 'var(--error-color, #f44336)',
        color: 'white',
        padding: '12px 24px',
        borderRadius: '8px',
        fontSize: '16px',
        zIndex: '9999',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
        maxWidth: '80%',
        textAlign: 'center',
        opacity: '0',
        transition: 'opacity 0.3s ease'
      }, message);
      
      if (!errorElement) return;
      
      // Показываем сообщение
      setTimeout(() => {
        errorElement.style.opacity = '1';
      }, 10);
      
      // Скрываем сообщение через указанное время
      setTimeout(() => {
        if (errorElement) {
          errorElement.style.opacity = '0';
          
          // Удаляем элемент после анимации скрытия
          setTimeout(() => {
            if (errorElement && errorElement.parentNode) {
              errorElement.parentNode.removeChild(errorElement);
            }
          }, 300);
        }
      }, duration);
    } catch (error) {
      // В случае ошибки при показе сообщения, выводим в консоль
      this.log(`Не удалось показать сообщение об ошибке: ${message}`, 'error');
      this.log(error.message, 'error');
    }
  }
}; 