/**
 * ResultScreen Component
 * Отвечает за отображение экрана результатов игры
 */
class ResultScreen {
  constructor(telegramService) {
    this.telegramService = telegramService;
    this.container = document.getElementById('game-result-screen');
    this.scoreElement = this.container.querySelector('.final-score');
    this.correctAnswersElement = this.container.querySelector('.correct-answers');
    this.streakElement = this.container.querySelector('.best-streak');
    this.achievementsContainer = this.container.querySelector('.achievements-container');
    this.playAgainBtn = this.container.querySelector('#play-again-btn');
    this.shareResultBtn = this.container.querySelector('#share-result-btn');
  }

  /**
   * Инициализация экрана результатов
   * @param {Object} results - Результаты игры
   */
  init(results) {
    this.renderResults(results);
    this.bindEvents(results);
  }

  /**
   * Отрисовка результатов игры
   * @param {Object} results - Результаты игры
   */
  renderResults(results) {
    // Обновление основных результатов
    this.scoreElement.textContent = results.totalScore;
    this.correctAnswersElement.textContent = results.correctAnswers;
    this.streakElement.textContent = results.bestStreak;

    // Отображение новых достижений, если они есть
    if (results.newAchievements && results.newAchievements.length > 0) {
      this.renderAchievements(results.newAchievements);
    } else {
      this.achievementsContainer.style.display = 'none';
    }

    // Анимация числа очков
    this.animateScore(results.totalScore);
  }

  /**
   * Анимация изменения счета
   * @param {Number} targetScore - Целевое значение счета
   */
  animateScore(targetScore) {
    const duration = 1000; // Продолжительность анимации в мс
    const start = 0;
    const startTime = performance.now();

    const animateScoreStep = (currentTime) => {
      const elapsedTime = currentTime - startTime;
      const progress = Math.min(elapsedTime / duration, 1);
      
      // Используем нелинейную функцию для более динамичной анимации
      const easedProgress = this.easeOutQuart(progress);
      const currentValue = Math.floor(start + easedProgress * (targetScore - start));
      
      this.scoreElement.textContent = currentValue;
      
      if (progress < 1) {
        requestAnimationFrame(animateScoreStep);
      } else {
        this.scoreElement.textContent = targetScore;
      }
    };

    requestAnimationFrame(animateScoreStep);
  }

  /**
   * Функция плавности анимации
   * @param {Number} x - Прогресс анимации (0-1)
   * @returns {Number} - Плавное значение прогресса
   */
  easeOutQuart(x) {
    return 1 - Math.pow(1 - x, 4);
  }

  /**
   * Отрисовка новых достижений
   * @param {Array} achievements - Массив достижений
   */
  renderAchievements(achievements) {
    this.achievementsContainer.style.display = 'block';
    const achievementsList = this.achievementsContainer.querySelector('.achievements-list');
    achievementsList.innerHTML = '';

    achievements.forEach(achievement => {
      const achievementItem = document.createElement('div');
      achievementItem.className = 'achievement-item new-achievement';
      
      achievementItem.innerHTML = `
        <div class="achievement-icon">${this.getAchievementIcon(achievement.name)}</div>
        <div class="achievement-name">${achievement.name}</div>
        <div class="achievement-description">${achievement.description}</div>
      `;
      
      achievementsList.appendChild(achievementItem);
    });
  }

  /**
   * Возвращает иконку для конкретного достижения
   * @param {String} achievementName - Название достижения
   * @returns {String} - Эмодзи для иконки
   */
  getAchievementIcon(achievementName) {
    const icons = {
      'Новичок': '🎮',
      'Эксперт': '🧠',
      'Мастер дедукции': '🔍',
      'Скоростной детектив': '⚡',
      'Серийный игрок': '🏆'
    };

    return icons[achievementName] || '🎯';
  }

  /**
   * Привязка обработчиков событий
   * @param {Object} results - Результаты игры для шаринга
   */
  bindEvents(results) {
    // Событие для кнопки "Играть снова"
    this.playAgainBtn.addEventListener('click', () => {
      // Событие будет обрабатываться на уровне выше
    });

    // Событие для кнопки "Поделиться результатом"
    this.shareResultBtn.addEventListener('click', () => {
      this.telegramService.shareResults(results);
    });
  }
}

export default ResultScreen; 