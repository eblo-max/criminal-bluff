/**
 * Telegram Service
 * Сервис для взаимодействия с API Telegram Mini Apps
 */

// Singleton для хранения и предотвращения повторной инициализации
let _instance = null;
let _telegramUser = null;
let _telegramInitialized = false;

/**
 * Инициализация Telegram WebApp
 * @returns {Promise<boolean>} - Результат инициализации
 */
export async function initTelegram() {
  try {
    // Если уже инициализирован, возвращаем положительный результат
    if (_telegramInitialized) {
      console.log('Telegram WebApp уже был инициализирован ранее');
      return true;
    }
    
    // Создаем экземпляр сервиса, если он еще не был создан
    if (!_instance) {
      _instance = new TelegramService();
    }
    
    // Выполняем инициализацию
    const result = await _instance.init();
    
    if (result) {
      // Сохраняем пользователя после успешной инициализации
      _telegramUser = _instance.user;
      _telegramInitialized = true;
      
      console.log('Telegram WebApp успешно инициализирован');
      return true;
    }
    
    console.error('Не удалось инициализировать Telegram WebApp');
    return false;
  } catch (error) {
    console.error('Ошибка при инициализации Telegram WebApp:', error);
    return false;
  }
}

/**
 * Получение данных пользователя Telegram
 * @returns {Object|null} - Объект с данными пользователя или null
 */
export function getTelegramUser() {
  // Если инициализация не была выполнена, возвращаем null
  if (!_telegramInitialized) {
    console.warn('Попытка получить пользователя Telegram до инициализации');
    return null;
  }
  
  return _telegramUser;
}

/**
 * Получение экземпляра сервиса Telegram
 * @returns {TelegramService|null} - Экземпляр TelegramService или null
 */
export function getTelegramService() {
  return _instance;
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
  }
  
  /**
   * Инициализация сервиса
   */
  async init() {
    try {
      console.log('Starting Telegram WebApp initialization...');
      
      // Запись отладочной информации
      this._logDebugInfo('Начало инициализации');
      
      // Проверяем наличие объекта Telegram.WebApp
      if (!this.tg) {
        console.error('ОШИБКА: Telegram WebApp объект недоступен');
        this._logDebugInfo('Telegram WebApp объект недоступен');
        
        // Проверяем наличие window.Telegram
        if (window.Telegram) {
          console.log('window.Telegram есть, но WebApp отсутствует');
          this._logDebugInfo('window.Telegram есть, но WebApp отсутствует');
        }
        
        // Специальный режим для отладки
        if (this._isDebugMode()) {
          console.warn('Включен режим отладки. Пробуем запуститься без WebApp');
          this._logDebugInfo('Пробуем запуститься в режиме отладки');
          return await this.fallbackInitialization();
        }
        
        this._logDebugInfo('Инициализация не удалась: WebApp недоступен');
        return false;
      }
      
      console.log('Telegram WebApp объект найден, версия:', this.tg.version);
      this._logDebugInfo(`WebApp версия: ${this.tg.version}, платформа: ${this.tg.platform}`);
      
      // Расширяем окно приложения на всю высоту
      try {
        this.tg.expand();
      } catch (expandError) {
        console.warn('Не удалось расширить окно WebApp:', expandError);
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
          console.log('Создан initData из initDataUnsafe');
          this._logDebugInfo('Создан initData из initDataUnsafe');
        } catch (dataError) {
          console.error('Ошибка при создании initData из initDataUnsafe:', dataError);
          this._logDebugInfo(`Ошибка при создании initData: ${dataError.message}`);
        }
      }
      
      if (!this.initData) {
        console.error('ОШИБКА: initData не доступны в WebApp объекте');
        this._logDebugInfo('initData не доступны в WebApp объекте');
        
        // Пробуем получить из localStorage (если был сохранен ранее)
        const savedInitData = localStorage.getItem('tg_init_data');
        if (savedInitData) {
          console.log('Используем сохраненные initData из localStorage');
          this._logDebugInfo('Используем сохраненные initData из localStorage');
          this.initData = savedInitData;
        } else if (this._isDebugMode()) {
          console.warn('Включен режим отладки. Пробуем запуститься без initData');
          this._logDebugInfo('Запуск в режиме отладки без initData');
          return await this.fallbackInitialization();
        } else {
          this._logDebugInfo('Ошибка: нет initData и нет режима отладки');
          return false;
        }
      } else {
        console.log('initData получены из WebApp объекта');
        this._logDebugInfo('initData получены успешно');
        localStorage.setItem('tg_init_data', this.initData);
      }
      
      // Получаем данные пользователя
      if (this.tg.initDataUnsafe && this.tg.initDataUnsafe.user) {
        this.user = this.tg.initDataUnsafe.user;
        console.log('Данные пользователя получены:', this.user.username || this.user.id);
        this._logDebugInfo(`Пользователь: ${this.user.username || this.user.id}`);
      } else {
        console.warn('Данные пользователя недоступны в initDataUnsafe');
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
      
      console.log('Telegram WebApp детальная информация:', debugInfo);
      this._logDebugInfo(`Детальная информация: ${JSON.stringify(debugInfo)}`);
      
      // Проверяем возможность аутентификации
      try {
        // Проверяем токен в localStorage
        const savedToken = localStorage.getItem('auth_token');
        if (savedToken) {
          console.log('Найден сохраненный токен, проверяем валидность');
          this._logDebugInfo('Проверяем сохраненный токен');
          this.authToken = savedToken;
          const isValid = await this.validateToken(this.authToken);
          if (isValid) {
            console.log('Токен валиден, аутентификация успешна');
            this._logDebugInfo('Токен валиден, аутентификация успешна');
            this.initialized = true;
            if (this.onInitComplete) this.onInitComplete();
            return true;
          }
          console.log('Токен невалиден, требуется повторная аутентификация');
          this._logDebugInfo('Токен невалиден, повторная аутентификация');
        }
        
        // Если нет токена или он невалиден, аутентифицируемся заново
        console.log('Выполняем аутентификацию с сервером...');
        this._logDebugInfo('Выполняем аутентификацию с сервером');
        const authResult = await this.authenticate();
        console.log('Результат аутентификации:', authResult ? 'успешно' : 'неудача');
        this._logDebugInfo(`Результат аутентификации: ${authResult ? 'успешно' : 'неудача'}`);
        
        this.initialized = authResult;
        if (authResult && this.onInitComplete) this.onInitComplete();
        return authResult;
      } catch (error) {
        console.error('Ошибка при аутентификации:', error.message);
        this._logDebugInfo(`Ошибка при аутентификации: ${error.message}`);
        return false;
      }
    } catch (initError) {
      console.error('Критическая ошибка при инициализации TelegramService:', initError);
      this._logDebugInfo(`Критическая ошибка: ${initError.message}`);
      
      // В режиме отладки пробуем запуститься без инициализации Telegram
      if (this._isDebugMode()) {
        console.warn('Попытка резервной инициализации после ошибки');
        return await this.fallbackInitialization();
      }
      
      return false;
    }
  }
  
  /**
   * Проверка режима отладки
   * @private
   */
  _isDebugMode() {
    return localStorage.getItem('debug_mode') === 'true' || 
           process.env.NODE_ENV === 'development' || 
           window.location.hostname === 'localhost' ||
           window.location.search.includes('debug=true');
  }

  /**
   * Запись отладочной информации
   * @private
   */
  _logDebugInfo(message) {
    try {
      // Сначала логируем в консоль всегда
      console.log(`[DEBUG] ${message}`);
      
      // Добавляем запись в HTML элемент для отладки только если он существует
      const debugElement = document.getElementById('debug-output');
      if (debugElement) {
        const timestamp = new Date().toISOString();
        const logItem = document.createElement('div');
        logItem.textContent = `• ${timestamp}: ${message}`;
        logItem.style.color = 'lime';
        logItem.style.fontSize = '12px';
        logItem.style.marginBottom = '4px';
        debugElement.appendChild(logItem);
      }
      
      // Сохраняем логи в localStorage
      try {
        // Получаем существующие логи
        let logs = [];
        const savedLogs = localStorage.getItem('debug_logs');
        if (savedLogs) {
          logs = JSON.parse(savedLogs);
        }
        
        // Добавляем новую запись
        logs.push({
          time: new Date().toISOString(),
          message: message
        });
        
        // Ограничиваем количество логов
        if (logs.length > 50) {
          logs = logs.slice(logs.length - 50);
        }
        
        // Сохраняем обновленные логи
        localStorage.setItem('debug_logs', JSON.stringify(logs));
      } catch (storerError) {
        console.warn('Не удалось сохранить логи в localStorage:', storerError);
      }
    } catch (error) {
      console.error('Ошибка при логировании:', error);
    }
  }
  
  /**
   * Резервная инициализация для режима отладки
   */
  async fallbackInitialization() {
    console.warn('Используется резервная инициализация для отладки');
    this._logDebugInfo('Используется резервная инициализация');
    
    // Создаем и добавляем отладочную панель, если ее еще нет
    this._createDebugPanel();
    
    // Пробуем выполнить отладочный вход
    try {
      // Пробуем использовать сохраненный токен для отладки сначала
      const debugToken = localStorage.getItem('debug_token');
      if (debugToken) {
        console.log('Используем сохраненный отладочный токен');
        this._logDebugInfo('Используем сохраненный отладочный токен');
        this.authToken = debugToken;
        localStorage.setItem('auth_token', debugToken);
        this.initialized = true;
        if (this.onInitComplete) this.onInitComplete();
        return true;
      }
      
      // Если нет сохраненного токена, запрашиваем новый
      const apiUrl = this.apiBaseUrl || window.location.origin;
      const response = await fetch(`${apiUrl}/api/debug-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Ошибка отладочного входа:', errorText);
        this._logDebugInfo(`Ошибка отладочного входа: ${errorText}`);
        
        // Проверяем наличие альтернативных путей
        if (this._isDebugMode()) {
          console.warn('Продолжаем без аутентификации в режиме разработки');
          this._logDebugInfo('Продолжаем без аутентификации в режиме разработки');
          
          // Создаем фиктивные данные для отладки
          this.user = {
            id: 123456789,
            username: 'debug_user',
            first_name: 'Debug',
            last_name: 'User'
          };
          
          this.initialized = true;
          if (this.onInitComplete) this.onInitComplete();
          return true;
        }
        
        return false;
      }
      
      const result = await response.json();
      
      if (result.success && result.token) {
        this.authToken = result.token;
        localStorage.setItem('auth_token', result.token);
        localStorage.setItem('debug_token', result.token);
        
        if (result.user) {
          this.user = result.user;
          localStorage.setItem('user_data', JSON.stringify(result.user));
        }
        
        console.log('Отладочный вход выполнен успешно');
        this._logDebugInfo('Отладочный вход выполнен успешно');
        
        this.initialized = true;
        if (this.onInitComplete) this.onInitComplete();
        return true;
      }
      
      console.error('Отладочный вход не вернул валидные данные');
      this._logDebugInfo('Отладочный вход не вернул валидные данные');
      
      // В режиме разработки продолжаем без аутентификации
      if (this._isDebugMode()) {
        console.warn('Продолжаем без токена в режиме разработки');
        this._logDebugInfo('Продолжаем без токена в режиме разработки');
        this.initialized = true;
        if (this.onInitComplete) this.onInitComplete();
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Ошибка при отладочном входе:', error.message);
      this._logDebugInfo(`Ошибка при отладочном входе: ${error.message}`);
      
      // В режиме разработки продолжаем даже при ошибке
      if (this._isDebugMode()) {
        console.warn('Продолжаем после ошибки в режиме разработки');
        this._logDebugInfo('Продолжаем после ошибки в режиме разработки');
        this.initialized = true;
        if (this.onInitComplete) this.onInitComplete();
        return true;
      }
      
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