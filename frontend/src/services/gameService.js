import * as sentryService from './sentryService';

/**
 * Game Service
 * Сервис для управления игровой логикой
 */
class GameService {
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
    
    // Колбэки для игровых событий
    this.onGameStart = null;
    this.onAnswerSubmit = null;
    this.onNextStory = null;
    this.onGameComplete = null;
    this.onTimeOut = null;
  }
  
  /**
   * Начало новой игры
   */
  async startGame() {
    // Создаем транзакцию Sentry для отслеживания производительности
    const transaction = sentryService.startTransaction({
      name: 'startGame',
      op: 'game.start'
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
        
        // Вызываем колбэк начала игры
        if (this.onGameStart) {
          this.onGameStart(this.gameSession);
        }
        
        this.uiService.hideLoading();
        transaction.setStatus('ok');
        return this.gameSession;
      } else {
        throw new Error('Не удалось начать игру. Пожалуйста, попробуйте позже.');
      }
    } catch (error) {
      console.error('Start game error:', error);
      this.uiService.hideLoading();
      this.uiService.showError('Не удалось начать игру. Пожалуйста, попробуйте позже.');
      transaction.setStatus('internal_error');
      sentryService.captureException(error, {
        tags: {
          gameAction: 'startGame'
        }
      });
      transaction.finish();
      return null;
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
    // Создаем транзакцию Sentry для отслеживания производительности
    const transaction = sentryService.startTransaction({
      name: 'submitAnswer',
      op: 'game.answer',
      data: {
        storyIndex: this.currentStoryIndex,
        optionIndex: optionIndex
      }
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
        
        // Вызываем колбэк отправки ответа
        if (this.onAnswerSubmit) {
          this.onAnswerSubmit(optionIndex, result.correctIndex, result.explanation);
        }
      }
      
      transaction.setStatus('ok');
      transaction.finish();
    } catch (error) {
      console.error('Submit answer error:', error);
      this.uiService.hideLoading();
      this.uiService.showError('Ошибка при отправке ответа. Пожалуйста, попробуйте еще раз.');
      transaction.setStatus('internal_error');
      sentryService.captureException(error, {
        tags: {
          gameAction: 'submitAnswer',
          storyIndex: this.currentStoryIndex
        }
      });
      transaction.finish();
      
      // Метрика ошибок ответа на вопрос
      sentryService.captureMessage(
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
    // Создаем транзакцию Sentry для отслеживания производительности
    const transaction = sentryService.startTransaction({
      name: 'nextStory',
      op: 'game.next',
      data: {
        currentStoryIndex: this.currentStoryIndex,
        totalStories: this.gameSession?.stories.length
      }
    });
    
    try {
      if (!this.gameSession || !this.gameSession.gameId) {
        transaction.setStatus('invalid_argument');
        sentryService.captureMessage('Attempted to go to next story without active game', 'warning');
        this.uiService.showError('Не удалось перейти к следующей истории: игра не активна.');
        return;
      }
      
      // Увеличиваем индекс текущей истории
      this.currentStoryIndex++;
      
      // Проверяем, есть ли еще истории
      if (this.currentStoryIndex < this.gameSession.stories.length) {
        const currentStory = this.gameSession.stories[this.currentStoryIndex];
        
        // Отображаем следующую историю
        this.displayStory(this.currentStoryIndex);
        
        // Вызываем колбэк следующей истории
        if (this.onNextStory) {
          this.onNextStory(
            currentStory,
            this.currentStoryIndex,
            this.gameSession.stories.length
          );
        }
      } else {
        // Если истории закончились, завершаем игру
        await this.finishGame();
      }
      
      transaction.setStatus('ok');
    } catch (error) {
      console.error('Next story error:', error);
      this.uiService.showError('Произошла ошибка при переходе к следующей истории. Попробуйте снова.');
      transaction.setStatus('internal_error');
      sentryService.captureException(error, {
        tags: {
          gameAction: 'nextStory',
          storyIndex: this.currentStoryIndex
        }
      });
    } finally {
      transaction.finish();
    }
  }
  
  /**
   * Завершение игры
   */
  async finishGame() {
    // Создаем транзакцию Sentry для отслеживания производительности
    const transaction = sentryService.startTransaction({
      name: 'finishGame',
      op: 'game.finish'
    });
    
    try {
      if (!this.gameSession || !this.gameSession.gameId) {
        transaction.setStatus('invalid_argument');
        sentryService.captureMessage('Attempted to finish game without active game', 'warning');
        this.uiService.showError('Не удалось завершить игру: игра не активна.');
        return;
      }
      
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
      
      // Сбрасываем данные игры
      this.gameSession = null;
      this.currentStoryIndex = 0;
      
      // Вызываем колбэк завершения игры
      if (this.onGameComplete) {
        this.onGameComplete(this.gameResults);
      }
      
      transaction.setStatus('ok');
    } catch (error) {
      console.error('Finish game error:', error);
      this.uiService.hideLoading();
      this.uiService.showError('Ошибка при завершении игры. Результаты могут быть не сохранены.');
      
      // Всё равно показываем результаты
      this.showGameResults();
      transaction.setStatus('internal_error');
      sentryService.captureException(error, {
        tags: {
          gameAction: 'finishGame'
        }
      });
    } finally {
      transaction.finish();
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
  
  /**
   * Обработка истечения времени на ответ
   */
  timeOut() {
    if (this.onTimeOut) {
      this.onTimeOut();
    }
    
    // По умолчанию просто переходим к следующей истории
    setTimeout(() => {
      this.nextStory();
    }, 1000);
  }
  
  /**
   * Прерывание текущей игры пользователем
   */
  abandonGame() {
    // Создаем транзакцию Sentry для отслеживания прерывания игры
    const transaction = sentryService.startTransaction({
      name: 'abandonGame',
      op: 'game.abandon',
      data: {
        currentStoryIndex: this.currentStoryIndex,
        totalStories: this.gameSession?.stories.length
      }
    });
    
    try {
      if (this.gameSession && this.gameSession.gameId) {
        // Отправляем запрос на прерывание игры
        this.apiService.abandonGame({
          gameId: this.gameSession.gameId
        }).catch(error => {
          sentryService.captureException(error, {
            tags: {
              gameAction: 'abandonGame'
            },
            level: 'warning'
          });
        });
        
        // Сбрасываем данные игры
        this.gameSession = null;
        this.currentStoryIndex = 0;
        
        // Устанавливаем статус транзакции как успешную
        transaction.setStatus('ok');
      }
    } catch (error) {
      // Устанавливаем статус транзакции как ошибку и отправляем её в Sentry
      transaction.setStatus('internal_error');
      sentryService.captureException(error, {
        tags: {
          gameAction: 'abandonGame'
        },
        level: 'warning'
      });
    } finally {
      transaction.finish();
    }
  }
}

// Export as a named export instead of default export
export { GameService }; 