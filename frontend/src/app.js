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

// Расширенное логирование состояния
console.log('App initialization starting...');
console.log('Telegram WebApp available:', !!window.Telegram?.WebApp);
console.log('Window dimensions:', window.innerWidth, 'x', window.innerHeight);
console.log('DOM ready state:', document.readyState);

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
      document.addEventListener('DOMContentLoaded', () => {
        console.log('DOMContentLoaded event fired, initializing app');
        this.init();
      });
    } else {
      // DOM уже загружен
      console.log('DOM already loaded, initializing app directly');
      this.init();
    }
  }

  init() {
    try {
      console.log('Инициализация приложения...');
      
      // Проверяем наличие основных DOM элементов
      const mainAppContainer = document.getElementById('app');
      if (!mainAppContainer) {
        console.error('Не найден контейнер приложения #app');
        // Создаем контейнер, если он отсутствует
        const appContainer = document.createElement('div');
        appContainer.id = 'app';
        document.body.appendChild(appContainer);
        console.log('Создан новый контейнер #app');
      }

      // Если мы в среде Telegram, используем специальный порядок инициализации
      if (window.Telegram && window.Telegram.WebApp) {
        console.log('Обнаружен Telegram WebApp, используем специальную инициализацию');
        // Сообщаем Telegram, что приложение готово к работе
        window.Telegram.WebApp.ready();
        
        // Инициализируем Telegram с помощью событий
        window.Telegram.WebApp.onEvent('viewportChanged', () => {
          console.log('Получено событие viewportChanged от Telegram WebApp');
          this.initTelegramFlow();
        });
        
        // На случай, если viewportChanged не сработает
        setTimeout(() => {
          if (!this.isInitialized) {
            console.log('Таймаут инициализации Telegram, запуск вручную');
            this.initTelegramFlow();
          }
        }, 500);
      } else {
        // Стандартная инициализация без Telegram
        console.log('Telegram WebApp не обнаружен, используем стандартную инициализацию');
        this.initStandardFlow();
      }
    } catch (error) {
      console.error('Критическая ошибка при инициализации приложения:', error);
      sentryService.captureException(error);
      this.showErrorMessage('Критическая ошибка при запуске приложения.');
    }
  }
  
  // Инициализация для Telegram WebApp
  initTelegramFlow() {
    // Инициализируем Sentry для отслеживания ошибок
    sentryService.initSentry();
    
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
  }
  
  // Стандартная инициализация без Telegram
  initStandardFlow() {
    // Инициализируем Sentry для отслеживания ошибок
    sentryService.initSentry();
    
    this.initScreens();
    this.isInitialized = true;
    
    // Показываем стартовый экран
    this.showScreen('start');
    this.isStarted = true;
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
        console.error(`DOM элемент для экрана "${screenName}" не найден`);
        // Пытаемся создать элемент экрана, если он отсутствует
        this.createScreenElement(screenName);
        return;
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
  
  // Создание элемента экрана, если он не существует
  createScreenElement(screenName) {
    try {
      console.log(`Создание отсутствующего элемента экрана: ${screenName}`);
      const appContainer = document.getElementById('app');
      if (!appContainer) {
        throw new Error('Контейнер приложения #app не найден');
      }
      
      const screenElement = document.createElement('div');
      screenElement.id = `${screenName}-screen`;
      screenElement.className = 'screen';
      screenElement.style.display = 'none';
      
      // Добавляем заголовок и сообщение о необходимости перезагрузки
      const header = document.createElement('h2');
      header.textContent = `Экран ${screenName}`;
      
      const message = document.createElement('p');
      message.textContent = 'Произошла ошибка при загрузке экрана. Пожалуйста, перезагрузите приложение.';
      
      screenElement.appendChild(header);
      screenElement.appendChild(message);
      appContainer.appendChild(screenElement);
      
      console.log(`Создан временный элемент экрана: ${screenName}`);
      return screenElement;
    } catch (error) {
      console.error(`Ошибка при создании элемента экрана ${screenName}:`, error);
      sentryService.captureException(error);
      this.showErrorMessage('Критическая ошибка при создании элемента экрана.');
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