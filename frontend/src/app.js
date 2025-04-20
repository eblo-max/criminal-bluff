/**
 * Криминальный Блеф - Telegram Mini App
 * Основной JavaScript файл
 */

// Импорт модулей
import { ApiService } from './services/apiService.js';
import { GameService } from './services/gameService.js';
import { UiService } from './services/uiService.js';
import { TelegramService } from './services/telegramService.js';

// Инициализация приложения
document.addEventListener('DOMContentLoaded', () => {
  // Инициализация сервисов
  const apiService = new ApiService();
  const telegramService = new TelegramService();
  const uiService = new UiService();
  const gameService = new GameService(apiService, uiService);
  
  // Инициализация Telegram WebApp
  telegramService.init();
  
  // Получение элементов DOM
  const startScreen = document.getElementById('start-screen');
  const gameScreen = document.getElementById('game-screen');
  const answerResultScreen = document.getElementById('answer-result-screen');
  const gameResultScreen = document.getElementById('game-result-screen');
  const profileScreen = document.getElementById('profile-screen');
  const leaderboardScreen = document.getElementById('leaderboard-screen');
  
  const startGameBtn = document.getElementById('start-game-btn');
  const profileBtn = document.getElementById('profile-btn');
  const leaderboardBtn = document.getElementById('leaderboard-btn');
  const profileBackBtn = document.getElementById('profile-back-btn');
  const leaderboardBackBtn = document.getElementById('leaderboard-back-btn');
  const playAgainBtn = document.getElementById('play-again-btn');
  const shareResultBtn = document.getElementById('share-result-btn');
  
  // Обработчики событий
  startGameBtn.addEventListener('click', () => {
    uiService.showScreen(gameScreen);
    gameService.startGame();
  });
  
  profileBtn.addEventListener('click', () => {
    uiService.showScreen(profileScreen);
    loadProfile();
  });
  
  leaderboardBtn.addEventListener('click', () => {
    uiService.showScreen(leaderboardScreen);
    loadLeaderboard('daily');
  });
  
  profileBackBtn.addEventListener('click', () => {
    uiService.showScreen(startScreen);
  });
  
  leaderboardBackBtn.addEventListener('click', () => {
    uiService.showScreen(startScreen);
  });
  
  playAgainBtn.addEventListener('click', () => {
    uiService.showScreen(gameScreen);
    gameService.startGame();
  });
  
  shareResultBtn.addEventListener('click', () => {
    telegramService.shareResults(gameService.getGameResults());
  });
  
  // Делегирование событий для вариантов ответа
  document.querySelector('.options-container').addEventListener('click', (e) => {
    if (e.target.classList.contains('option')) {
      const optionIndex = parseInt(e.target.getAttribute('data-index'));
      gameService.submitAnswer(optionIndex);
    }
  });
  
  // Делегирование событий для кнопки "Следующая история"
  document.querySelector('.next-btn').addEventListener('click', () => {
    gameService.nextStory();
  });
  
  // Делегирование событий для вкладок рейтинга
  document.querySelector('.leaderboard-tabs').addEventListener('click', (e) => {
    if (e.target.classList.contains('tab-btn')) {
      const period = e.target.getAttribute('data-period');
      
      // Обновление активной вкладки
      document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
      });
      e.target.classList.add('active');
      
      // Загрузка соответствующего рейтинга
      loadLeaderboard(period);
    }
  });
  
  /**
   * Функция загрузки профиля пользователя
   */
  async function loadProfile() {
    try {
      uiService.showLoading();
      
      // Получение данных профиля
      const profile = await apiService.getUserProfile();
      
      // Обновление UI
      if (profile) {
        document.getElementById('user-name').textContent = profile.username || 'Игрок';
        document.getElementById('games-played').textContent = profile.gamesPlayed || 0;
        
        const accuracy = profile.gamesPlayed > 0 
          ? Math.round((profile.correctAnswers / (profile.gamesPlayed * 5)) * 100) 
          : 0;
        document.getElementById('accuracy').textContent = `${accuracy}%`;
        
        document.getElementById('profile-best-streak').textContent = profile.bestStreak || 0;
        
        // Получение позиции пользователя в рейтинге
        const rankPosition = await apiService.getUserPosition();
        document.getElementById('rank-position').textContent = rankPosition ? `#${rankPosition}` : 'N/A';
        
        // Отображение достижений
        if (profile.achievements && profile.achievements.length > 0) {
          renderAchievements(profile.achievements);
        } else {
          document.getElementById('achievements-list').innerHTML = '<p class="text-secondary">У вас пока нет достижений</p>';
        }
        
        // Установка аватара, если доступен
        if (telegramService.getUserInfo() && telegramService.getUserInfo().photo_url) {
          document.getElementById('user-avatar').src = telegramService.getUserInfo().photo_url;
        }
      }
      
      uiService.hideLoading();
    } catch (error) {
      console.error('Error loading profile:', error);
      uiService.hideLoading();
      uiService.showError('Не удалось загрузить профиль. Попробуйте позже.');
    }
  }
  
  /**
   * Функция отображения достижений
   * @param {Array} achievements - массив достижений пользователя
   */
  function renderAchievements(achievements) {
    const achievementsList = document.getElementById('achievements-list');
    achievementsList.innerHTML = '';
    
    // Все возможные достижения
    const allAchievements = [
      {
        name: 'Новичок',
        description: 'Сыграть первую игру',
        icon: '🎮'
      },
      {
        name: 'Эксперт',
        description: '10 правильных ответов подряд',
        icon: '🧠'
      },
      {
        name: 'Мастер дедукции',
        description: '100% точность в 5 играх подряд',
        icon: '🔍'
      },
      {
        name: 'Скоростной детектив',
        description: 'Правильный ответ за 3 секунды',
        icon: '⚡'
      },
      {
        name: 'Серийный игрок',
        description: '100 сыгранных игр',
        icon: '🏆'
      }
    ];
    
    // Отображение всех достижений с пометкой "разблокировано" или "заблокировано"
    allAchievements.forEach(achievement => {
      const isUnlocked = achievements.some(a => a.name === achievement.name);
      const html = `
        <div class="achievement-item ${isUnlocked ? '' : 'achievement-locked'}">
          <div class="achievement-icon">${achievement.icon}</div>
          <div class="achievement-name">${achievement.name}</div>
          <div class="achievement-description">${achievement.description}</div>
        </div>
      `;
      achievementsList.insertAdjacentHTML('beforeend', html);
    });
  }
  
  /**
   * Функция загрузки таблицы лидеров
   * @param {string} period - период ('daily', 'weekly', 'all-time')
   */
  async function loadLeaderboard(period) {
    try {
      uiService.showLoading();
      
      // Получение данных рейтинга
      const leaderboard = await apiService.getLeaderboard(period);
      
      // Обновление UI
      if (leaderboard && leaderboard.length > 0) {
        renderLeaderboard(leaderboard);
      } else {
        document.getElementById('leaderboard-list').innerHTML = '<p class="text-secondary text-center">Пока нет данных</p>';
      }
      
      // Получение позиции пользователя
      const userRank = await apiService.getUserPosition(period);
      document.getElementById('user-rank').textContent = userRank ? `#${userRank}` : 'N/A';

      // Если выбран глобальный рейтинг, загружаем соседей пользователя в рейтинге
      if (period === 'all-time') {
        try {
          const neighborsData = await apiService.getUserNeighbors(5);
          
          if (neighborsData && neighborsData.success && neighborsData.neighbors && neighborsData.neighbors.length > 0) {
            renderNeighbors(neighborsData.neighbors);
            document.getElementById('neighbors-container').classList.remove('hidden');
          } else {
            document.getElementById('neighbors-container').classList.add('hidden');
          }
        } catch (neighborsError) {
          console.error('Error loading neighbors:', neighborsError);
          document.getElementById('neighbors-container').classList.add('hidden');
        }
      } else {
        // Для других периодов скрываем блок с соседями
        document.getElementById('neighbors-container').classList.add('hidden');
      }
      
      uiService.hideLoading();
    } catch (error) {
      console.error('Error loading leaderboard:', error);
      uiService.hideLoading();
      uiService.showError('Не удалось загрузить рейтинг. Попробуйте позже.');
    }
  }
  
  /**
   * Функция отображения таблицы лидеров
   * @param {Array} leaderboard - массив с данными лидеров
   */
  function renderLeaderboard(leaderboard) {
    const leaderboardList = document.getElementById('leaderboard-list');
    leaderboardList.innerHTML = '';
    
    leaderboard.forEach((item, index) => {
      const html = `
        <div class="leaderboard-item">
          <div class="rank">${index + 1}</div>
          <div class="user-avatar-small">
            ${item.photoUrl ? `<img src="${item.photoUrl}" alt="avatar">` : ''}
          </div>
          <div class="leaderboard-name">${item.username || 'Игрок'}</div>
          <div class="leaderboard-score">${item.score}</div>
        </div>
      `;
      leaderboardList.insertAdjacentHTML('beforeend', html);
    });
  }
  
  /**
   * Функция отображения соседей пользователя в рейтинге
   * @param {Array} neighbors - массив с данными соседей
   */
  function renderNeighbors(neighbors) {
    const neighborsList = document.getElementById('neighbors-list');
    neighborsList.innerHTML = '';
    
    neighbors.forEach((item) => {
      const html = `
        <div class="leaderboard-item ${item.isCurrent ? 'current-user' : ''}">
          <div class="rank">${item.position}</div>
          <div class="user-avatar-small">
            ${item.photoUrl ? `<img src="${item.photoUrl}" alt="avatar">` : ''}
          </div>
          <div class="leaderboard-name">${item.username || 'Игрок'}</div>
          <div class="leaderboard-score">${item.score}</div>
        </div>
      `;
      neighborsList.insertAdjacentHTML('beforeend', html);
    });
  }
  
  // Инициализация: показываем стартовый экран
  uiService.showScreen(startScreen);
  
  // Если пользователь уже авторизован, проверяем профиль
  if (telegramService.getUserInfo()) {
    apiService.createOrUpdateUser(telegramService.getUserInfo())
      .catch(error => console.error('Error updating user profile:', error));
  }
  
  // Создаем логотип для заставки
  createLogoSVG();
})

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