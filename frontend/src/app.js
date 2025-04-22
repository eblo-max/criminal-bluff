/**
 * Криминальный Блеф - Telegram Mini App
 * Основной JavaScript файл
 */

// Импорт модулей и сервисов
import { ApiService } from './services/apiService.js';
import { GameService } from './services/gameService.js';
import { UiService } from './services/uiService.js';
import { TelegramService, initTelegram, getTelegramUser } from './services/telegramService.js';
import * as sentryService from './services/sentryService.js';

// Импорт компонентов
import StartScreen from './components/StartScreen.js';
import GameScreen from './components/GameScreen.js';
import ResultScreen from './components/ResultScreen.js';
import ProfileScreen from './components/ProfileScreen.js';
import LeaderboardScreen from './components/LeaderboardScreen.js';
import SentryTest from './components/SentryTest.js';

// Глобальная конфигурация для режима отладки
window.appVersion = '1.1.0'; // Увеличиваем версию для отслеживания обновлений
window.debugMode = localStorage.getItem('debug_mode') === 'true' || 
                  process.env.NODE_ENV === 'development' || 
                  window.location.hostname === 'localhost' ||
                  window.location.search.includes('debug=true');

class App {
  constructor() {
    this.currentScreen = null;
    this.screens = {};
    this.isInitialized = false;
    this.isStarted = false;
    
    // Инициализируем сервисы
    this.apiService = new ApiService();
    this.uiService = new UiService();
    this.gameService = new GameService(this.apiService, this.uiService);
    this.telegramService = new TelegramService();

    // Инициализируем приложение только после полной загрузки DOM
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.init());
      } else {
      // DOM уже загружен
      this.init();
    }
  }

  init() {
    try {
      console.log('Инициализация приложения...');
      
      // Проверяем наличие основных DOM элементов
      const mainAppContainer = document.getElementById('app');
      if (!mainAppContainer) {
        throw new Error('Ошибка: Не найден контейнер приложения #app');
      }

      // Инициализируем Sentry для отслеживания ошибок
      sentryService.initSentry(); // Используем sentryService как единственный сервис мониторинга
      
      // Инициализируем Telegram WebApp
      initTelegram()
        .then(() => {
          console.log('Telegram WebApp успешно инициализирован');
          // Обновляем контекст пользователя Telegram в Sentry
          const telegramUser = getTelegramUser();
          if (telegramUser) {
            sentryService.setUserContext(telegramUser);
          }
          
          this.initScreens();
          this.isInitialized = true;
          
          // Показываем стартовый экран
          this.showScreen('start');
          this.isStarted = true;
    })
    .catch(error => {
          console.error('Ошибка при инициализации Telegram WebApp:', error);
          sentryService.captureException(error);
          this.showErrorMessage('Не удалось инициализировать Telegram WebApp. Пожалуйста, попробуйте позже.');
        });
    } catch (error) {
      console.error('Критическая ошибка при инициализации приложения:', error);
      sentryService.captureException(error);
      this.showErrorMessage('Критическая ошибка при запуске приложения.');
    }
  }

  initScreens() {
    try {
      console.log('Инициализация экранов приложения...');
      
      // Инициализируем компоненты экранов с правильными параметрами
      this.screens = {
        start: new StartScreen(this.telegramService),
        game: new GameScreen(this.gameService, this.uiService),
        result: new ResultScreen(this.telegramService),
        profile: new ProfileScreen(this.apiService, this.uiService, this.telegramService),
        leaderboard: new LeaderboardScreen(this.apiService, this.uiService),
        sentryTest: new SentryTest()
      };
      
      // Проверяем, что все экраны успешно созданы
      Object.entries(this.screens).forEach(([name, screen]) => {
        if (!screen) {
          console.error(`Не удалось инициализировать экран: ${name}`);
        }
      });
      
      console.log('Все экраны успешно инициализированы');
    } catch (error) {
      console.error('Ошибка при инициализации экранов:', error);
      sentryService.captureException(error);
      this.showErrorMessage('Ошибка при инициализации интерфейса приложения.');
    }
  }

  showScreen(screenName) {
    try {
      if (!this.isInitialized) {
        console.warn('Попытка показать экран до инициализации приложения');
        return;
      }
      
      const screen = this.screens[screenName];
      if (!screen) {
        throw new Error(`Экран "${screenName}" не найден`);
      }
      
      // Скрываем текущий экран, если он есть
      if (this.currentScreen) {
        const currentScreenElement = document.getElementById(`${this.currentScreen.name}-screen`);
        if (currentScreenElement) {
          currentScreenElement.style.display = 'none';
        }
      }
      
      // Показываем новый экран
      const newScreenElement = document.getElementById(`${screenName}-screen`);
      if (!newScreenElement) {
        throw new Error(`DOM элемент для экрана "${screenName}" не найден`);
      }
      
      newScreenElement.style.display = 'block';
      this.currentScreen = screen;
      
      // Добавляем имя экрана в объект для отображения в DOM
      this.currentScreen.name = screenName;
      
      // Инициализируем экран, если он ещё не инициализирован
      if (!screen.initialized) {
        screen.init();
      }
      
      console.log(`Показан экран: ${screenName}`);
    } catch (error) {
      console.error(`Ошибка при показе экрана ${screenName}:`, error);
      sentryService.captureException(error);
      this.showErrorMessage('Ошибка при переключении экрана.');
    }
  }

  showErrorMessage(message) {
    try {
      // Пытаемся найти или создать элемент для сообщения об ошибке
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
      
      // Устанавливаем текст сообщения и показываем его
      errorElement.textContent = message;
      errorElement.style.display = 'block';
      
      // Скрываем загрузочный экран, если он есть
      const splashScreen = document.querySelector('.splash-screen');
      if (splashScreen) {
        splashScreen.style.display = 'none';
      }
      
      console.error('Отображено сообщение об ошибке:', message);
    } catch (err) {
      // В случае ошибки при отображении ошибки, логируем это в консоль
      console.error('Не удалось отобразить сообщение об ошибке:', err);
      sentryService.captureException(err);
    }
  }
}

// Создаем и экспортируем экземпляр приложения
const app = new App();
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