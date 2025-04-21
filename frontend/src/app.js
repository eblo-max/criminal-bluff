/**
 * Криминальный Блеф - Telegram Mini App
 * Основной JavaScript файл
 */

// Импорт модулей
import { ApiService } from './services/apiService.js';
import { GameService } from './services/gameService.js';
import { UiService } from './services/uiService.js';
import { TelegramService } from './services/telegramService.js';

// Импорт компонентов
import StartScreen from './components/StartScreen.js';
import GameScreen from './components/GameScreen.js';
import ResultScreen from './components/ResultScreen.js';
import ProfileScreen from './components/ProfileScreen.js';
import LeaderboardScreen from './components/LeaderboardScreen.js';

// Инициализация приложения
document.addEventListener('DOMContentLoaded', () => {
  // Инициализация сервисов
  const apiService = new ApiService();
  const uiService = new UiService();
  const telegramService = new TelegramService();
  const gameService = new GameService(apiService, uiService);
  
  // Инициализация Telegram WebApp
  telegramService.init();
  
  // Инициализация компонентов
  const startScreen = new StartScreen(telegramService);
  const gameScreen = new GameScreen(gameService, uiService);
  const resultScreen = new ResultScreen(telegramService);
  const profileScreen = new ProfileScreen(apiService, uiService, telegramService);
  const leaderboardScreen = new LeaderboardScreen(apiService, uiService);
  
  // Получение элементов DOM для экранов
  const startScreenElement = document.getElementById('start-screen');
  const gameScreenElement = document.getElementById('game-screen');
  const answerResultScreenElement = document.getElementById('answer-result-screen');
  const gameResultScreenElement = document.getElementById('game-result-screen');
  const profileScreenElement = document.getElementById('profile-screen');
  const leaderboardScreenElement = document.getElementById('leaderboard-screen');
  
  // Инициализация стартового экрана
  startScreen.init();
  
  // Обработчики событий для переключения экранов
  startScreenElement.addEventListener('startGame', async () => {
    uiService.showScreen(gameScreenElement);
    const gameData = await gameService.startGame();
    
    if (gameData) {
      gameScreen.init(
        gameData.stories[0], 
        gameData.currentStory, 
        gameData.stories.length
      );
    }
  });
  
  startScreenElement.addEventListener('showProfile', async () => {
    uiService.showScreen(profileScreenElement);
    await profileScreen.init();
  });
  
  startScreenElement.addEventListener('showLeaderboard', async () => {
    uiService.showScreen(leaderboardScreenElement);
    await leaderboardScreen.init();
  });
  
  // Настройка взаимодействия между сервисами и компонентами
  gameService.onGameStart = (gameData) => {
    gameScreen.init(
      gameData.stories[0], 
      gameData.currentStory, 
      gameData.stories.length
    );
  };
  
  gameService.onAnswerSubmit = (selectedIndex, correctIndex, explanation) => {
    gameScreen.showResult(selectedIndex, correctIndex);
    
    // Отображаем объяснение
    document.querySelector('.answer-explanation').textContent = explanation;
    
    // Показываем экран результата ответа
    setTimeout(() => {
      uiService.showScreen(answerResultScreenElement);
    }, 1000);
  };
  
  gameService.onNextStory = (story, currentStory, totalStories) => {
    uiService.showScreen(gameScreenElement);
    gameScreen.init(story, currentStory, totalStories);
  };
  
  gameService.onGameComplete = (results) => {
    uiService.showScreen(gameResultScreenElement);
    resultScreen.init(results);
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
      gameScreen.init(
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
  telegramService.onInitComplete = () => {
    // Настраиваем кнопку "Назад" в Telegram WebApp
    telegramService.setupBackButton((isVisible) => {
      if (isVisible) {
        let currentScreen = uiService.getCurrentScreen();
        
        if (currentScreen === profileScreenElement || 
            currentScreen === leaderboardScreenElement) {
          return () => uiService.showScreen(startScreenElement);
        }
        
        if (currentScreen === gameResultScreenElement) {
          return () => {
            uiService.showScreen(startScreenElement);
            telegramService.hideBackButton();
          };
        }
        
        if (currentScreen === answerResultScreenElement) {
          return () => {
            uiService.showScreen(gameScreenElement);
            telegramService.showBackButton();
          };
        }
        
        if (currentScreen === gameScreenElement) {
          return () => {
            if (confirm('Вы уверены, что хотите прервать игру?')) {
              uiService.showScreen(startScreenElement);
              telegramService.hideBackButton();
              gameService.abandonGame();
            }
          };
        }
      }
      
      return null;
    });
  };
  
  // Настройка общего обработчика ошибок
  window.onerror = function(message, source, lineno, colno, error) {
    console.error('Error:', error);
    uiService.showError('Произошла ошибка. Пожалуйста, перезапустите приложение.');
    return true;
  };
  
  // Прослушивание темы Telegram для адаптации интерфейса
  telegramService.onThemeChange = (themeParams) => {
    if (themeParams.text_color && themeParams.bg_color) {
      document.documentElement.style.setProperty('--tg-theme-text-color', themeParams.text_color);
      document.documentElement.style.setProperty('--tg-theme-bg-color', themeParams.bg_color);
      document.documentElement.style.setProperty('--tg-theme-button-color', themeParams.button_color || '#2AABEE');
      document.documentElement.style.setProperty('--tg-theme-button-text-color', themeParams.button_text_color || '#FFFFFF');
    }
  };
  
  // Применяем текущую тему Telegram
  telegramService.applyTelegramTheme();
});

/**
 * Функция создания SVG логотипа
 */
function createLogoSVG() {
  const logoUrl = 'src/assets/logo.svg';
  
  // Проверяем наличие файла
  fetch(logoUrl)
    .then(response => {
      if (!response.ok) {
        // Если файл не существует, создаем его
        createMockLogo();
      }
    })
    .catch(() => {
      // В случае ошибки тоже создаем логотип
      createMockLogo();
    });
}

/**
 * Функция создания временного SVG логотипа
 */
function createMockLogo() {
  // Текстовый логотип - замена для реального дизайна
  const svgLogo = `
    <svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">
      <circle cx="60" cy="60" r="55" fill="#1f1f1f" stroke="#ff4d4d" stroke-width="3"/>
      <text x="60" y="65" font-family="Arial" font-size="24" font-weight="bold" fill="#ff4d4d" text-anchor="middle">КБ</text>
      <path d="M30,85 L90,85" stroke="#ff4d4d" stroke-width="2" />
      <path d="M35,95 L85,95" stroke="#ff4d4d" stroke-width="2" />
    </svg>
  `;
  
  // Находим все картинки с логотипом и меняем на встроенный SVG
  const logoImgs = document.querySelectorAll('.splash-logo img');
  logoImgs.forEach(img => {
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgLogo);
  });
} 