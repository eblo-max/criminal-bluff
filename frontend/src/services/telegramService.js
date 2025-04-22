/**
 * Telegram Service
 * Сервис для взаимодействия с API Telegram Mini Apps
 */

// Избегаем циклические зависимости - не импортируем uiService напрямую
// Будем использовать только прямые DOM-манипуляции для критически важных ошибок

// Импортируем общее состояние для предотвращения циклических зависимостей
import { sharedState } from './common';

// Приватные переменные для синглтона
let _instance = null;
let _telegramInitialized = false;
let _telegramUser = null;

// Вспомогательная функция для проверки DOM-элементов перед манипуляцией
function safelyManipulateDOM(elementId, callback) {
  try {
    const element = document.getElementById(elementId);
    if (element) {
      callback(element);
      return true;
    }
    console.warn(`Элемент с ID "${elementId}" не найден для манипуляции`);
    return false;
  } catch (error) {
    console.error(`Ошибка при манипуляции с DOM-элементом "${elementId}":`, error);
    return false;
  }
}

/**
 * Безопасное логирование для отладки
 * @param {string} message - Сообщение для логирования
 * @param {string} level - Уровень логирования (log, info, warn, error)
 * @param {Object} data - Дополнительные данные для логирования
 */
export function safeLog(message, level = 'log', data = null) {
  // Используем функцию логирования из общего состояния, если она доступна
  if (sharedState && typeof sharedState.log === 'function') {
    sharedState.log(message, level, data);
  } else {
    // Резервное логирование, если sharedState недоступен
    try {
      const prefix = '[TelegramService] ';
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
    } catch (error) {
      console.error('[TelegramService] Ошибка логирования:', error);
    }
  }
}

/**
 * Проверяет доступность Telegram WebApp
 * @returns {boolean} - Доступен ли Telegram WebApp
 */
export function isTelegramAvailable() {
  return !!(window.Telegram && window.Telegram.WebApp);
}

/**
 * Инициализация Telegram WebApp
 * @returns {Promise<boolean>} - Результат инициализации
 */
export async function initTelegram() {
  try {
    // Если уже инициализирован, возвращаем положительный результат
    if (_telegramInitialized) {
      safeLog('Telegram WebApp уже был инициализирован ранее');
      return true;
    }
    
    safeLog('Начинаем инициализацию Telegram WebApp');
    
    // Проверяем доступность Telegram WebApp
    const available = isTelegramAvailable();
    safeLog(`Telegram WebApp доступен: ${available}`);
    
    if (!available) {
      safeLog('Telegram WebApp не доступен, инициализация невозможна', 'error');
      sharedState.showErrorMessage('Telegram WebApp не доступен. Приложение должно быть открыто через Telegram.');
      return false;
    }
    
    safeLog(`Состояние DOM: ${document.readyState}`);
    
    // Создаем экземпляр сервиса, если он еще не был создан
    if (!_instance) {
      _instance = new TelegramService();
    }
    
    // Выполняем инициализацию с тремя попытками
    let attempts = 0;
    let result = false;
    
    while (attempts < 3 && !result) {
      attempts++;
      safeLog(`Попытка инициализации ${attempts}/3`);
      
      try {
        result = await _instance.init();
        
        if (result) {
          safeLog(`Успешная инициализация на попытке ${attempts}`);
          break;
        } else {
          safeLog(`Неудачная попытка ${attempts}`, 'warn');
          // Небольшая задержка перед следующей попыткой
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      } catch (initError) {
        safeLog(`Ошибка при попытке ${attempts}: ${initError.message}`, 'error');
        // Небольшая задержка перед следующей попыткой
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }
    
    if (result) {
      // Сохраняем пользователя после успешной инициализации
      _telegramUser = _instance.user;
      _telegramInitialized = true;
      
      // Обновляем состояние в shared state
      sharedState.isTelegramReady = true;
      
      safeLog('Telegram WebApp успешно инициализирован');
      return true;
    }
    
    safeLog(`Не удалось инициализировать Telegram WebApp после ${attempts} попыток`, 'error');
    return false;
  } catch (error) {
    safeLog(`Ошибка при инициализации Telegram WebApp: ${error.message}`, 'error');
    return false;
  }
}

/**
 * Получить экземпляр TelegramService
 * @returns {TelegramService|null} - Экземпляр сервиса или null, если не инициализирован
 */
export function getTelegramService() {
  return _instance;
}

/**
 * Получить данные пользователя Telegram
 * @returns {Object|null} - Данные пользователя или null, если не инициализирован
 */
export function getTelegramUser() {
  return _telegramUser;
}

export class TelegramService {
  constructor() {
    // Telegram WebApp объект
    this.tg = window.Telegram?.WebApp;
    
    // Информация о пользователе
    this.user = null;
    
    // URL API бекенда
    this.apiBaseUrl = process.env.REACT_APP_API_URL || '';
    
    // Инициализационные данные
    this.initData = this.tg?.initData || '';
    
    // JWT токен после аутентификации
    this.authToken = localStorage.getItem('auth_token') || null;
    
    // Состояние инициализации
    this.initialized = false;
    
    // Обработчик для завершения инициализации
    this.onInitComplete = null;
    
    // Логирование создания сервиса
    safeLog('TelegramService создан', 'info', {
      tgAvailable: !!this.tg,
      initData: this.initData ? 'доступны' : 'недоступны'
    });
  }
  
  /**
   * Инициализация сервиса
   */
  async init() {
    try {
      safeLog('Starting Telegram WebApp initialization...');
      
      // Запись отладочной информации
      this._logDebugInfo('Начало инициализации');
      
      // Проверяем наличие объекта Telegram.WebApp
      if (!this.tg) {
        safeLog('ОШИБКА: Telegram WebApp объект недоступен', 'error');
        this._logDebugInfo('Telegram WebApp объект недоступен');
        
        // Проверяем наличие window.Telegram
        if (window.Telegram) {
          safeLog('window.Telegram есть, но WebApp отсутствует', 'warn');
          this._logDebugInfo('window.Telegram есть, но WebApp отсутствует');
        }
        
        // Специальный режим для отладки
        if (this._isDebugMode()) {
          safeLog('Включен режим отладки. Пробуем запуститься без WebApp', 'warn');
          this._logDebugInfo('Пробуем запуститься в режиме отладки');
          return await this.fallbackInitialization();
        }
        
        this._logDebugInfo('Инициализация не удалась: WebApp недоступен');
        return false;
      }
      
      safeLog(`Telegram WebApp объект найден, версия: ${this.tg.version}`);
      this._logDebugInfo(`WebApp версия: ${this.tg.version}, платформа: ${this.tg.platform}`);
      
      // Сообщаем Telegram, что приложение готово
      try {
        this.tg.ready();
      } catch (readyError) {
        safeLog(`Ошибка при вызове WebApp.ready(): ${readyError.message}`, 'warn');
      }
      
      // Расширяем окно приложения на всю высоту
      try {
        this.tg.expand();
      } catch (expandError) {
        safeLog(`Не удалось расширить окно WebApp: ${expandError.message}`, 'warn');
        this._logDebugInfo(`Ошибка при расширении окна: ${expandError.message}`);
      }
      
      // Сохраняем initData для потенциального использования в других местах
      this.initData = this.tg.initData || '';
      
      if (!this.initData && this.tg.initDataUnsafe) {
        // Если initData пусты, но есть initDataUnsafe, попробуем использовать его
        try {
          const rawInitData = new URLSearchParams();
          const unsafeData = this.tg.initDataUnsafe;
          
          // Преобразуем объект в строку initData
          if (unsafeData.query_id) rawInitData.append('query_id', unsafeData.query_id);
          if (unsafeData.user) rawInitData.append('user', JSON.stringify(unsafeData.user));
          if (unsafeData.auth_date) rawInitData.append('auth_date', unsafeData.auth_date);
          if (unsafeData.hash) rawInitData.append('hash', unsafeData.hash);
          
          this.initData = rawInitData.toString();
          safeLog('Создан initData из initDataUnsafe');
          this._logDebugInfo('Создан initData из initDataUnsafe');
        } catch (dataError) {
          safeLog(`Ошибка при создании initData из initDataUnsafe: ${dataError.message}`, 'error');
          this._logDebugInfo(`Ошибка при создании initData: ${dataError.message}`);
        }
      }
      
      if (!this.initData) {
        safeLog('ОШИБКА: initData не доступны в WebApp объекте', 'error');
        this._logDebugInfo('initData не доступны в WebApp объекте');
        
        // Пробуем получить из localStorage (если был сохранен ранее)
        const savedInitData = localStorage.getItem('tg_init_data');
        if (savedInitData) {
          safeLog('Используем сохраненные initData из localStorage');
          this._logDebugInfo('Используем сохраненные initData из localStorage');
          this.initData = savedInitData;
        } else if (this._isDebugMode()) {
          safeLog('Включен режим отладки. Пробуем запуститься без initData', 'warn');
          this._logDebugInfo('Запуск в режиме отладки без initData');
          return await this.fallbackInitialization();
        } else {
          this._logDebugInfo('Ошибка: нет initData и нет режима отладки');
          return false;
        }
      } else {
        safeLog('initData получены из WebApp объекта');
        this._logDebugInfo('initData получены успешно');
        localStorage.setItem('tg_init_data', this.initData);
      }
      
      // Получаем данные пользователя
      if (this.tg.initDataUnsafe && this.tg.initDataUnsafe.user) {
        this.user = this.tg.initDataUnsafe.user;
        safeLog(`Данные пользователя получены: ${this.user.username || this.user.id}`);
        this._logDebugInfo(`Пользователь: ${this.user.username || this.user.id}`);
      } else {
        safeLog('Данные пользователя недоступны в initDataUnsafe', 'warn');
        this._logDebugInfo('Данные пользователя недоступны');
      }
      
      // Включаем кнопку назад в хедере Telegram
      this.setupBackButton();
      
      // Добавляем обработчик темы
      this.setupTheme();
      
      // Выводим информацию в консоль для отладки
      const debugInfo = {
        version: this.tg.version,
        platform: this.tg.platform,
        themeParams: this.tg.themeParams ? 'доступны' : 'недоступны',
        initData: this.initData ? `доступны (${this.initData.substr(0, 15)}...)` : 'недоступны',
        viewportHeight: this.tg.viewportHeight,
        viewportStableHeight: this.tg.viewportStableHeight,
        colorScheme: this.tg.colorScheme
      };
      
      safeLog('Telegram WebApp детальная информация:', 'info', debugInfo);
      this._logDebugInfo(`Детальная информация: ${JSON.stringify(debugInfo)}`);
      
      // Проверяем возможность аутентификации
      try {
        // Проверяем токен в localStorage
        const savedToken = localStorage.getItem('auth_token');
        if (savedToken) {
          safeLog('Найден сохраненный токен, проверяем валидность');
          this._logDebugInfo('Проверяем сохраненный токен');
          this.authToken = savedToken;
          const isValid = await this.validateToken(this.authToken);
          if (isValid) {
            safeLog('Токен валиден, аутентификация успешна');
            this._logDebugInfo('Токен валиден, аутентификация успешна');
            this.initialized = true;
            if (this.onInitComplete) this.onInitComplete();
            return true;
          }
          safeLog('Токен невалиден, требуется повторная аутентификация');
          this._logDebugInfo('Токен невалиден, повторная аутентификация');
        }
        
        // Если нет токена или он невалиден, аутентифицируемся заново
        safeLog('Выполняем аутентификацию с сервером...');
        this._logDebugInfo('Выполняем аутентификацию с сервером');
        const authResult = await this.authenticate();
        safeLog(`Результат аутентификации: ${authResult ? 'успешно' : 'неудача'}`);
        this._logDebugInfo(`Результат аутентификации: ${authResult ? 'успешно' : 'неудача'}`);
        
        this.initialized = authResult;
        if (authResult && this.onInitComplete) this.onInitComplete();
        return authResult;
      } catch (error) {
        safeLog(`Ошибка при аутентификации: ${error.message}`, 'error');
        this._logDebugInfo(`Ошибка при аутентификации: ${error.message}`);
        return false;
      }
    } catch (initError) {
      safeLog(`Критическая ошибка при инициализации TelegramService: ${initError.message}`, 'error');
      this._logDebugInfo(`Критическая ошибка: ${initError.message}`);
      
      // Показываем ошибку пользователю через DOM
      this._showErrorMessageDOM('Не удалось инициализировать Telegram приложение. Пожалуйста, попробуйте позже.');
      return false;
    }
  }
  
  /**
   * Внутренний метод отображения ошибки через DOM
   * Не использует uiService для избежания циклических зависимостей
   */
  _showErrorMessageDOM(message) {
    try {
      let errorElement = document.getElementById('error-message');
      
      if (!errorElement) {
        errorElement = document.createElement('div');
        errorElement.id = 'error-message';
        errorElement.style.position = 'fixed';
        errorElement.style.top = '50%';
        errorElement.style.left = '50%';
        errorElement.style.transform = 'translate(-50%, -50%)';
        errorElement.style.backgroundColor = '#f5222d';
        errorElement.style.color = 'white';
        errorElement.style.padding = '15px 20px';
        errorElement.style.borderRadius = '8px';
        errorElement.style.maxWidth = '80%';
        errorElement.style.textAlign = 'center';
        errorElement.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.15)';
        errorElement.style.zIndex = '10000';
        document.body.appendChild(errorElement);
      }
      
      errorElement.textContent = message;
      errorElement.style.display = 'block';
      
      // Скрываем загрузочный экран, если он есть
      const loadingScreen = document.getElementById('loading-screen');
      if (loadingScreen) {
        loadingScreen.style.display = 'none';
      }
    } catch (err) {
      // В случае ошибки, по крайней мере логируем в консоль
      console.error('Не удалось отобразить сообщение об ошибке через DOM:', err);
    }
  }
  
  /**
   * Проверка режима отладки
   */
  _isDebugMode() {
    return (
      window.debugMode === true ||
      localStorage.getItem('debug_mode') === 'true' ||
      process.env.NODE_ENV === 'development' ||
      window.location.hostname === 'localhost' ||
      window.location.search.includes('debug=true')
    );
  }
  
  /**
   * Логирование отладочной информации
   */
  _logDebugInfo(message) {
    try {
      if (!this._isDebugMode()) return;
      
      // Сохраняем лог в localStorage для возможности просмотра после сбоев
      const logs = JSON.parse(localStorage.getItem('tg_debug_logs') || '[]');
      logs.push({
        timestamp: new Date().toISOString(),
        message: message,
        userAgent: navigator.userAgent,
        url: window.location.href
      });
      
      // Ограничиваем количество логов
      if (logs.length > 100) {
        logs.shift(); // Удаляем самый старый лог
      }
      
      localStorage.setItem('tg_debug_logs', JSON.stringify(logs));
      
      // Добавляем в отладочную панель, если она есть
      const debugPanel = document.getElementById('debug-panel');
      if (debugPanel) {
        const logItem = document.createElement('div');
        logItem.className = 'debug-log-item';
        logItem.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
        debugPanel.appendChild(logItem);
        
        // Ограничиваем количество элементов
        if (debugPanel.children.length > 50) {
          debugPanel.removeChild(debugPanel.firstChild);
        }
        
        // Прокручиваем к последнему сообщению
        debugPanel.scrollTop = debugPanel.scrollHeight;
      }
    } catch (e) {
      // Игнорируем ошибки при логировании
      console.warn('Ошибка при логировании отладочной информации:', e);
    }
  }
  
  /**
   * Запасная инициализация для режима отладки
   */
  async fallbackInitialization() {
    try {
      safeLog('Запуск резервной инициализации для режима отладки');
      this._logDebugInfo('Резервная инициализация');
      
      // Создаем фиктивные данные пользователя
      this.user = {
        id: 123456789,
        first_name: 'Debug',
        last_name: 'User',
        username: 'debug_user',
        language_code: 'ru',
        isDebug: true
      };
      
      // Сохраняем пользователя в localStorage
      localStorage.setItem('debug_user', JSON.stringify(this.user));
      
      // Создаем отладочную панель для удобства тестирования
      this._createDebugPanel();
      
      // В режиме отладки можем эмулировать успешную аутентификацию
      this.authToken = 'debug_token_' + Date.now();
      localStorage.setItem('auth_token', this.authToken);
      
      this.initialized = true;
      if (this.onInitComplete) this.onInitComplete();
      
      safeLog('Резервная инициализация успешно завершена');
      this._logDebugInfo('Резервная инициализация успешна');
      return true;
    } catch (error) {
      safeLog(`Ошибка при резервной инициализации: ${error.message}`, 'error');
      this._logDebugInfo(`Ошибка при резервной инициализации: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Создает панель отладки в приложении
   * @private
   */
  _createDebugPanel() {
    try {
      // Проверяем валидность DOM
      if (!document || !document.body) {
        console.warn('DOM не готов для создания отладочной панели');
        return false;
      }
      
      // Проверяем, существует ли уже панель
      if (document.getElementById('debug-panel')) {
        return true;
      }
      
      // Создаем элементы отладочной панели
      const debugPanel = document.createElement('div');
      debugPanel.id = 'debug-panel';
      debugPanel.style.position = 'fixed';
      debugPanel.style.bottom = '0';
      debugPanel.style.left = '0';
      debugPanel.style.right = '0';
      debugPanel.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
      debugPanel.style.color = 'lime';
      debugPanel.style.fontSize = '12px';
      debugPanel.style.padding = '10px';
      debugPanel.style.maxHeight = '200px';
      debugPanel.style.overflow = 'auto';
      debugPanel.style.zIndex = '9999';
      debugPanel.style.borderTop = '1px solid lime';
      
      // Создаем заголовок
      const header = document.createElement('div');
      header.textContent = `• Версия: ${window.appVersion || '1.0'}`;
      header.style.marginBottom = '5px';
      debugPanel.appendChild(header);
      
      // Платформа
      const platform = document.createElement('div');
      platform.textContent = `• Платформа: ${window.Telegram?.WebApp?.platform || 'tdesktop'}`;
      debugPanel.appendChild(platform);
      
      // Размер экрана
      const viewport = document.createElement('div');
      viewport.textContent = `• Viewport высота: ${window.innerHeight}px`;
      debugPanel.appendChild(viewport);
      
      // initData
      const initData = document.createElement('div');
      const initDataText = this.initData ? 
        this.initData.substring(0, 50) + '...' : 
        'нет';
      initData.textContent = `• InitData: ${initDataText}`;
      debugPanel.appendChild(initData);
      
      // Контейнер для логов
      const logContainer = document.createElement('div');
      logContainer.id = 'debug-output';
      logContainer.style.marginTop = '10px';
      debugPanel.appendChild(logContainer);
      
      // Кнопка для скрытия/показа панели
      const toggleButton = document.createElement('button');
      toggleButton.textContent = 'Скрыть';
      toggleButton.style.position = 'absolute';
      toggleButton.style.top = '5px';
      toggleButton.style.right = '5px';
      toggleButton.style.background = 'transparent';
      toggleButton.style.border = '1px solid lime';
      toggleButton.style.color = 'lime';
      toggleButton.style.padding = '3px 6px';
      toggleButton.style.borderRadius = '3px';
      toggleButton.style.fontSize = '10px';
      
      let isPanelVisible = true;
      toggleButton.addEventListener('click', () => {
        if (isPanelVisible) {
          logContainer.style.display = 'none';
          debugPanel.style.maxHeight = '30px';
          toggleButton.textContent = 'Показать';
        } else {
          logContainer.style.display = 'block';
          debugPanel.style.maxHeight = '200px';
          toggleButton.textContent = 'Скрыть';
        }
        isPanelVisible = !isPanelVisible;
      });
      
      debugPanel.appendChild(toggleButton);
      
      // Добавляем панель в DOM
      document.body.appendChild(debugPanel);
      return true;
    } catch (error) {
      console.error('Ошибка при создании отладочной панели:', error);
      return false;
    }
  }
  
  /**
   * Настройка кнопки "Назад" в Telegram
   */
  setupBackButton() {
    if (!this.tg) return;
    
    // Получаем все экраны
    const screens = document.querySelectorAll('.screen');
    
    // Обработчик для кнопки назад от Telegram
    this.tg.onEvent('backButtonClicked', () => {
      // Находим текущий активный экран
      const activeScreen = document.querySelector('.screen.active');
      
      // Если это стартовый экран, закрываем приложение
      if (activeScreen.id === 'start-screen') {
        this.tg.close();
      } 
      // Если это экран результатов игры, возвращаемся на стартовый
      else if (activeScreen.id === 'game-result-screen') {
        document.getElementById('start-screen').classList.add('active');
        activeScreen.classList.remove('active');
      }
      // Если это игровой экран, спрашиваем о выходе
      else if (activeScreen.id === 'game-screen') {
        if (confirm('Вы уверены, что хотите выйти? Прогресс игры будет потерян.')) {
          document.getElementById('start-screen').classList.add('active');
          activeScreen.classList.remove('active');
        }
      }
      // В остальных случаях возвращаемся на стартовый экран
      else {
        document.getElementById('start-screen').classList.add('active');
        activeScreen.classList.remove('active');
      }
    });
    
    // Наблюдаем за видимостью экранов для управления кнопкой назад
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          const target = mutation.target;
          
          // Если экран стал активным
          if (target.classList.contains('active')) {
            // Скрываем кнопку на стартовом экране
            if (target.id === 'start-screen') {
              this.tg.BackButton.hide();
            } else {
              this.tg.BackButton.show();
            }
          }
        }
      }
    });
    
    // Настраиваем наблюдатель для всех экранов
    for (const screen of screens) {
      observer.observe(screen, { attributes: true });
    }
  }
  
  /**
   * Настройка темы из Telegram
   */
  setupTheme() {
    if (!this.tg || !this.tg.themeParams) return;
    
    // Импортируем UI сервис
    import('./uiService.js').then(module => {
      const uiService = new module.UiService();
      uiService.applyTheme(this.tg.themeParams);
    });
    
    // Обработчик изменения темы
    this.tg.onEvent('themeChanged', () => {
      import('./uiService.js').then(module => {
        const uiService = new module.UiService();
        uiService.applyTheme(this.tg.themeParams);
      });
    });
  }
  
  /**
   * Аутентификация через Telegram WebApp
   * @returns {Promise<boolean>} - Результат аутентификации
   */
  async authenticate() {
    try {
      if (!this.initData) {
        console.error('No initData available for authentication');
        
        // Проверяем наличие hash в localStorage
        const savedHash = localStorage.getItem('tg_hash');
        if (savedHash) {
          console.log('Найден сохраненный хеш авторизации, пробуем использовать его');
          // Если есть ранее сохраненный хеш, пробуем использовать его
          try {
            const response = await this.checkSessionWithHash(savedHash);
            if (response.success) {
              console.log('Успешно авторизовались с сохраненным хешем');
              this.authToken = response.token;
              localStorage.setItem('auth_token', response.token);
              if (response.user) {
                localStorage.setItem('user_data', JSON.stringify(response.user));
              }
              return true;
            }
          } catch (e) {
            console.warn('Ошибка при использовании сохраненного хеша:', e.message);
          }
        }
        
        // В режиме разработки используем тестовый режим
        if (localStorage.getItem('debug_mode') === 'true' || process.env.NODE_ENV === 'development') {
          console.warn('Using test mode for authentication in development');
          
          // Отправляем запрос на тестовую аутентификацию
          try {
            const response = await fetch(`${this.apiBaseUrl}/api/debug-login`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ debugMode: true })
            });
            
            if (!response.ok) {
              console.error('Debug login failed');
              return false;
            }
            
            const result = await response.json();
            
            if (result.success && result.token) {
              this.authToken = result.token;
              localStorage.setItem('auth_token', result.token);
              if (result.user) {
                localStorage.setItem('user_data', JSON.stringify(result.user));
              }
              return true;
            }
          } catch (e) {
            console.error('Error during debug login:', e.message);
          }
          
          return false;
        }
        
        return false;
      }
      
      // Определяем формат данных для отладки
      const params = new URLSearchParams(this.initData);
      const isWebAppFormat = params.has('hash');
      const isCallbackFormat = params.has('signature');
      console.log('Формат данных авторизации:', 
                  isWebAppFormat ? 'WebApp с hash' : 
                  (isCallbackFormat ? 'Callback Query с signature' : 'Неизвестный'));
      
      // Сохраняем initData для потенциального использования в других местах
      localStorage.setItem('tg_init_data', this.initData);
      
      // Для WebApp формата сохраняем hash отдельно для восстановления сессии
      if (isWebAppFormat) {
        const hash = params.get('hash');
        if (hash) {
          localStorage.setItem('tg_hash', hash);
        }
      }
      
      // Отправляем запрос на аутентификацию
      const response = await fetch(`${this.apiBaseUrl}/api/webapp/auth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ initData: this.initData })
      });
      
      if (!response.ok) {
        const error = await response.json();
        console.error('Authentication error:', error);
        
        // Логируем детали ошибки для отладки
        console.log('InitData type:', typeof this.initData);
        console.log('InitData первые 50 символов:', this.initData.substring(0, 50) + '...');
        
        // Дополнительная проверка для отладки
        try {
          console.log('Пробуем детальную проверку данных для диагностики...');
          const debugResponse = await fetch(`${this.apiBaseUrl}/api/webapp/validate-debug`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ initData: this.initData })
          });
          
          if (debugResponse.ok) {
            const debugResult = await debugResponse.json();
            console.log('Результат детальной проверки:', debugResult);
            
            // Показываем информативное сообщение об ошибке в режиме разработки
            if (process.env.NODE_ENV === 'development') {
              const errorMessage = debugResult.valid ? 
                'Данные валидны, но аутентификация не удалась' : 
                `Данные не валидны: ${JSON.stringify(debugResult.debugInfo)}`;
              this.showAlert(`Ошибка аутентификации: ${errorMessage}`);
            }
          }
        } catch (debugError) {
          console.error('Ошибка при детальной проверке:', debugError);
        }
        
        // В режиме отладки или с debug_mode пытаемся использовать debug-login
        if (localStorage.getItem('debug_mode') === 'true') {
          console.warn('Аутентификация через WebApp не удалась, пробуем режим отладки');
          
          try {
            const debugResponse = await fetch(`${this.apiBaseUrl}/api/debug-login`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              }
            });
            
            if (debugResponse.ok) {
              const debugResult = await debugResponse.json();
              
              if (debugResult.success && debugResult.token) {
                console.log('Успешно авторизовались через debug-login');
                this.authToken = debugResult.token;
                localStorage.setItem('auth_token', debugResult.token);
                if (debugResult.user) {
                  localStorage.setItem('user_data', JSON.stringify(debugResult.user));
                }
                return true;
              }
            }
          } catch (e) {
            console.error('Error during fallback debug login:', e.message);
          }
        }
        
        return false;
      }
      
      const result = await response.json();
      
      if (result.success && result.token) {
        // Сохраняем токен
        this.authToken = result.token;
        localStorage.setItem('auth_token', result.token);
        
        // Сохраняем данные пользователя при необходимости
        if (result.user) {
          localStorage.setItem('user_data', JSON.stringify(result.user));
        }
        
        console.log('Authentication successful');
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Authentication error:', error);
      return false;
    }
  }
  
  /**
   * Проверка сессии с использованием сохраненного хеша
   * @param {string} hash - Сохраненный хеш сессии
   * @returns {Promise<Object>} - Результат проверки
   */
  async checkSessionWithHash(hash) {
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/webapp/check-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ hash })
      });
      
      if (!response.ok) {
        throw new Error('Session check failed');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Session check error:', error);
      throw error;
    }
  }
  
  /**
   * Проверка валидности токена
   * @param {string} token - JWT токен для проверки
   * @returns {Promise<boolean>} - Результат проверки
   */
  async validateToken(token) {
    try {
      // Отправляем запрос для проверки токена
      const response = await fetch(`${this.apiBaseUrl}/api/user/profile`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      return response.ok;
    } catch (error) {
      console.error('Token validation error:', error);
      return false;
    }
  }
  
  /**
   * Получить заголовки для запросов к API с авторизацией
   * @returns {Object} - Заголовки для запросов
   */
  getAuthHeaders() {
    const headers = {
      'Content-Type': 'application/json'
    };
    
    // Добавляем токен аутентификации, если он есть
    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    } 
    // Или добавляем данные инициализации от Telegram
    else if (this.initData) {
      headers['Telegram-Data'] = this.initData;
    }
    
    return headers;
  }
  
  /**
   * Получение информации о пользователе
   * @returns {Object|null} - информация о пользователе
   */
  getUserInfo() {
    return this.user;
  }
  
  /**
   * Поделиться результатами в Telegram
   * @param {Object} results - результаты игры
   */
  shareResults(results) {
    if (!this.tg) return;
    
    const text = `🎮 Я сыграл в "Криминальный Блеф"!\n\n` +
      `✅ Правильных ответов: ${results.correctAnswers}/5\n` +
      `🔥 Лучшая серия: ${results.bestStreak}\n` +
      `💯 Набрано очков: ${results.totalScore}\n\n` +
      `Проверь свои детективные способности!`;
    
    this.tg.showPopup({
      title: 'Поделиться результатами',
      message: 'Поделиться своими результатами игры с друзьями?',
      buttons: [
        { id: 'share', type: 'default', text: 'Поделиться' },
        { id: 'cancel', type: 'cancel', text: 'Отмена' }
      ]
    }, (buttonId) => {
      if (buttonId === 'share') {
        this.tg.sendData(JSON.stringify({
          action: 'share_results',
          text: text
        }));
      }
    });
  }
  
  /**
   * Закрытие мини-приложения
   */
  close() {
    if (this.tg) {
      this.tg.close();
    }
  }
  
  /**
   * Показать всплывающее окно
   * @param {string} title - заголовок окна
   * @param {string} message - сообщение окна
   * @param {Array} buttons - массив кнопок
   * @param {Function} callback - функция обратного вызова
   */
  showPopup(title, message, buttons, callback) {
    if (!this.tg) return;
    
    this.tg.showPopup({
      title,
      message,
      buttons
    }, callback);
  }
  
  /**
   * Показать уведомление
   * @param {string} message - текст уведомления
   */
  showAlert(message) {
    if (!this.tg) return;
    
    this.tg.showAlert(message);
  }
  
  /**
   * Настроить кнопку основного действия
   * @param {string} text - текст кнопки
   * @param {Function} callback - функция обратного вызова
   * @param {boolean} isVisible - видимость кнопки
   * @param {boolean} isActive - активность кнопки
   */
  setupMainButton(text, callback, isVisible = true, isActive = true) {
    if (!this.tg || !this.tg.MainButton) return;
    
    // Настройка текста и цветов
    this.tg.MainButton.text = text;
    
    // Установка обработчика
    this.tg.MainButton.onClick(callback);
    
    // Настройка видимости и активности
    if (isVisible) {
      this.tg.MainButton.show();
    } else {
      this.tg.MainButton.hide();
    }
    
    if (isActive) {
      this.tg.MainButton.enable();
    } else {
      this.tg.MainButton.disable();
    }
  }
  
  /**
   * Получить конфигурацию WebApp с сервера
   * @returns {Promise<Object|null>} - Конфигурация WebApp
   */
  async getWebAppConfig() {
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/webapp/config`, {
        headers: this.getAuthHeaders()
      });
      
      if (!response.ok) {
        throw new Error('Failed to get WebApp config');
      }
      
      const data = await response.json();
      return data.config;
    } catch (error) {
      console.error('Error getting WebApp config:', error);
      return null;
    }
  }
}

// Экспортируем сервис как синглтон для унификации с другими сервисами
export const telegramService = _instance || new TelegramService(); 