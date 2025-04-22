/**
 * Telegram Service
 * Сервис для взаимодействия с API Telegram Mini Apps
 */
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
  }
  
  /**
   * Инициализация сервиса
   */
  async init() {
    console.log('Starting Telegram WebApp initialization...');
    
    // Проверяем наличие объекта Telegram.WebApp
    if (!this.tg) {
      console.error('ОШИБКА: Telegram WebApp объект недоступен');
      console.log('window.Telegram:', window.Telegram ? 'доступен' : 'недоступен');
      
      // Специальный режим для отладки
      if (localStorage.getItem('debug_mode') || process.env.NODE_ENV === 'development') {
        console.warn('Включен режим отладки. Пробуем запуститься без WebApp');
        return this.fallbackInitialization();
      }
      return false;
    }
    
    console.log('Telegram WebApp объект найден, версия:', this.tg.version);
    
    // Расширяем окно приложения на всю высоту
    this.tg.expand();
    
    // Сохраняем initData для потенциального использования в других местах
    this.initData = this.tg.initData || '';
    if (!this.initData) {
      console.error('ОШИБКА: initData не доступны в WebApp объекте');
      console.log('initDataUnsafe:', this.tg.initDataUnsafe ? 'доступны' : 'недоступны');
      
      // Пробуем получить из localStorage (если был сохранен ранее)
      const savedInitData = localStorage.getItem('tg_init_data');
      if (savedInitData) {
        console.log('Используем сохраненные initData из localStorage');
        this.initData = savedInitData;
      } else if (localStorage.getItem('debug_mode') || process.env.NODE_ENV === 'development') {
        console.warn('Включен режим отладки. Пробуем запуститься без initData');
        return this.fallbackInitialization();
      } else {
        return false;
      }
    } else {
      console.log('initData получены из WebApp объекта');
      localStorage.setItem('tg_init_data', this.initData);
    }
    
    // Получаем данные пользователя
    if (this.tg.initDataUnsafe && this.tg.initDataUnsafe.user) {
      this.user = this.tg.initDataUnsafe.user;
      console.log('Данные пользователя получены:', this.user.username || this.user.id);
    } else {
      console.warn('Данные пользователя недоступны в initDataUnsafe');
    }
    
    // Включаем кнопку назад в хедере Telegram
    this.setupBackButton();
    
    // Добавляем обработчик темы
    this.setupTheme();
    
    // Выводим информацию в консоль для отладки
    console.log('Telegram WebApp детальная информация:', {
      version: this.tg.version,
      platform: this.tg.platform,
      themeParams: this.tg.themeParams ? 'доступны' : 'недоступны',
      initData: this.initData ? `доступны (${this.initData.substr(0, 30)}...)` : 'недоступны',
      viewportHeight: this.tg.viewportHeight,
      viewportStableHeight: this.tg.viewportStableHeight,
      colorScheme: this.tg.colorScheme
    });
    
    // Проверяем возможность аутентификации
    try {
      // Проверяем токен в localStorage
      const savedToken = localStorage.getItem('auth_token');
      if (savedToken) {
        console.log('Найден сохраненный токен, проверяем валидность');
        this.authToken = savedToken;
        const isValid = await this.validateToken(this.authToken);
        if (isValid) {
          console.log('Токен валиден, аутентификация успешна');
          return true;
        }
        console.log('Токен невалиден, требуется повторная аутентификация');
      }
      
      // Если нет токена или он невалиден, аутентифицируемся заново
      console.log('Выполняем аутентификацию с сервером...');
      const authResult = await this.authenticate();
      console.log('Результат аутентификации:', authResult ? 'успешно' : 'неудача');
      return authResult;
    } catch (error) {
      console.error('Ошибка при аутентификации:', error.message);
      return false;
    }
  }
  
  /**
   * Резервная инициализация для режима отладки
   */
  async fallbackInitialization() {
    console.warn('Используется резервная инициализация для отладки');
    
    // Пробуем выполнить отладочный вход
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/debug-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) {
        console.error('Ошибка отладочного входа:', await response.text());
        return false;
      }
      
      const result = await response.json();
      
      if (result.success && result.token) {
        this.authToken = result.token;
        localStorage.setItem('auth_token', result.token);
        if (result.user) {
          localStorage.setItem('user_data', JSON.stringify(result.user));
        }
        console.log('Отладочный вход выполнен успешно');
        return true;
      }
      
      console.error('Отладочный вход не вернул валидные данные');
      return false;
    } catch (error) {
      console.error('Ошибка при отладочном входе:', error.message);
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