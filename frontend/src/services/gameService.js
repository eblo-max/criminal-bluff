import httpService from './httpService';
import errorService from './errorService';

/**
 * Game Service
 * Сервис для управления игровой логикой
 */
export class GameService {
  constructor(apiService, uiService) {
    this.apiService = apiService;
    this.uiService = uiService;
    
    // Текущая игровая сессия
    this.gameSession = null;
    
    // Текущая история
    this.currentStoryIndex = 0;
    
    // Результаты игры
    this.gameResults = {
      correctAnswers: 0,
      totalScore: 0,
      bestStreak: 0
    };
    
    // Таймер
    this.timer = null;
    this.timerValue = 15;
    this.timerBarElement = document.querySelector('.timer-bar');
    this.timerTextElement = document.querySelector('.timer-text');
    
    // Начало ответа (для расчета времени ответа)
    this.answerStartTime = null;
  }
  
  /**
   * Начало новой игры
   */
  async startGame() {
    const transaction = errorService.startTransaction({
      op: 'game',
      name: 'start_game'
    });
    
    try {
      this.uiService.showLoading();
      
      // Получаем новую игровую сессию
      const gameData = await this.apiService.startGame();
      
      if (gameData && gameData.stories && gameData.stories.length > 0) {
        this.gameSession = gameData;
        this.currentStoryIndex = 0;
        this.gameResults = {
          correctAnswers: 0,
          totalScore: 0,
          bestStreak: 0
        };
        
        // Отображаем первую историю
        this.displayStory(this.currentStoryIndex);
      } else {
        throw new Error('Не удалось начать игру. Пожалуйста, попробуйте позже.');
      }
      
      this.uiService.hideLoading();
      transaction.finish();
    } catch (error) {
      console.error('Start game error:', error);
      this.uiService.hideLoading();
      this.uiService.showError('Не удалось начать игру. Пожалуйста, попробуйте позже.');
      transaction.setStatus('error');
      transaction.finish();
    }
  }
  
  /**
   * Отображение истории
   * @param {number} index - индекс истории для отображения
   */
  displayStory(index) {
    if (!this.gameSession || !this.gameSession.stories || index >= this.gameSession.stories.length) {
      console.error('Invalid story index or no stories available');
      return;
    }
    
    const story = this.gameSession.stories[index];
    
    // Обновляем текст истории
    document.querySelector('.story-text').textContent = story.text;
    
    // Обновляем варианты ответа
    const options = document.querySelectorAll('.option');
    story.options.forEach((option, i) => {
      options[i].textContent = option;
      options[i].classList.remove('correct', 'incorrect');
      options[i].disabled = false;
    });
    
    // Обновляем прогресс
    document.querySelector('.current-question').textContent = index + 1;
    document.querySelector('.total-questions').textContent = this.gameSession.stories.length;
    
    // Обновляем счетчик серии
    document.querySelector('.streak-count').textContent = this.gameSession.streak || 0;
    
    // Сбрасываем и запускаем таймер
    this.resetTimer();
    this.startTimer();
    
    // Запоминаем время начала ответа
    this.answerStartTime = Date.now();
  }
  
  /**
   * Запуск таймера
   */
  startTimer() {
    clearInterval(this.timer);
    this.timerValue = 15;
    this.updateTimerUI();
    
    this.timer = setInterval(() => {
      this.timerValue--;
      this.updateTimerUI();
      
      if (this.timerValue <= 0) {
        clearInterval(this.timer);
        this.handleTimerEnd();
      }
    }, 1000);
  }
  
  /**
   * Сброс таймера
   */
  resetTimer() {
    clearInterval(this.timer);
    this.timerValue = 15;
    this.updateTimerUI();
  }
  
  /**
   * Обновление UI таймера
   */
  updateTimerUI() {
    if (this.timerBarElement && this.timerTextElement) {
      const percentage = (this.timerValue / 15) * 100;
      this.timerBarElement.style.width = `${percentage}%`;
      this.timerTextElement.textContent = this.timerValue;
      
      // Меняем цвет при малом времени
      if (this.timerValue <= 5) {
        this.timerBarElement.style.backgroundColor = 'var(--error-color)';
      } else {
        this.timerBarElement.style.backgroundColor = 'var(--accent-color)';
      }
    }
  }
  
  /**
   * Обработка окончания времени
   */
  handleTimerEnd() {
    // Если время вышло, отправляем пустой ответ
    this.submitAnswer(-1, true);
  }
  
  /**
   * Отправка ответа
   * @param {number} optionIndex - индекс выбранного варианта ответа
   * @param {boolean} isTimeout - флаг окончания времени
   */
  async submitAnswer(optionIndex, isTimeout = false) {
    const transaction = errorService.startTransaction({
      op: 'game',
      name: 'submit_answer'
    });
    
    try {
      // Останавливаем таймер
      clearInterval(this.timer);
      
      // Если время вышло, блокируем кнопки
      if (isTimeout) {
        const options = document.querySelectorAll('.option');
        options.forEach(option => {
          option.disabled = true;
        });
      }
      
      // Вычисляем время ответа
      const responseTime = this.answerStartTime ? Date.now() - this.answerStartTime : 15000;
      
      // Данные для отправки
      const answerData = {
        gameId: this.gameSession.id,
        storyId: this.gameSession.stories[this.currentStoryIndex]._id,
        selectedOption: isTimeout ? null : optionIndex,
        responseTime
      };
      
      this.uiService.showLoading();
      
      // Отправляем ответ на сервер
      const result = await this.apiService.submitAnswer(answerData);
      
      this.uiService.hideLoading();
      
      // Если получили результат
      if (result) {
        // Обновляем игровую сессию
        this.gameSession = result.gameSession;
        
        // Показываем результат ответа
        this.showAnswerResult(result);
        
        // Обновляем UI счета
        document.querySelector('.streak-count').textContent = this.gameSession.streak || 0;
      }
      
      transaction.finish();
    } catch (error) {
      console.error('Submit answer error:', error);
      this.uiService.hideLoading();
      this.uiService.showError('Ошибка при отправке ответа. Пожалуйста, попробуйте еще раз.');
      transaction.setStatus('error');
      transaction.finish();
      
      // Метрика ошибок ответа на вопрос
      errorService.captureMessage(
        `Ошибка при отправке ответа: ${error.message}`, 
        'error',
        {
          tags: {
            gameId: this.gameSession.id,
            questionId: this.gameSession.stories[this.currentStoryIndex]._id,
            answerId: isTimeout ? null : optionIndex
          },
          extra: {
            responseTime
          }
        }
      );
      
      throw error;
    }
  }
  
  /**
   * Отображение результата ответа
   * @param {Object} result - результат ответа с сервера
   */
  showAnswerResult(result) {
    const answerResultScreen = document.getElementById('answer-result-screen');
    const resultIcon = answerResultScreen.querySelector('.result-icon');
    const resultTitle = answerResultScreen.querySelector('.result-title');
    const explanationText = answerResultScreen.querySelector('.explanation-text');
    const scoreValue = answerResultScreen.querySelector('.score-value');
    const streakValue = answerResultScreen.querySelector('.streak-value');
    const nextBtn = answerResultScreen.querySelector('.next-btn');
    
    // Обновляем UI результата
    if (result.isCorrect) {
      resultIcon.innerHTML = '✅';
      resultTitle.textContent = 'Правильно!';
      resultTitle.style.color = 'var(--success-color)';
      this.gameResults.correctAnswers++;
    } else {
      resultIcon.innerHTML = '❌';
      resultTitle.textContent = 'Неверно!';
      resultTitle.style.color = 'var(--error-color)';
    }
    
    // Объяснение
    explanationText.textContent = result.explanation;
    
    // Очки и серия
    scoreValue.textContent = `+${result.pointsEarned || 0}`;
    streakValue.textContent = this.gameSession.streak || 0;
    
    // Обновляем общий счет
    this.gameResults.totalScore += (result.pointsEarned || 0);
    
    // Обновляем лучшую серию
    if (this.gameSession.streak > this.gameResults.bestStreak) {
      this.gameResults.bestStreak = this.gameSession.streak;
    }
    
    // Если это последняя история, меняем текст кнопки
    if (this.currentStoryIndex === this.gameSession.stories.length - 1) {
      nextBtn.textContent = 'Завершить игру';
    } else {
      nextBtn.textContent = 'Следующая история';
    }
    
    // Показываем экран результата
    this.uiService.showScreen(answerResultScreen);
  }
  
  /**
   * Переход к следующей истории
   */
  async nextStory() {
    this.currentStoryIndex++;
    
    // Если есть еще истории, показываем следующую
    if (this.currentStoryIndex < this.gameSession.stories.length) {
      // Показываем игровой экран
      this.uiService.showScreen(document.getElementById('game-screen'));
      
      // Отображаем следующую историю
      this.displayStory(this.currentStoryIndex);
    } else {
      // Завершаем игру, если истории закончились
      this.finishGame();
    }
  }
  
  /**
   * Завершение игры
   */
  async finishGame() {
    const transaction = errorService.startTransaction({
      op: 'game',
      name: 'finish_game'
    });
    
    try {
      this.uiService.showLoading();
      
      // Отправляем данные о завершении игры
      const gameData = {
        gameId: this.gameSession.id
      };
      
      const result = await this.apiService.finishGame(gameData);
      
      this.uiService.hideLoading();
      
      // Обновляем игровые результаты
      if (result) {
        this.gameResults = {
          ...this.gameResults,
          ...result
        };
      }
      
      // Отображаем экран результатов
      this.showGameResults();
      
      transaction.finish();
    } catch (error) {
      console.error('Finish game error:', error);
      this.uiService.hideLoading();
      this.uiService.showError('Ошибка при завершении игры. Результаты могут быть не сохранены.');
      
      // Всё равно показываем результаты
      this.showGameResults();
      transaction.setStatus('error');
      transaction.finish();
      
      // Критическая ошибка, так как влияет на сохранение результатов
      errorService.captureException(error, {
        tags: {
          component: 'gameService',
          method: 'finishGame',
          gameId: this.gameSession.id
        },
        level: 'fatal'
      });
      
      throw error;
    }
  }
  
  /**
   * Отображение результатов игры
   */
  showGameResults() {
    const gameResultScreen = document.getElementById('game-result-screen');
    
    // Обновляем UI результатов
    document.getElementById('correct-answers').textContent = this.gameResults.correctAnswers;
    document.getElementById('total-score').textContent = this.gameResults.totalScore;
    document.getElementById('best-streak').textContent = this.gameResults.bestStreak;
    
    // Показываем экран результатов
    this.uiService.showScreen(gameResultScreen);
  }
  
  /**
   * Получение результатов игры
   * @returns {Object} - результаты игры
   */
  getGameResults() {
    return this.gameResults;
  }
} 