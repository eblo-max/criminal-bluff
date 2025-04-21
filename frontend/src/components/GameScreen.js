/**
 * GameScreen Component
 * Отвечает за отображение и логику игрового экрана
 */
class GameScreen {
  constructor(gameService, uiService) {
    this.gameService = gameService;
    this.uiService = uiService;
    this.container = document.getElementById('game-screen');
    this.storyContainer = this.container.querySelector('.story-container');
    this.optionsContainer = this.container.querySelector('.options-container');
    this.progressBar = this.container.querySelector('.progress-bar');
    this.storyCounter = this.container.querySelector('.story-counter');
    this.timer = this.container.querySelector('.timer');
    this.timerInterval = null;
    this.timerValue = 15; // Секунды на ответ
  }

  /**
   * Инициализация игрового экрана
   * @param {Object} story - История для отображения
   * @param {Number} currentStory - Номер текущей истории
   * @param {Number} totalStories - Общее количество историй
   */
  init(story, currentStory, totalStories) {
    this.resetTimer();
    this.renderStory(story);
    this.updateProgress(currentStory, totalStories);
    this.startTimer();
    this.bindEvents();
  }

  /**
   * Отрисовка истории и вариантов ответов
   * @param {Object} story - История для отображения
   */
  renderStory(story) {
    // Отображение текста истории
    this.storyContainer.innerHTML = `
      <p class="story-text">${story.text}</p>
    `;

    // Отображение вариантов ответов
    this.optionsContainer.innerHTML = story.options.map((option, index) => `
      <button class="option" data-index="${index}">
        <span class="option-letter">${String.fromCharCode(65 + index)}</span>
        <span class="option-text">${option}</span>
      </button>
    `).join('');
  }

  /**
   * Обновление прогресс-бара и счетчика историй
   * @param {Number} current - Текущая история
   * @param {Number} total - Общее количество историй
   */
  updateProgress(current, total) {
    const progress = ((current + 1) / total) * 100;
    this.progressBar.style.width = `${progress}%`;
    this.storyCounter.textContent = `${current + 1} из ${total}`;
  }

  /**
   * Запуск таймера
   */
  startTimer() {
    this.timerValue = 15;
    this.updateTimerDisplay();

    this.timerInterval = setInterval(() => {
      this.timerValue--;
      this.updateTimerDisplay();

      if (this.timerValue <= 0) {
        clearInterval(this.timerInterval);
        this.gameService.timeOut();
      }

      // Изменение цвета таймера при малом времени
      if (this.timerValue <= 5) {
        this.timer.classList.add('timer-warning');
      }
    }, 1000);
  }

  /**
   * Обновление отображения таймера
   */
  updateTimerDisplay() {
    this.timer.textContent = this.timerValue;
  }

  /**
   * Сброс таймера
   */
  resetTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
    this.timerValue = 15;
    this.timer.classList.remove('timer-warning');
    this.updateTimerDisplay();
  }

  /**
   * Привязка обработчиков событий
   */
  bindEvents() {
    // Делегирование событий для вариантов ответа
    this.optionsContainer.addEventListener('click', (e) => {
      const option = e.target.closest('.option');
      if (option) {
        const optionIndex = parseInt(option.getAttribute('data-index'));
        this.resetTimer();
        this.gameService.submitAnswer(optionIndex);
      }
    });
  }

  /**
   * Показать выбранный вариант и правильный ответ
   * @param {Number} selectedIndex - Индекс выбранного варианта
   * @param {Number} correctIndex - Индекс правильного варианта
   */
  showResult(selectedIndex, correctIndex) {
    const options = this.optionsContainer.querySelectorAll('.option');
    
    options.forEach((option, index) => {
      if (index === correctIndex) {
        option.classList.add('correct');
      } else if (index === selectedIndex && selectedIndex !== correctIndex) {
        option.classList.add('incorrect');
      }
    });
  }

  /**
   * Деактивация экрана
   */
  deactivate() {
    this.resetTimer();
  }
}

export default GameScreen; 