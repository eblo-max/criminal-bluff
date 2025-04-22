/**
 * Криминальный Блеф - Telegram Mini App
 * Основной JavaScript файл
 */

import React, { Component } from 'react';
import './app.css';
import { sharedState } from './services/common';
import { telegramService } from './services/telegramService';
import { uiService } from './services/uiService';
import { sentryService } from './services/sentryService';
import { gameService } from './services/gameService';
import { apiService } from './services/apiService';

// Импорт компонентов
import StartScreen from './components/StartScreen.js';
import GameScreen from './components/GameScreen.js';
import ResultScreen from './components/ResultScreen.js';
import ProfileScreen from './components/ProfileScreen.js';
import LeaderboardScreen from './components/LeaderboardScreen.js';

// Глобальная конфигурация для режима отладки
window.appVersion = '1.1.0'; // Увеличиваем версию для отслеживания обновлений
window.debugMode = localStorage.getItem('debug_mode') === 'true' || 
                  process.env.NODE_ENV === 'development' || 
                  window.location.hostname === 'localhost' ||
                  window.location.search.includes('debug=true');

// Расширенное логирование состояния
console.log('App initialization starting...');
console.log('Telegram WebApp available:', !!window.Telegram?.WebApp);
console.log('Window dimensions:', window.innerWidth, 'x', window.innerHeight);
console.log('DOM ready state:', document.readyState);

/**
 * Главный класс приложения
 */
class App extends Component {
  constructor(props) {
    super(props);
    
    // Инициализация состояния приложения
    this.state = {
      initialized: false,
      currentScreen: null,
      error: null
    };
    
    // Привязываем методы к контексту класса
    this.initApp = this.initApp.bind(this);
    this.handleError = this.handleError.bind(this);
    this.screens = {};
  }
  
  /**
   * После монтирования компонента запускаем инициализацию
   */
  componentDidMount() {
    try {
      sharedState.log('App.componentDidMount вызван');
      
      // Начинаем транзакцию для отслеживания производительности
      const transaction = sentryService.startTransaction({
        name: 'app-initialization',
        op: 'initialization'
      });
      
      // Инициализируем приложение
      this.initApp();
      
      // Завершаем транзакцию после инициализации
      setTimeout(() => {
        transaction.finish();
      }, 1000);
    } catch (error) {
      this.handleError(error, 'App.componentDidMount');
    }
  }
  
  /**
   * Установить состояние приложения
   * @param {Object} newState - Новые значения состояния
   */
  setState(newState) {
    this.state = { ...this.state, ...newState };
  }
  
  /**
   * Инициализация приложения
   */
  async initApp() {
    try {
      sharedState.log('Начинаем инициализацию приложения', 'info');
      
      // Проверяем, инициализировано ли уже приложение
      if (this.state.initialized) {
        sharedState.log('Приложение уже инициализировано', 'warn');
        return true;
      }
      
      // Начинаем транзакцию для мониторинга производительности
      const transaction = sentryService.startTransaction({
        name: 'app.init',
        op: 'initialization'
      });
      
      // Инициализируем все необходимые сервисы
      await this.initServices();
      
      // Инициализируем экраны
      this.initScreens();
      
      // Добавляем обработчики ошибок
      this.initErrorHandlers();
      
      this.setState({ initialized: true });
      sharedState.isAppInitialized = true;
      sharedState.log('Инициализация приложения завершена успешно', 'info');
      
      transaction.setStatus('ok');
      transaction.finish();
      
      return true;
    } catch (error) {
      this.handleError(error, 'app.initApp');
      return false;
    }
  }
  
  /**
   * Инициализация всех сервисов
   */
  async initServices() {
    try {
      // Инициализируем логирование
      sentryService.initSentry();
      sharedState.log('Логирование инициализировано', 'info');

      // Инициализируем Telegram сервис
      await telegramService.init();
      sharedState.log('Telegram сервис инициализирован', 'info');
      
      // Инициализируем API сервис
      await apiService.init();
      sharedState.log('API сервис инициализирован', 'info');
      
      // Инициализируем UI сервис
      uiService.init();
      sharedState.log('UI сервис инициализирован', 'info');
      
      // Инициализируем игровой сервис
      gameService.init(apiService, uiService);
      sharedState.log('Game сервис инициализирован', 'info');
      
      return true;
    } catch (error) {
      throw new Error(`Ошибка при инициализации сервисов: ${error.message}`);
    }
  }
  
  /**
   * Инициализация экранов приложения
   */
  initScreens() {
    try {
      sharedState.log('Инициализация экранов', 'info');
      
      // Находим все экраны
      const screenElements = document.querySelectorAll('.screen');
      if (!screenElements || screenElements.length === 0) {
        sharedState.log('Не найдены элементы экранов на странице', 'error');
        return;
      }
      
      // Сохраняем ссылки на экраны
      this.screens = {};
      screenElements.forEach(screen => {
        const id = screen.id;
        if (id) {
          this.screens[id] = screen;
        }
      });
      
      // Скрываем все экраны, кроме загрузочного
      this.hideAllScreens();
      
      // Показываем начальный экран (обычно загрузочный)
      const loadingScreen = this.screens['loading-screen'];
      if (loadingScreen) {
        loadingScreen.classList.remove('hidden');
        this.setState({ currentScreen: 'loading-screen' });
      }
      
      return true;
    } catch (error) {
      throw new Error(`Ошибка при инициализации экранов: ${error.message}`);
    }
  }
  
  /**
   * Инициализация обработчиков ошибок
   */
  initErrorHandlers() {
    // Перехватываем необработанные ошибки
    window.addEventListener('error', event => {
      const error = event.error || new Error(event.message);
      sharedState.log(`Необработанная ошибка: ${error.message}`, 'error');
      sentryService.captureException(error);
      this.handleError(error, 'app.initErrorHandlers');
    });

    // Перехватываем необработанные Promise rejection
    window.addEventListener('unhandledrejection', event => {
      const error = event.reason || new Error('Unhandled Promise rejection');
      sharedState.log(`Необработанный Promise rejection: ${error.message}`, 'error');
      sentryService.captureException(error);
    });
  }
  
  /**
   * Скрыть все экраны
   */
  hideAllScreens() {
    Object.values(this.screens).forEach(screen => {
      if (screen) {
        screen.classList.add('hidden');
      }
    });
  }
  
  /**
   * Показать экран по ID
   * @param {string} screenId - ID экрана для отображения
   */
  showScreen(screenId) {
    const screen = this.screens[screenId];
    if (!screen) {
      sharedState.log(`Экран с ID ${screenId} не найден`, 'error');
      return false;
    }

    try {
      // Скрываем текущий экран
      this.hideAllScreens();

      // Показываем новый экран
      screen.classList.remove('hidden');
      this.setState({ currentScreen: screenId });

      sharedState.log(`Отображен экран: ${screenId}`, 'info');
      return true;
    } catch (error) {
      sharedState.log(`Ошибка при отображении экрана ${screenId}: ${error.message}`, 'error');
      sentryService.captureException(error);
      return false;
    }
  }
  
  /**
   * Обработка ошибок приложения
   * @param {Error} error - Объект ошибки
   * @param {string} source - Источник ошибки
   */
  handleError(error, source) {
    sharedState.log(`Ошибка [${source}]: ${error.message}`, 'error');
    sentryService.captureException(error, { source });
    
    // Показываем сообщение об ошибке пользователю
    sharedState.safelyManipulateDOM(() => {
      const errorElement = document.getElementById('error-message');
      if (errorElement) {
        errorElement.textContent = 'Произошла ошибка при загрузке приложения. Пожалуйста, попробуйте обновить страницу.';
        errorElement.classList.remove('hidden');
      }
    });
  }
  
  /**
   * Рендеринг компонента
   */
  render() {
    // Если произошла ошибка, показываем сообщение об ошибке
    if (this.state.error) {
      return (
        <div className="app-error">
          <h2>Произошла ошибка</h2>
          <p>{this.state.error}</p>
          <button onClick={() => window.location.reload()}>
            Перезагрузить приложение
          </button>
        </div>
      );
    }
    
    // Основной интерфейс приложения
    return (
      <div className="app">
        {/* Контейнер для всего приложения */}
        <div id="app-container">
          {/* Контейнер для отображения текущего экрана */}
          <div id="screen-container">
            {/* Экраны будут загружаться динамически через UI сервис */}
          </div>
        </div>
      </div>
    );
  }
}

// Создаем экземпляр приложения
const app = new App();

// Инициализируем приложение при загрузке DOM
document.addEventListener('DOMContentLoaded', async () => {
  try {
    await app.initApp();
    
    // После инициализации переходим на главный экран
    setTimeout(() => {
      app.showScreen('welcome');
    }, 1000);
  } catch (error) {
    sharedState.log(`Ошибка при инициализации: ${error.message}`, 'error');
    sentryService.captureException(error);
  }
});

// Экспортируем приложение для доступа из других модулей
export default app;

/**
 * Вспомогательная функция для создания SVG логотипа
 * @returns {HTMLElement} - DOM элемент с SVG логотипом
 */
function createLogoSVG() {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", "120");
  svg.setAttribute("height", "120");
  svg.setAttribute("viewBox", "0 0 120 120");
  svg.setAttribute("fill", "none");
  
  // Здесь будет добавление элементов SVG логотипа
  // Упрощенный вариант для прототипа
  
  return svg;
}

/**
 * Создает заглушку логотипа, если SVG недоступен
 * @returns {HTMLElement} - DOM элемент с заглушкой логотипа
 */
function createMockLogo() {
  const mockLogo = document.createElement("div");
  mockLogo.textContent = "CRIMINAL BLUFF";
  mockLogo.style.fontWeight = "bold";
  mockLogo.style.fontSize = "20px";
  mockLogo.style.marginBottom = "20px";
  
  return mockLogo;
} 