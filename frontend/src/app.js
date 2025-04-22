import { sharedState } from './services/common.js';
import { apiService } from './services/apiService.js';
import { gameService } from './services/gameService.js';
import './app.css';

/**
 * Основной класс приложения
 */
export class App {
  constructor() {
    this.isInitialized = false;
    this.screens = {};
    this.currentScreenId = null;
  }

  /**
   * Инициализация приложения
   */
  init() {
    if (this.isInitialized) {
      sharedState.log('App уже инициализирован');
      return;
    }

    try {
      sharedState.log('Инициализация App начата');
      
      // Создаем контейнеры для экранов
      this.createScreenContainers();
      
      // Инициализируем сервисы
      this.initServices();
      
      // Навигация на начальный экран
      this.navigateTo('welcome');
      
      this.isInitialized = true;
      sharedState.log('App успешно инициализирован');
    } catch (error) {
      sharedState.log(`Ошибка при инициализации App: ${error.message}`, 'error');
      sharedState.showErrorMessage(`Не удалось инициализировать приложение: ${error.message}`);
    }
  }

  /**
   * Создание контейнеров для экранов
   */
  createScreenContainers() {
    try {
      // Получаем корневой элемент
      const rootElement = sharedState.getElementById('app');
      if (!rootElement) {
        throw new Error('Корневой элемент #app не найден');
      }
      
      // Очищаем корневой элемент
      rootElement.innerHTML = '';
      
      // Создаем контейнер для экранов
      const screenContainer = sharedState.createElement('div');
      screenContainer.id = 'screen-container';
      screenContainer.style.position = 'relative';
      screenContainer.style.width = '100%';
      screenContainer.style.height = '100%';
      
      // Создаем контейнер для логов
      const logsContainer = sharedState.createElement('div');
      logsContainer.id = 'logs-container';
      logsContainer.style.display = 'none'; // По умолчанию скрыт
      logsContainer.style.position = 'fixed';
      logsContainer.style.bottom = '0';
      logsContainer.style.left = '0';
      logsContainer.style.width = '100%';
      logsContainer.style.maxHeight = '30%';
      logsContainer.style.overflow = 'auto';
      logsContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
      logsContainer.style.color = 'white';
      logsContainer.style.fontFamily = 'monospace';
      logsContainer.style.fontSize = '10px';
      logsContainer.style.padding = '5px';
      logsContainer.style.zIndex = '1000';
      
      // Создаем контейнер для сообщений об ошибках
      const errorContainer = sharedState.createElement('div');
      errorContainer.id = 'error-container';
      errorContainer.style.position = 'fixed';
      errorContainer.style.top = '10px';
      errorContainer.style.left = '50%';
      errorContainer.style.transform = 'translateX(-50%)';
      errorContainer.style.zIndex = '2000';
      
      // Добавляем все контейнеры
      rootElement.appendChild(screenContainer);
      rootElement.appendChild(logsContainer);
      rootElement.appendChild(errorContainer);
      
      // Создаем экраны
      this.createScreens(screenContainer);
      
      sharedState.log('Контейнеры для экранов созданы');
    } catch (error) {
      sharedState.log(`Ошибка при создании контейнеров: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Создание экранов приложения
   */
  createScreens(container) {
    try {
      // Экран приветствия
      const welcomeScreen = sharedState.createElement('div');
      welcomeScreen.id = 'welcome-screen';
      welcomeScreen.className = 'screen';
      welcomeScreen.style.display = 'none';
      
      const welcomeContent = sharedState.createElement('div');
      welcomeContent.className = 'screen-content';
      welcomeContent.innerHTML = `
        <h1>Criminal Bluff</h1>
        <p>Добро пожаловать в игру Criminal Bluff!</p>
        <button id="start-game-btn" class="primary-button">Начать игру</button>
      `;
      
      welcomeScreen.appendChild(welcomeContent);
      container.appendChild(welcomeScreen);
      
      // Экран игры
      const gameScreen = sharedState.createElement('div');
      gameScreen.id = 'game-screen';
      gameScreen.className = 'screen';
      gameScreen.style.display = 'none';
      
      const gameContent = sharedState.createElement('div');
      gameContent.className = 'screen-content game-content';
      gameContent.innerHTML = `
        <div id="story-container" class="story-container"></div>
        <div id="timer-container" class="timer-container">
          <div id="timer-bar" class="timer-bar"></div>
        </div>
        <div id="answer-container" class="answer-container">
          <div class="answer-options">
            <button id="answer-true" class="answer-btn">Правда</button>
            <button id="answer-false" class="answer-btn">Ложь</button>
          </div>
        </div>
      `;
      
      gameScreen.appendChild(gameContent);
      container.appendChild(gameScreen);
      
      // Экран результатов
      const resultsScreen = sharedState.createElement('div');
      resultsScreen.id = 'results-screen';
      resultsScreen.className = 'screen';
      resultsScreen.style.display = 'none';
      
      const resultsContent = sharedState.createElement('div');
      resultsContent.className = 'screen-content';
      resultsContent.innerHTML = `
        <h2>Результаты</h2>
        <div id="game-results"></div>
        <button id="play-again-btn" class="primary-button">Играть снова</button>
      `;
      
      resultsScreen.appendChild(resultsContent);
      container.appendChild(resultsScreen);
      
      // Сохраняем ссылки на экраны
      this.screens = {
        welcome: welcomeScreen,
        game: gameScreen,
        results: resultsScreen
      };
      
      sharedState.log('Экраны созданы');
    } catch (error) {
      sharedState.log(`Ошибка при создании экранов: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Инициализация сервисов приложения
   */
  initServices() {
    try {
      // Инициализируем сервисы
      sharedState.log('Инициализация сервисов...');
      
      // Инициализируем API-сервис
      apiService.init();
      
      // Инициализируем игровой сервис
      gameService.init(this);
      
      // Обработчики событий
      this.setupEventListeners();
      
      sharedState.log('Сервисы инициализированы');
    } catch (error) {
      sharedState.log(`Ошибка при инициализации сервисов: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Настройка обработчиков событий
   */
  setupEventListeners() {
    try {
      // Кнопка "Начать игру"
      const startGameBtn = document.getElementById('start-game-btn');
      if (startGameBtn) {
        startGameBtn.addEventListener('click', () => {
          gameService.startGame();
        });
      }
      
      // Кнопки ответов
      const answerTrueBtn = document.getElementById('answer-true');
      const answerFalseBtn = document.getElementById('answer-false');
      
      if (answerTrueBtn) {
        answerTrueBtn.addEventListener('click', () => {
          gameService.submitAnswer(true);
        });
      }
      
      if (answerFalseBtn) {
        answerFalseBtn.addEventListener('click', () => {
          gameService.submitAnswer(false);
        });
      }
      
      // Кнопка "Играть снова"
      const playAgainBtn = document.getElementById('play-again-btn');
      if (playAgainBtn) {
        playAgainBtn.addEventListener('click', () => {
          this.navigateTo('welcome');
        });
      }
      
      // Добавляем обработчик для отображения логов при нажатии 3 раза в левый верхний угол
      let tapCount = 0;
      const resetTapTimeout = () => {
        tapCount = 0;
      };
      
      const handleDebugTap = (event) => {
        // Проверяем, что нажатие было в левом верхнем углу
        if (event.clientX < 50 && event.clientY < 50) {
          tapCount++;
          clearTimeout(this.tapResetTimeout);
          this.tapResetTimeout = setTimeout(resetTapTimeout, 2000);
          
          if (tapCount >= 3) {
            // Переключаем отображение логов
            const logsContainer = document.getElementById('logs-container');
            if (logsContainer) {
              logsContainer.style.display = logsContainer.style.display === 'none' ? 'block' : 'none';
              
              // Обновляем логи, если контейнер видимый
              if (logsContainer.style.display === 'block') {
                sharedState.updateLogDisplay();
              }
            }
            tapCount = 0;
          }
        }
      };
      
      document.addEventListener('click', handleDebugTap);
      
      sharedState.log('Обработчики событий настроены');
    } catch (error) {
      sharedState.log(`Ошибка при настройке обработчиков: ${error.message}`, 'error');
    }
  }

  /**
   * Навигация между экранами
   */
  navigateTo(screenId) {
    try {
      sharedState.log(`Навигация на экран: ${screenId}`);
      
      // Проверяем, существует ли экран
      if (!this.screens[screenId]) {
        throw new Error(`Экран "${screenId}" не найден`);
      }
      
      // Скрываем текущий экран
      if (this.currentScreenId && this.screens[this.currentScreenId]) {
        this.screens[this.currentScreenId].style.display = 'none';
      }
      
      // Показываем новый экран
      this.screens[screenId].style.display = 'block';
      this.currentScreenId = screenId;
      
      // Обновляем текущий экран в общем состоянии
      sharedState.currentScreen = screenId;
      
      // Действия при переходе на конкретный экран
      if (screenId === 'welcome') {
        // Сбрасываем игровые данные при возврате на начальный экран
        gameService.resetGame();
      }
    } catch (error) {
      sharedState.log(`Ошибка при навигации на экран ${screenId}: ${error.message}`, 'error');
      sharedState.showErrorMessage(`Ошибка при навигации: ${error.message}`);
    }
  }
} 