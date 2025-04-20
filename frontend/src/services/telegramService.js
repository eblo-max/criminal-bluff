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
    if (!this.tg) {
      console.warn('Telegram WebApp is not available');
      return false;
    }
    
    // Расширяем окно приложения на всю высоту
    this.tg.expand();
    
    // Получаем данные пользователя
    if (this.tg.initDataUnsafe && this.tg.initDataUnsafe.user) {
      this.user = this.tg.initDataUnsafe.user;
    }
    
    // Включаем кнопку назад в хедере Telegram
    this.setupBackButton();
    
    // Добавляем обработчик темы
    this.setupTheme();
    
    // Выводим информацию в консоль для отладки
    if (process.env.NODE_ENV !== 'production') {
      console.log('Telegram WebApp initialized:', {
        version: this.tg.version,
        platform: this.tg.platform,
        themeParams: this.tg.themeParams,
        initData: this.tg.initData ? 'available' : 'not available'
      });
    }
    
    // Проверяем возможность аутентификации
    if (this.initData) {
      try {
        // Проверяем токен в localStorage
        if (this.authToken) {
          // Проверяем, валиден ли существующий токен
          const isValid = await this.validateToken(this.authToken);
          if (isValid) {
            return true;
          }
        }
        
        // Если нет токена или он невалиден, аутентифицируемся заново
        const authResult = await this.authenticate();
        return authResult;
      } catch (error) {
        console.error('Error during authentication:', error);
        return false;
      }
    }
    
    return true;
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
        return false;
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
        
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Authentication error:', error);
      return false;
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