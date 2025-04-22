/**
 * Общее состояние приложения
 * Предотвращает циклические зависимости между сервисами
 */
export const sharedState = {
  // Флаги состояния приложения
  isAppInitialized: false,
  isTelegramReady: false,
  isDebugMode: false,
  
  // Данные пользователя
  user: null,
  
  // Параметры темы Telegram
  theme: {
    bgColor: '#ffffff',
    textColor: '#000000',
    buttonColor: '#3a6ec1',
    buttonTextColor: '#ffffff'
  },
  
  // Текущий экран
  currentScreen: null,
  
  // Логи
  logs: [],
  
  /**
   * Обновляет параметры темы
   * @param {Object} themeParams 
   */
  updateTheme(themeParams) {
    if (!themeParams) return;
    
    // Обновляем параметры темы
    this.theme = {
      bgColor: themeParams.bg_color || this.theme.bgColor,
      textColor: themeParams.text_color || this.theme.textColor,
      buttonColor: themeParams.button_color || this.theme.buttonColor,
      buttonTextColor: themeParams.button_text_color || this.theme.buttonTextColor
    };
    
    // Применяем тему к документу
    document.documentElement.style.setProperty('--bg-color', this.theme.bgColor);
    document.documentElement.style.setProperty('--text-color', this.theme.textColor);
    document.documentElement.style.setProperty('--button-color', this.theme.buttonColor);
    document.documentElement.style.setProperty('--button-text-color', this.theme.buttonTextColor);
    
    this.log('Тема Telegram обновлена');
  },
  
  /**
   * Безопасно получает элемент DOM
   * @param {string} id ID элемента
   * @returns {HTMLElement|null}
   */
  getElementById(id) {
    return document.getElementById(id);
  },
  
  /**
   * Безопасно создает элемент DOM
   * @param {string} tagName Имя тега
   * @returns {HTMLElement}
   */
  createElement(tagName) {
    return document.createElement(tagName);
  },
  
  /**
   * Показывает сообщение об ошибке
   * @param {string} message Сообщение
   */
  showErrorMessage(message) {
    this.log(`Отображение сообщения об ошибке: ${message}`, 'error');
    
    // Получаем или создаем контейнер для ошибок
    let errorContainer = this.getElementById('error-container');
    
    if (!errorContainer) {
      errorContainer = this.createElement('div');
      errorContainer.id = 'error-container';
      errorContainer.style.position = 'fixed';
      errorContainer.style.top = '10px';
      errorContainer.style.left = '50%';
      errorContainer.style.transform = 'translateX(-50%)';
      errorContainer.style.zIndex = '2000';
      document.body.appendChild(errorContainer);
    }
    
    // Создаем элемент сообщения
    const errorMessage = this.createElement('div');
    errorMessage.className = 'error-message';
    errorMessage.style.backgroundColor = 'rgba(255, 0, 0, 0.8)';
    errorMessage.style.color = 'white';
    errorMessage.style.padding = '10px 15px';
    errorMessage.style.borderRadius = '5px';
    errorMessage.style.marginBottom = '5px';
    errorMessage.style.boxShadow = '0 2px 5px rgba(0, 0, 0, 0.3)';
    errorMessage.style.maxWidth = '80vw';
    errorMessage.style.wordBreak = 'break-word';
    errorMessage.textContent = message;
    
    // Добавляем сообщение в контейнер
    errorContainer.appendChild(errorMessage);
    
    // Устанавливаем таймер для удаления сообщения
    setTimeout(() => {
      if (errorContainer.contains(errorMessage)) {
        errorContainer.removeChild(errorMessage);
      }
    }, 5000);
  },
  
  /**
   * Логирует сообщение
   * @param {string} message Сообщение
   * @param {string} level Уровень логирования (info, warn, error)
   */
  log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    const logEntry = { timestamp, message, level };
    
    // Добавляем лог в массив
    this.logs.push(logEntry);
    
    // Ограничиваем количество логов
    if (this.logs.length > 100) {
      this.logs.shift();
    }
    
    // Выводим в консоль
    switch (level) {
      case 'warn':
        console.warn(`[${timestamp}] ${message}`);
        break;
      case 'error':
        console.error(`[${timestamp}] ${message}`);
        break;
      default:
        console.log(`[${timestamp}] ${message}`);
    }
    
    // Обновляем отображение логов, если оно активно
    this.updateLogDisplay();
  },
  
  /**
   * Обновляет отображение логов в UI
   */
  updateLogDisplay() {
    const logsContainer = this.getElementById('logs-container');
    if (!logsContainer || logsContainer.style.display === 'none') return;
    
    // Очищаем контейнер
    logsContainer.innerHTML = '';
    
    // Добавляем заголовок
    const header = this.createElement('div');
    header.style.fontWeight = 'bold';
    header.style.marginBottom = '5px';
    header.style.borderBottom = '1px solid #444';
    header.textContent = 'Логи приложения:';
    logsContainer.appendChild(header);
    
    // Добавляем логи
    this.logs.forEach(log => {
      const logElement = this.createElement('div');
      logElement.className = `log-entry log-${log.level}`;
      logElement.style.fontSize = '10px';
      logElement.style.marginBottom = '2px';
      logElement.style.borderLeft = `3px solid ${log.level === 'error' ? 'red' : log.level === 'warn' ? 'orange' : 'green'}`;
      logElement.style.paddingLeft = '5px';
      
      const time = log.timestamp.split('T')[1].split('.')[0];
      logElement.textContent = `[${time}] ${log.message}`;
      
      logsContainer.appendChild(logElement);
    });
    
    // Прокручиваем контейнер вниз
    logsContainer.scrollTop = logsContainer.scrollHeight;
  }
}; 