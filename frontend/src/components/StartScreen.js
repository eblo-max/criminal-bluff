/**
 * StartScreen Component
 * Отвечает за отображение и логику стартового экрана
 */
class StartScreen {
  constructor(telegramService) {
    this.telegramService = telegramService;
    this.container = document.getElementById('start-screen');
    
    // Добавляем проверки на существование контейнера
    if (!this.container) {
      console.error('Не найден контейнер #start-screen');
      return;
    }
    
    // Безопасно получаем элементы, с проверкой на существование
    this.startGameBtn = this.container.querySelector('#start-game-btn');
    this.profileBtn = this.container.querySelector('#profile-btn');
    this.leaderboardBtn = this.container.querySelector('#leaderboard-btn');
    this.logoContainer = this.container.querySelector('.logo-container');
    this.userInfo = this.container.querySelector('.user-info');
    
    // Проверяем наличие всех необходимых элементов
    if (!this.startGameBtn) {
      console.warn('Не найдена кнопка #start-game-btn');
    }
    if (!this.profileBtn) {
      console.warn('Не найдена кнопка #profile-btn');
    }
    if (!this.leaderboardBtn) {
      console.warn('Не найдена кнопка #leaderboard-btn');
    }
    if (!this.logoContainer) {
      console.warn('Не найден контейнер .logo-container');
      // Создаем контейнер для логотипа, если он отсутствует
      this.logoContainer = document.createElement('div');
      this.logoContainer.className = 'logo-container';
      this.container.insertBefore(this.logoContainer, this.container.firstChild);
    }
    if (!this.userInfo) {
      console.warn('Не найден элемент .user-info');
      // Создаем элемент для информации о пользователе, если он отсутствует
      this.userInfo = document.createElement('div');
      this.userInfo.className = 'user-info';
      this.container.appendChild(this.userInfo);
    }
  }

  /**
   * Инициализация стартового экрана
   */
  init() {
    // Проверяем, успешно ли инициализированы все элементы
    if (!this.container) {
      console.error('Невозможно инициализировать StartScreen: отсутствует контейнер');
      return;
    }
    
    try {
      this.renderLogo();
      this.renderUserInfo();
      this.bindEvents();
      console.log('StartScreen успешно инициализирован');
    } catch (error) {
      console.error('Ошибка при инициализации StartScreen:', error);
    }
  }

  /**
   * Рендеринг логотипа игры
   */
  renderLogo() {
    // Проверяем наличие контейнера для логотипа
    if (!this.logoContainer) {
      console.error('Не удалось отрендерить логотип: отсутствует контейнер');
      return;
    }
    
    try {
      // Получаем SVG логотип из функции
      const logoSVG = this.createLogoSVG();
      
      // Добавляем логотип в контейнер
      this.logoContainer.innerHTML = logoSVG;
      
      // Анимация логотипа при загрузке
      this.animateLogo();
    } catch (error) {
      console.error('Ошибка при рендеринге логотипа:', error);
      // Резервный вариант логотипа в случае ошибки
      this.logoContainer.textContent = 'КРИМИНАЛЬНЫЙ БЛЕФ';
    }
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
    if (!this.container) return;
    
    try {
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
      } else {
        console.warn('Элементы логотипа не найдены для анимации');
      }
    } catch (error) {
      console.error('Ошибка при анимации логотипа:', error);
    }
  }

  /**
   * Рендеринг информации о пользователе
   */
  renderUserInfo() {
    // Проверяем наличие контейнера для информации о пользователе
    if (!this.userInfo) {
      console.error('Не удалось отрендерить информацию о пользователе: отсутствует контейнер');
      return;
    }
    
    try {
      const userData = this.telegramService ? this.telegramService.getUserInfo() : null;
      
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
    } catch (error) {
      console.error('Ошибка при рендеринге информации о пользователе:', error);
      // Резервный вариант в случае ошибки
      this.userInfo.textContent = 'Игрок';
    }
  }

  /**
   * Привязка обработчиков событий
   */
  bindEvents() {
    try {
      // Проверяем наличие всех необходимых элементов перед привязкой событий
      if (this.startGameBtn) {
        // Событие нажатия на кнопку "Начать игру"
        this.startGameBtn.addEventListener('click', () => {
          // Обработка будет происходить на уровне выше
          this.container.dispatchEvent(new CustomEvent('startGame'));
        });
      }
      
      if (this.profileBtn) {
        // Событие нажатия на кнопку "Профиль"
        this.profileBtn.addEventListener('click', () => {
          this.container.dispatchEvent(new CustomEvent('showProfile'));
        });
      }
      
      if (this.leaderboardBtn) {
        // Событие нажатия на кнопку "Рейтинг"
        this.leaderboardBtn.addEventListener('click', () => {
          this.container.dispatchEvent(new CustomEvent('showLeaderboard'));
        });
      }
    } catch (error) {
      console.error('Ошибка при привязке событий:', error);
    }
  }
  
  /**
   * Добавление эффекта пульсации для кнопки начала игры
   * @param {Boolean} enabled - Включить или выключить эффект
   */
  setPulseEffect(enabled) {
    if (!this.startGameBtn) return;
    
    try {
      if (enabled) {
        this.startGameBtn.classList.add('pulse-animation');
      } else {
        this.startGameBtn.classList.remove('pulse-animation');
      }
    } catch (error) {
      console.error('Ошибка при установке эффекта пульсации:', error);
    }
  }
}

export default StartScreen; 