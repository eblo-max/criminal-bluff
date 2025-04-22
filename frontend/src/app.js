/**
 * Криминальный Блеф - Telegram Mini App
 * Основной JavaScript файл
 */

// Импорт модулей
import { ApiService } from './services/apiService.js';
import { GameService } from './services/gameService.js';
import { UiService } from './services/uiService.js';
import { TelegramService } from './services/telegramService.js';
import errorService from './services/errorService.js';

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

// Инициализация приложения
(function() {
  // Инициализация сервисов
  const apiService = new ApiService();
  const uiService = new UiService();
  const telegramService = new TelegramService();
  const gameService = new GameService(apiService, uiService);
  
  // Глобальные компоненты
  window.startScreen = null;
  window.gameScreen = null;
  window.resultScreen = null;
  window.profileScreen = null;
  window.leaderboardScreen = null;
  window.sentryTest = null;
  
  // Функция для логирования ошибок
  function logError(message, error) {
    console.error(message, error);
    
    // Отправляем ошибку в Sentry
    if (errorService) {
      errorService.captureException(error || new Error(message), {
        tags: { 
          initialization: true,
          version: window.appVersion
        }
      });
    }
    
    // Показываем ошибку пользователю
    if (uiService) {
      uiService.showError('Ошибка при запуске приложения. Пожалуйста, попробуйте позже.');
    } else {
      // Если uiService еще не инициализирован, показываем ошибку напрямую
      const errorElement = document.getElementById('error-message');
      if (errorElement) {
        errorElement.textContent = 'Ошибка при запуске приложения. Пожалуйста, попробуйте позже.';
        errorElement.style.display = 'block';
      }
    }
  }
  
  // Устанавливаем обработчик для окончания инициализации Telegram
  telegramService.onInitComplete = function() {
    try {
      // Инициализируем сервис ошибок после инициализации Telegram
      const user = telegramService.user;
      if (errorService && user) {
        errorService.init(user);
      }
      
      // Продолжаем инициализацию компонентов
      initializeComponents();
    } catch (error) {
      logError('Ошибка при завершении инициализации', error);
    }
  };
  
  // Инициализация Telegram WebApp
  try {
    telegramService.init()
      .then(success => {
        if (success) {
          console.log('Telegram инициализирован успешно');
          // onInitComplete будет вызван автоматически внутри telegramService
        } else {
          console.error('Failed to initialize Telegram WebApp service');
          
          if (window.debugMode) {
            console.warn('Режим отладки активен. Пробуем запустить приложение без Telegram WebApp.');
            initializeComponents();
          } else {
            logError('Не удалось инициализировать Telegram WebApp');
          }
        }
      })
      .catch(error => {
        console.error('Error during initialization:', error);
        
        if (window.debugMode) {
          console.warn('Режим отладки активен. Пробуем запустить приложение несмотря на ошибку.');
          initializeComponents();
        } else {
          logError('Ошибка при инициализации приложения', error);
        }
      });
  } catch (error) {
    console.error('Critical error during app startup:', error);
    
    if (window.debugMode) {
      console.warn('Режим отладки активен. Пробуем запустить приложение несмотря на критическую ошибку.');
      initializeComponents();
    } else {
      logError('Критическая ошибка при запуске приложения', error);
    }
  }
  
  // Функция инициализации компонентов после успешной авторизации
  function initializeComponents() {
    // Добавляем отладочный интерфейс в режиме разработки
    if (window.debugMode) {
      // Проверяем, есть ли уже debug-panel
      if (!document.getElementById('debug-panel')) {
        const testButton = document.createElement('button');
        testButton.textContent = 'Test Sentry Error';
        testButton.style.position = 'fixed';
        testButton.style.bottom = '210px';
        testButton.style.right = '10px';
        testButton.style.zIndex = '9999';
        testButton.style.padding = '8px 12px';
        testButton.style.backgroundColor = '#ff4d4f';
        testButton.style.color = 'white';
        testButton.style.border = 'none';
        testButton.style.borderRadius = '4px';
        
        testButton.addEventListener('click', () => {
          try {
            throw new Error('This is a test error from Criminal Bluff app!');
          } catch (error) {
            errorService.captureException(error, {
              tags: {
                testError: true,
                source: 'test-button'
              }
            });
            alert('Test error sent to Sentry!');
          }
        });
        
        document.body.appendChild(testButton);
      }
    }
    
    try {
      // Инициализация компонентов
      window.startScreen = new StartScreen(telegramService);
      window.gameScreen = new GameScreen(gameService, telegramService);
      window.resultScreen = new ResultScreen(telegramService);
      window.profileScreen = new ProfileScreen(apiService, uiService, telegramService);
      window.leaderboardScreen = new LeaderboardScreen(apiService, uiService);
      window.sentryTest = new SentryTest();
      
      // Получение элементов DOM для экранов
      const startScreenElement = document.getElementById('start-screen');
      const gameScreenElement = document.getElementById('game-screen');
      const answerResultScreenElement = document.getElementById('answer-result-screen');
      const gameResultScreenElement = document.getElementById('game-result-screen');
      const profileScreenElement = document.getElementById('profile-screen');
      const leaderboardScreenElement = document.getElementById('leaderboard-screen');
      const sentryTestScreenElement = document.getElementById('sentry-test-screen');
      
      // Проверка наличия нужных DOM элементов
      if (!startScreenElement) {
        throw new Error('Элемент "start-screen" не найден в DOM');
      }
      
      // Инициализация стартового экрана
      window.startScreen.init();
      
      // Инициализация экрана тестирования Sentry
      window.sentryTest.init();
      
      // Обработчики событий для переключения экранов
      startScreenElement.addEventListener('startGame', async () => {
        try {
          uiService.showScreen(gameScreenElement);
          const gameData = await gameService.startGame();
          
          if (gameData) {
            window.gameScreen.init(
              gameData.stories[0], 
              gameData.currentStory, 
              gameData.stories.length
            );
          }
        } catch (error) {
          logError('Ошибка при запуске игры', error);
          uiService.showScreen(startScreenElement);
        }
      });
      
      startScreenElement.addEventListener('showProfile', async () => {
        uiService.showScreen(profileScreenElement);
        await window.profileScreen.init();
      });
      
      startScreenElement.addEventListener('showLeaderboard', async () => {
        uiService.showScreen(leaderboardScreenElement);
        await window.leaderboardScreen.init();
      });
      
      // Добавляем скрытый обработчик для активации экрана тестирования Sentry (через debug режим)
      if (localStorage.getItem('debug_mode') === 'true') {
        const debugSentryLink = document.createElement('button');
        debugSentryLink.textContent = 'Тест Sentry';
        debugSentryLink.className = 'btn btn-danger';
        debugSentryLink.style.marginTop = '12px';
        
        debugSentryLink.addEventListener('click', () => {
          uiService.showScreen(sentryTestScreenElement);
        });
        
        // Добавляем кнопку в блок debug-panel
        const debugPanel = document.getElementById('debug-panel');
        if (debugPanel) {
          debugPanel.appendChild(debugSentryLink);
        }
      }
      
      // Обработчики для экрана тестирования Sentry
      sentryTestScreenElement.addEventListener('goBack', () => {
        uiService.showScreen(startScreenElement);
      });
      
      // Настройка взаимодействия между сервисами и компонентами
      gameService.onGameStart = (gameData) => {
        window.gameScreen.init(
          gameData.stories[0], 
          gameData.currentStory, 
          gameData.stories.length
        );
      };
      
      gameService.onAnswerSubmit = (selectedIndex, correctIndex, explanation) => {
        window.gameScreen.showResult(selectedIndex, correctIndex);
        
        // Отображаем объяснение
        document.querySelector('.answer-explanation').textContent = explanation;
        
        // Показываем экран результата ответа
        setTimeout(() => {
          uiService.showScreen(answerResultScreenElement);
        }, 1000);
      };
      
      gameService.onNextStory = (story, currentStory, totalStories) => {
        uiService.showScreen(gameScreenElement);
        window.gameScreen.init(story, currentStory, totalStories);
      };
      
      gameService.onGameComplete = (results) => {
        uiService.showScreen(gameResultScreenElement);
        window.resultScreen.init(results);
      };
      
      // Обработчик для кнопки "Следующая история"
      document.querySelector('.next-btn').addEventListener('click', () => {
        gameService.nextStory();
      });
      
      // Обработчик для кнопки "Играть снова"
      document.querySelector('#play-again-btn').addEventListener('click', async () => {
        uiService.showScreen(gameScreenElement);
        const gameData = await gameService.startGame();
        
        if (gameData) {
          window.gameScreen.init(
            gameData.stories[0], 
            gameData.currentStory, 
            gameData.stories.length
          );
        }
      });
      
      // Обработчики для кнопок "Назад"
      document.querySelector('#profile-back-btn').addEventListener('click', () => {
        uiService.showScreen(startScreenElement);
      });
      
      document.querySelector('#leaderboard-back-btn').addEventListener('click', () => {
        uiService.showScreen(startScreenElement);
      });
      
      // Настройка взаимодействия с Telegram WebApp
      if (telegramService.tg) {
        telegramService.setupBackButton((isVisible) => {
          if (isVisible) {
            let currentScreen = uiService.getCurrentScreen();
            switch(currentScreen.id) {
              case 'game-screen':
                // В игре кнопка "Назад" возвращает на стартовый экран
                return () => {
                  if (confirm('Вы уверены, что хотите выйти? Прогресс игры будет потерян.')) {
                    uiService.showScreen(startScreenElement);
                    return true;
                  }
                  return false;
                };
              case 'profile-screen':
              case 'leaderboard-screen':
              case 'sentry-test-screen':
                // На экранах профиля, таблицы лидеров и Sentry теста возвращаем на стартовый экран
                return () => {
                  uiService.showScreen(startScreenElement);
                  return true;
                };
              case 'answer-result-screen':
                // На экране результата ответа нельзя использовать кнопку "Назад"
                return null;
              case 'game-result-screen':
                // На экране результатов игры возвращаем на стартовый экран
                return () => {
                  uiService.showScreen(startScreenElement);
                  return true;
                };
              default:
                return null;
            }
          }
          return null;
        });
      }
      
      // Скрываем экран загрузки, если он есть
      const loadingScreen = document.getElementById('loading-screen');
      if (loadingScreen) {
        loadingScreen.style.display = 'none';
      }
      
      console.log('Приложение успешно инициализировано');
    } catch (error) {
      logError('Ошибка при инициализации компонентов', error);
    }
  }
})();

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