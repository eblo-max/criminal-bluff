/**
 * ProfileScreen Component
 * Отвечает за отображение профиля пользователя
 */
class ProfileScreen {
  constructor(apiService, uiService, telegramService) {
    this.apiService = apiService;
    this.uiService = uiService;
    this.telegramService = telegramService;
    this.container = document.getElementById('profile-screen');
    this.userNameElement = this.container.querySelector('#user-name');
    this.userAvatarElement = this.container.querySelector('#user-avatar');
    this.gamesPlayedElement = this.container.querySelector('#games-played');
    this.accuracyElement = this.container.querySelector('#accuracy');
    this.bestStreakElement = this.container.querySelector('#profile-best-streak');
    this.rankPositionElement = this.container.querySelector('#rank-position');
    this.achievementsListElement = this.container.querySelector('#achievements-list');
    this.achievementFiltersElement = document.getElementById('achievement-filters');
    this.statsChartContainer = this.container.querySelector('.stats-chart-container');
    
    // Инициализация фильтров
    this.initializeFilters();
  }

  /**
   * Инициализация экрана профиля
   */
  async init() {
    try {
      this.uiService.showLoading();
      
      // Получение данных профиля
      const profileData = await this.apiService.getUserProfile();
      
      if (profileData) {
        this.renderProfileData(profileData);
        
        // Получение позиции пользователя в рейтинге
        const rankPosition = await this.apiService.getUserPosition();
        this.renderRankPosition(rankPosition);
        
        // Получение подробной статистики
        const statsData = await this.apiService.getUserStats();
        this.renderStatsChart(statsData);
      } else {
        this.uiService.showError('Не удалось загрузить данные профиля');
      }
      
      this.uiService.hideLoading();
    } catch (error) {
      console.error('Error loading profile:', error);
      this.uiService.hideLoading();
      this.uiService.showError('Ошибка при загрузке профиля');
    }
  }

  /**
   * Инициализация фильтров достижений
   */
  initializeFilters() {
    const categories = ['all', 'gameplay', 'accuracy', 'streak', 'social', 'meta'];
    
    this.achievementFiltersElement.innerHTML = categories.map(category => `
      <button class="achievement-filter ${category === 'all' ? 'active' : ''}" data-category="${category}">
        ${this.getCategoryLabel(category)}
      </button>
    `).join('');

    // Обработчики для фильтров
    this.achievementFiltersElement.addEventListener('click', (e) => {
      if (e.target.classList.contains('achievement-filter')) {
        // Убираем active со всех кнопок
        this.achievementFiltersElement.querySelectorAll('.achievement-filter').forEach(btn => 
          btn.classList.remove('active')
        );
        // Добавляем active на нажатую кнопку
        e.target.classList.add('active');
        // Обновляем достижения с выбранным фильтром
        this.loadAchievements(e.target.dataset.category);
      }
    });
  }

  /**
   * Получить локализованное название категории
   */
  getCategoryLabel(category) {
    const labels = {
      'all': 'Все',
      'gameplay': 'Игровой процесс',
      'accuracy': 'Точность',
      'streak': 'Серии',
      'social': 'Социальные',
      'meta': 'Мета'
    };
    return labels[category] || category;
  }

  /**
   * Получить CSS класс для редкости достижения
   */
  getRarityClass(rarity) {
    const classes = {
      'common': 'achievement-common',
      'rare': 'achievement-rare',
      'epic': 'achievement-epic',
      'legendary': 'achievement-legendary'
    };
    return classes[rarity] || 'achievement-common';
  }

  /**
   * Загрузка достижений с фильтрацией
   */
  async loadAchievements(category = 'all') {
    try {
      const url = category === 'all' ? 
        '/api/user/achievements' : 
        `/api/user/achievements?category=${category}`;
      
      const response = await this.apiService.get(url);
      if (response.success) {
        this.renderAchievements(response.achievements, response.unearned);
      }
    } catch (error) {
      console.error('Error loading achievements:', error);
      this.uiService.showError('Ошибка при загрузке достижений');
    }
  }

  /**
   * Отрисовка данных профиля
   * @param {Object} profileData - Данные профиля пользователя
   */
  renderProfileData(profileData) {
    // Имя пользователя
    this.userNameElement.textContent = profileData.username || 'Игрок';
    
    // Аватар пользователя
    if (profileData.photoUrl) {
      this.userAvatarElement.src = profileData.photoUrl;
      this.userAvatarElement.style.display = 'block';
    } else {
      this.userAvatarElement.style.display = 'none';
    }
    
    // Статистика игр
    this.gamesPlayedElement.textContent = profileData.gamesPlayed || 0;
    
    // Точность ответов
    const accuracy = profileData.gamesPlayed > 0 
      ? Math.round((profileData.correctAnswers / (profileData.gamesPlayed * 5)) * 100) 
      : 0;
    this.accuracyElement.textContent = `${accuracy}%`;
    
    // Лучшая серия
    this.bestStreakElement.textContent = profileData.bestStreak || 0;
    
    // Достижения
    this.renderAchievements(profileData.achievements);
  }

  /**
   * Отрисовка достижений пользователя
   */
  renderAchievements(unlocked = [], unearned = []) {
    this.achievementsListElement.innerHTML = '';
    
    // Сначала отображаем разблокированные достижения
    unlocked.forEach(achievement => {
      const achievementElement = this.createAchievementElement(achievement, true);
      this.achievementsListElement.appendChild(achievementElement);
    });
    
    // Затем отображаем неразблокированные
    unearned.forEach(achievement => {
      const achievementElement = this.createAchievementElement(achievement, false);
      this.achievementsListElement.appendChild(achievementElement);
    });
  }

  /**
   * Создание элемента достижения
   */
  createAchievementElement(achievement, isUnlocked) {
    const achievementItem = document.createElement('div');
    achievementItem.className = `achievement-item ${isUnlocked ? '' : 'achievement-locked'} ${this.getRarityClass(achievement.rarity)}`;
    
    let progressHtml = '';
    if (!isUnlocked && achievement.goal) {
      const progressPercent = Math.min(100, Math.round((achievement.progress / achievement.goal) * 100));
      progressHtml = `
        <div class="achievement-progress">
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${progressPercent}%"></div>
          </div>
          <div class="progress-text">${achievement.progress}/${achievement.goal}</div>
        </div>
      `;
    }
    
    achievementItem.innerHTML = `
      <div class="achievement-icon">${achievement.icon}</div>
      <div class="achievement-info">
        <div class="achievement-header">
          <div class="achievement-name">${achievement.name}</div>
          <div class="achievement-points">+${achievement.points}</div>
        </div>
        <div class="achievement-description">${achievement.description}</div>
        ${progressHtml}
        ${isUnlocked ? `
          <div class="achievement-unlocked">
            <span class="check-icon">✓</span>
            Получено ${new Date(achievement.unlockedAt).toLocaleDateString()}
          </div>
        ` : ''}
      </div>
    `;
    
    return achievementItem;
  }

  /**
   * Отрисовка позиции в рейтинге
   * @param {Object} rankData - Данные о позиции в рейтинге
   */
  renderRankPosition(rankData) {
    if (!rankData) {
      this.rankPositionElement.textContent = 'N/A';
      return;
    }
    
    // Отображаем позицию в глобальном рейтинге
    this.rankPositionElement.textContent = rankData.global 
      ? `#${rankData.global}` 
      : 'N/A';
    
    // Можно также добавить отображение позиций в других рейтингах (недельном, дневном)
    const rankInfo = document.createElement('div');
    rankInfo.className = 'rank-info';
    rankInfo.innerHTML = `
      <div class="rank-detail">
        <span class="rank-label">Глобальный:</span>
        <span class="rank-value">${rankData.global ? `#${rankData.global}` : 'N/A'}</span>
      </div>
      <div class="rank-detail">
        <span class="rank-label">Недельный:</span>
        <span class="rank-value">${rankData.weekly ? `#${rankData.weekly}` : 'N/A'}</span>
      </div>
      <div class="rank-detail">
        <span class="rank-label">Дневной:</span>
        <span class="rank-value">${rankData.daily ? `#${rankData.daily}` : 'N/A'}</span>
      </div>
    `;
    
    const container = this.rankPositionElement.parentElement;
    const existingInfo = container.querySelector('.rank-info');
    
    if (existingInfo) {
      container.replaceChild(rankInfo, existingInfo);
    } else {
      container.appendChild(rankInfo);
    }
  }

  /**
   * Отрисовка графика статистики
   * @param {Object} statsData - Данные статистики пользователя
   */
  renderStatsChart(statsData) {
    if (!statsData) {
      this.statsChartContainer.innerHTML = '<p class="text-secondary">Недостаточно данных для отображения статистики</p>';
      return;
    }
    
    this.statsChartContainer.innerHTML = '';
    
    // Создаем график категорий
    if (statsData.categoryDistribution) {
      const categoryChart = document.createElement('div');
      categoryChart.className = 'stats-chart category-chart';
      categoryChart.innerHTML = `
        <h4>Категории</h4>
        <div class="chart-container" id="category-chart"></div>
      `;
      this.statsChartContainer.appendChild(categoryChart);
      
      this.renderPieChart('category-chart', statsData.categoryDistribution);
    }
    
    // Создаем график сложности
    if (statsData.difficultyDistribution) {
      const difficultyChart = document.createElement('div');
      difficultyChart.className = 'stats-chart difficulty-chart';
      difficultyChart.innerHTML = `
        <h4>Сложность</h4>
        <div class="chart-container" id="difficulty-chart"></div>
      `;
      this.statsChartContainer.appendChild(difficultyChart);
      
      this.renderPieChart('difficulty-chart', statsData.difficultyDistribution);
    }
    
    // Создаем график активности по неделям
    if (statsData.weeklyActivity) {
      const activityChart = document.createElement('div');
      activityChart.className = 'stats-chart activity-chart';
      activityChart.innerHTML = `
        <h4>Активность</h4>
        <div class="chart-container" id="activity-chart"></div>
      `;
      this.statsChartContainer.appendChild(activityChart);
      
      this.renderBarChart('activity-chart', statsData.weeklyActivity);
    }
  }

  /**
   * Отрисовка круговой диаграммы
   * @param {String} containerId - ID контейнера для диаграммы
   * @param {Object} data - Данные для диаграммы
   */
  renderPieChart(containerId, data) {
    const container = document.getElementById(containerId);
    
    // Создаем холст SVG для диаграммы
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 100 100');
    container.appendChild(svg);
    
    // Подготавливаем данные
    const total = Object.values(data).reduce((sum, value) => sum + value, 0);
    const items = Object.entries(data).map(([label, value]) => ({
      label,
      value,
      percentage: (value / total) * 100
    }));
    
    // Генерируем цвета
    const colors = ['#FF6B6B', '#4ECDC4', '#FFD166', '#F7FFF7', '#A2D729', '#1A535C'];
    
    // Рисуем секторы
    let startAngle = 0;
    items.forEach((item, index) => {
      const angle = (item.percentage / 100) * 360;
      const endAngle = startAngle + angle;
      
      // Вычисляем координаты дуги
      const x1 = 50 + 40 * Math.cos(Math.PI * startAngle / 180);
      const y1 = 50 + 40 * Math.sin(Math.PI * startAngle / 180);
      const x2 = 50 + 40 * Math.cos(Math.PI * endAngle / 180);
      const y2 = 50 + 40 * Math.sin(Math.PI * endAngle / 180);
      
      // Создаем путь для сектора
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      const largeArcFlag = angle > 180 ? 1 : 0;
      
      path.setAttribute('d', `M50,50 L${x1},${y1} A40,40 0 ${largeArcFlag},1 ${x2},${y2} Z`);
      path.setAttribute('fill', colors[index % colors.length]);
      
      svg.appendChild(path);
      
      startAngle = endAngle;
    });
    
    // Создаем легенду
    const legend = document.createElement('div');
    legend.className = 'chart-legend';
    
    items.forEach((item, index) => {
      const legendItem = document.createElement('div');
      legendItem.className = 'legend-item';
      legendItem.innerHTML = `
        <span class="legend-color" style="background-color: ${colors[index % colors.length]}"></span>
        <span class="legend-label">${item.label}</span>
        <span class="legend-value">${item.percentage.toFixed(1)}%</span>
      `;
      legend.appendChild(legendItem);
    });
    
    container.appendChild(legend);
  }

  /**
   * Отрисовка столбчатой диаграммы
   * @param {String} containerId - ID контейнера для диаграммы
   * @param {Object} data - Данные для диаграммы
   */
  renderBarChart(containerId, data) {
    const container = document.getElementById(containerId);
    
    // Находим максимальное значение для масштабирования
    const maxValue = Math.max(...Object.values(data));
    
    // Создаем контейнер для диаграммы
    const chartContainer = document.createElement('div');
    chartContainer.className = 'bar-chart-container';
    
    // Добавляем столбцы для каждого значения
    Object.entries(data).forEach(([label, value]) => {
      const barContainer = document.createElement('div');
      barContainer.className = 'bar-container';
      
      const bar = document.createElement('div');
      bar.className = 'bar';
      bar.style.height = `${(value / maxValue) * 100}%`;
      
      const barLabel = document.createElement('div');
      barLabel.className = 'bar-label';
      barLabel.textContent = label;
      
      const barValue = document.createElement('div');
      barValue.className = 'bar-value';
      barValue.textContent = value;
      
      barContainer.appendChild(bar);
      barContainer.appendChild(barLabel);
      barContainer.appendChild(barValue);
      
      chartContainer.appendChild(barContainer);
    });
    
    container.appendChild(chartContainer);
  }
}

export default ProfileScreen; 