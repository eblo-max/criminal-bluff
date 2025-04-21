/**
 * StartScreen Component
 * Отвечает за отображение и логику стартового экрана
 */
class StartScreen {
  constructor(telegramService) {
    this.telegramService = telegramService;
    this.container = document.getElementById('start-screen');
    this.startGameBtn = this.container.querySelector('#start-game-btn');
    this.profileBtn = this.container.querySelector('#profile-btn');
    this.leaderboardBtn = this.container.querySelector('#leaderboard-btn');
    this.logoContainer = this.container.querySelector('.logo-container');
    this.userInfo = this.container.querySelector('.user-info');
  }

  /**
   * Инициализация стартового экрана
   */
  init() {
    this.renderLogo();
    this.renderUserInfo();
    this.bindEvents();
  }

  /**
   * Рендеринг логотипа игры
   */
  renderLogo() {
    // Получаем SVG логотип из функции
    const logoSVG = this.createLogoSVG();
    
    // Добавляем логотип в контейнер
    this.logoContainer.innerHTML = logoSVG;
    
    // Анимация логотипа при загрузке
    this.animateLogo();
  }

  /**
   * Создание SVG логотипа
   * @returns {String} - HTML строка с SVG логотипом
   */
  createLogoSVG() {
    return `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 80" class="game-logo">
        <defs>
          <linearGradient id="logo-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#FF6B6B" />
            <stop offset="100%" stop-color="#4ECDC4" />
          </linearGradient>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <text x="50%" y="60%" text-anchor="middle" class="logo-text" filter="url(#glow)" fill="url(#logo-gradient)">
          КРИМИНАЛЬНЫЙ
        </text>
        <text x="50%" y="85%" text-anchor="middle" class="logo-text-shadow" fill="#2E294E">
          БЛЕФ
        </text>
      </svg>
    `;
  }

  /**
   * Анимация логотипа
   */
  animateLogo() {
    // Получаем элементы логотипа
    const logoText = this.container.querySelector('.logo-text');
    const logoTextShadow = this.container.querySelector('.logo-text-shadow');
    
    // Применяем анимацию
    if (logoText && logoTextShadow) {
      // Сброс стилей для анимации
      logoText.style.opacity = '0';
      logoText.style.transform = 'translateY(-20px)';
      logoTextShadow.style.opacity = '0';
      logoTextShadow.style.transform = 'translateY(20px)';
      
      // Анимация появления
      setTimeout(() => {
        logoText.style.transition = 'all 0.5s ease-out';
        logoText.style.opacity = '1';
        logoText.style.transform = 'translateY(0)';
        
        setTimeout(() => {
          logoTextShadow.style.transition = 'all 0.5s ease-out';
          logoTextShadow.style.opacity = '1';
          logoTextShadow.style.transform = 'translateY(0)';
        }, 300);
      }, 100);
    }
  }

  /**
   * Рендеринг информации о пользователе
   */
  renderUserInfo() {
    const userData = this.telegramService.getUserInfo();
    
    if (userData) {
      // Имя пользователя
      const userName = userData.first_name || userData.username || 'Игрок';
      
      // Аватар пользователя
      const avatarUrl = userData.photo_url || '';
      
      // Создаем и добавляем информацию о пользователе
      this.userInfo.innerHTML = `
        <div class="user-avatar-container">
          ${avatarUrl ? `<img src="${avatarUrl}" class="user-avatar" alt="${userName}">` : '<div class="user-avatar-placeholder"></div>'}
        </div>
        <div class="user-name">${userName}</div>
      `;
    } else {
      // Если информация пользователя недоступна
      this.userInfo.innerHTML = `
        <div class="user-avatar-container">
          <div class="user-avatar-placeholder"></div>
        </div>
        <div class="user-name">Игрок</div>
      `;
    }
  }

  /**
   * Привязка обработчиков событий
   */
  bindEvents() {
    // Событие нажатия на кнопку "Начать игру"
    this.startGameBtn.addEventListener('click', () => {
      // Обработка будет происходить на уровне выше
      this.container.dispatchEvent(new CustomEvent('startGame'));
    });
    
    // Событие нажатия на кнопку "Профиль"
    this.profileBtn.addEventListener('click', () => {
      this.container.dispatchEvent(new CustomEvent('showProfile'));
    });
    
    // Событие нажатия на кнопку "Рейтинг"
    this.leaderboardBtn.addEventListener('click', () => {
      this.container.dispatchEvent(new CustomEvent('showLeaderboard'));
    });
  }
  
  /**
   * Добавление эффекта пульсации для кнопки начала игры
   * @param {Boolean} enabled - Включить или выключить эффект
   */
  setPulseEffect(enabled) {
    if (enabled) {
      this.startGameBtn.classList.add('pulse-animation');
    } else {
      this.startGameBtn.classList.remove('pulse-animation');
    }
  }
}

export default StartScreen; 