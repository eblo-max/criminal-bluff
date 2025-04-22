import { sharedState } from './common.js';
import { apiService } from './apiService.js';
import { uiService } from './uiService';

/**
 * Game Service
 * Сервис для управления игровой логикой
 */
class GameService {
  constructor() {
    this.apiService = null;
    this.uiService = null;
    
    this.userId = null;
    this.gameId = null;
    this.currentStoryId = null;
    this.currentStoryIndex = 0;
    this.totalStories = 0;
    this.stories = [];
    this.answers = [];
    this.timer = null;
    this.timeLeft = 0;
    this.storiesDuration = 15; // По умолчанию время на ответ - 15 секунд
    this.timerUpdateInterval = 50; // Интервал обновления таймера в ms
    this.isInitialized = false;
    
    // Результаты игры
    this.gameResults = {
      correctAnswers: 0,
      totalScore: 0,
      bestStreak: 0
    };
    
    // Таймер
    this.timerBarElement = null;
    this.timerTextElement = null;
    
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
   * Инициализация сервиса игры
   * @param {Object} apiService - сервис для работы с API
   * @param {Object} uiService - сервис для работы с UI
   */
  init(apiService, uiService) {
    if (this.isInitialized) {
      sharedState.log('GameService уже инициализирован', 'warn');
      return;
    }
    
    try {
      this.apiService = apiService;
      this.uiService = uiService;
      
      // Состояние игры
      this.gameId = null;
      this.stories = [];
      this.currentStoryIndex = 0;
      this.answers = [];
      this.timer = null;
      this.remainingTime = 0;
      this.gameResults = null;
      
      this.isInitialized = true;
      this.isGameActive = false;
      
      sharedState.log('GameService инициализирован успешно');
      
      // Безопасно получаем ссылки на DOM-элементы таймера
      this.timerBarElement = document.querySelector('.timer-bar');
      this.timerTextElement = document.querySelector('.timer-text');
      
      return true;
    } catch (error) {
      sharedState.log(`Ошибка при инициализации GameService: ${error.message}`, 'error');
      return false;
    }
  }
  
  /**
   * Начать новую игру
   * @param {string} userId - идентификатор пользователя
   * @returns {Promise<boolean>} - успешность начала игры
   */
  async startGame(userId) {
    try {
      if (!this.isInitialized) {
        throw new Error('GameService не инициализирован');
      }
      
      if (this.isGameActive) {
        this.resetGameState();
      }
      
      // Начинаем транзакцию для отслеживания производительности
      sharedState.log('Начинаем новую игру', 'info');
      
      // Запрашиваем данные для новой игры
      const response = await this.apiService.startGame();
      
      if (!response.success) {
        throw new Error(response.message || 'Не удалось начать игру');
      }
      
      // Сохраняем данные игры
      this.gameId = response.gameId;
      this.stories = response.stories || [];
      this.currentStoryIndex = 0;
      this.answers = [];
      this.isGameActive = true;
      
      // Отображаем первую историю
      if (this.stories.length > 0) {
        this.displayStory(0);
        return true;
      } else {
        throw new Error('Получен пустой список историй');
      }
    } catch (error) {
      sharedState.log(`Ошибка при начале игры: ${error.message}`, 'error');
      return false;
    }
  }
  
  /**
   * Сброс состояния игры
   */
  resetGameState() {
    this.gameId = null;
    this.currentStoryId = null;
    this.currentStoryIndex = 0;
    this.answers = [];
    this.clearTimer();
    
    // Скрываем результаты ответа, если они отображались
    sharedState.safelyManipulateDOM('#answer-result', element => {
      element.classList.add('hidden');
    });
    
    sharedState.safelyManipulateDOM('#game-results', element => {
      element.classList.add('hidden');
    });
  }
  
  /**
   * Отобразить историю с указанным индексом
   * @param {number} index - индекс истории
   * @returns {boolean} - результат отображения
   */
  displayStory(index) {
    if (!this.isInitialized) {
      sharedState.log('GameService не инициализирован', 'error');
      return false;
    }
    
    try {
      if (index < 0 || index >= this.stories.length) {
        sharedState.log(`Некорректный индекс истории: ${index}`, 'error');
        return false;
      }
      
      const story = this.stories[index];
      this.currentStoryId = story.id;
      this.currentStoryIndex = index;
      
      // Обновляем DOM-элементы
      sharedState.safelyManipulateDOM('#story-text', element => {
        element.innerHTML = story.text || 'Загрузка истории...';
      });
      
      sharedState.safelyManipulateDOM('#story-container', element => {
        element.classList.remove('hidden');
      });
      
      sharedState.safelyManipulateDOM('#answer-options', element => {
        element.innerHTML = '';
        
        // Создаем кнопки для вариантов ответа
        if (story.options && Array.isArray(story.options)) {
          story.options.forEach((option, optionIndex) => {
            const button = document.createElement('button');
            button.classList.add('answer-button');
            button.dataset.optionId = option.id;
            button.textContent = option.text || `Вариант ${optionIndex + 1}`;
            
            button.addEventListener('click', () => {
              this.submitAnswer(option.id, optionIndex);
            });
            
            element.appendChild(button);
          });
        }
      });
      
      // Обновляем прогресс
      sharedState.safelyManipulateDOM('#story-progress', element => {
        element.textContent = `История ${index + 1} из ${this.totalStories}`;
      });
      
      // Запускаем таймер
      this.startTimer(story.duration || this.storiesDuration);
      
      // Запоминаем время начала ответа
      this.answerStartTime = Date.now();
      
      return true;
    } catch (error) {
      sharedState.log(`Ошибка при отображении истории: ${error.message}`, 'error');
      return false;
    }
  }
  
  /**
   * Запуск таймера для текущей истории
   */
  startTimer(duration) {
    // Очищаем предыдущий таймер, если он был
    this.clearTimer();
    
    // Инициализируем время
    this.timeLeft = duration * 1000; // Переводим в миллисекунды
    
    // Обновляем UI таймера
    this.updateTimerUI();
    
    // Запускаем интервал обновления
    this.timer = setInterval(() => {
      this.timeLeft = Math.max(0, this.timeLeft - this.timerUpdateInterval);
      
      if (this.timeLeft <= 0) {
        this.timeLeft = 0;
        this.clearTimer();
        this.timeOut(); // Вызываем функцию по истечении времени
      }
      
      this.updateTimerUI();
    }, this.timerUpdateInterval);
  }
  
  /**
   * Очистка таймера
   */
  clearTimer() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
  
  /**
   * Обновление UI таймера
   */
  updateTimerUI() {
    sharedState.safelyManipulateDOM('#timer', element => {
      // Округляем до десятых
      const seconds = Math.max(0, Math.round(this.timeLeft / 1000)).toFixed(1);
      element.textContent = seconds;
      
      // Меняем цвет при малом количестве времени
      if (this.timeLeft <= 5) {
        element.classList.add('timer-warning');
      } else {
        element.classList.remove('timer-warning');
      }
    });
    
    // Обновление прогресс-бара
    sharedState.safelyManipulateDOM('#timer-progress', element => {
      const progress = (this.timeLeft / this.storiesDuration) * 100;
      element.style.width = `${progress}%`;
      
      // Меняем цвет прогресс-бара при малом количестве времени
      if (this.timeLeft <= 5) {
        element.classList.add('timer-progress-warning');
      } else {
        element.classList.remove('timer-progress-warning');
      }
    });
  }
  
  /**
   * Отправка ответа на сервер
   * @param {string} optionId - ID выбранного варианта
   * @param {number} optionIndex - индекс выбранного варианта
   */
  async submitAnswer(optionId, optionIndex) {
    if (!this.isInitialized || !this.gameId || !this.currentStoryId) {
      sharedState.log('Невозможно отправить ответ: игра не инициализирована или нет активной истории', 'error');
      return;
    }
    
    try {
      // Останавливаем таймер
      this.clearTimer();
      
      // Отправляем ответ на сервер
      const result = await this.apiService.submitAnswer(
        this.gameId,
        this.currentStoryId,
        optionId,
        this.timeLeft / 1000
      );
      
      if (!result) {
        sharedState.log('Получен пустой ответ от сервера при отправке ответа', 'error');
        return;
      }
      
      // Сохраняем ответ
      this.answers.push({
        storyId: this.currentStoryId,
        optionId: optionId,
        optionIndex: optionIndex,
        isCorrect: result.isCorrect,
        explanation: result.explanation,
        points: result.points
      });
      
      // Показываем результат
      this.showAnswerResult(result, optionIndex);
    } catch (error) {
      sharedState.log(`Ошибка при отправке ответа: ${error.message}`, 'error');
      
      // Показываем сообщение об ошибке
      this.uiService.showError(`Ошибка: ${error.message}`);
    }
  }
  
  /**
   * Показать результат ответа
   * @param {Object} result - результат ответа с сервера
   * @param {number} selectedIndex - индекс выбранного варианта
   */
  showAnswerResult(result, selectedIndex) {
    try {
      // Скрываем историю
      sharedState.safelyManipulateDOM('#story-container', element => {
        element.classList.add('hidden');
      });
      
      // Обновляем результат ответа
      sharedState.safelyManipulateDOM('#answer-result', element => {
        element.classList.remove('hidden');
        
        // Устанавливаем заголовок и класс в зависимости от правильности ответа
        const resultTitle = element.querySelector('#result-title');
        if (resultTitle) {
          resultTitle.textContent = result.isCorrect ? 'Верно!' : 'Неверно!';
          resultTitle.className = result.isCorrect ? 'result-correct' : 'result-incorrect';
        }
        
        // Устанавливаем объяснение
        const resultExplanation = element.querySelector('#result-explanation');
        if (resultExplanation) {
          resultExplanation.innerHTML = result.explanation || 'Нет объяснения';
        }
        
        // Устанавливаем количество очков
        const resultPoints = element.querySelector('#result-points');
        if (resultPoints) {
          resultPoints.textContent = `+${result.points || 0}`;
        }
      });
      
      // Добавляем кнопку "Далее"
      sharedState.safelyManipulateDOM('#next-button-container', element => {
        element.classList.remove('hidden');
        
        const nextButton = element.querySelector('#next-button');
        if (nextButton) {
          // Удаляем старые обработчики
          const newNextButton = nextButton.cloneNode(true);
          nextButton.parentNode.replaceChild(newNextButton, nextButton);
          
          // Добавляем новый обработчик
          newNextButton.addEventListener('click', () => {
            // Проверяем, была ли это последняя история
            if (this.currentStoryIndex >= this.totalStories - 1) {
              this.finishGame();
            } else {
              this.nextStory();
            }
          });
        }
      });
    } catch (error) {
      sharedState.log(`Ошибка при отображении результата ответа: ${error.message}`, 'error');
    }
  }
  
  /**
   * Переход к следующей истории
   */
  async nextStory() {
    try {
      // Скрываем результат предыдущего ответа
      sharedState.safelyManipulateDOM('#answer-result', element => {
        element.classList.add('hidden');
      });
      
      sharedState.safelyManipulateDOM('#next-button-container', element => {
        element.classList.add('hidden');
      });
      
      // Отображаем следующую историю
      const nextIndex = this.currentStoryIndex + 1;
      if (nextIndex < this.stories.length) {
        const success = this.displayStory(nextIndex);
        
        return success;
      } else {
        // Если больше нет историй, заканчиваем игру
        return this.finishGame();
      }
    } catch (error) {
      sharedState.log(`Ошибка при переходе к следующей истории: ${error.message}`, 'error');
      
      // Показываем сообщение об ошибке
      this.uiService.showError(`Ошибка: ${error.message}`);
      
      return false;
    }
  }
  
  /**
   * Завершение игры
   */
  async finishGame() {
    try {
      // Скрываем результат ответа, если он отображается
      sharedState.safelyManipulateDOM('#answer-result', element => {
        element.classList.add('hidden');
      });
      
      // Скрываем кнопку "Далее"
      sharedState.safelyManipulateDOM('#next-button-container', element => {
        element.classList.add('hidden');
      });
      
      // Отправляем запрос на завершение игры
      const result = await this.apiService.finishGame(this.gameId, this.answers);
      
      if (!result) {
        sharedState.log('Получен пустой ответ от сервера при завершении игры', 'error');
        return false;
      }
      
      // Показываем результаты игры
      return this.showGameResults(result);
    } catch (error) {
      sharedState.log(`Ошибка при завершении игры: ${error.message}`, 'error');
      
      // Показываем сообщение об ошибке
      this.uiService.showError(`Ошибка: ${error.message}`);
      
      return false;
    }
  }
  
  /**
   * Показать результаты игры
   * @param {Object} results - результаты игры с сервера
   */
  showGameResults(results) {
    try {
      // Обновляем DOM
      sharedState.safelyManipulateDOM('#game-results', element => {
        element.classList.remove('hidden');
        
        // Заполняем данные результатов
        const totalScore = element.querySelector('#total-score');
        if (totalScore) {
          totalScore.textContent = results.totalScore || 0;
        }
        
        const correctAnswers = element.querySelector('#correct-answers');
        if (correctAnswers) {
          correctAnswers.textContent = `${results.correctAnswers || 0} из ${this.totalStories}`;
        }
        
        // Настраиваем кнопку "Новая игра"
        const newGameButton = element.querySelector('#new-game-button');
        if (newGameButton) {
          // Удаляем старые обработчики
          const newButton = newGameButton.cloneNode(true);
          newGameButton.parentNode.replaceChild(newButton, newGameButton);
          
          // Добавляем новый обработчик
          newButton.addEventListener('click', () => {
            // Скрываем результаты
            element.classList.add('hidden');
            
            // Запускаем новую игру
            this.startGame(this.userId);
          });
        }
        
        // Настраиваем кнопку "На главную"
        const homeButton = element.querySelector('#home-button');
        if (homeButton) {
          // Удаляем старые обработчики
          const newButton = homeButton.cloneNode(true);
          homeButton.parentNode.replaceChild(newButton, homeButton);
          
          // Добавляем новый обработчик
          newButton.addEventListener('click', () => {
            // Скрываем результаты
            element.classList.add('hidden');
            
            // Скрываем экран игры
            sharedState.safelyManipulateDOM('#game-screen', gameScreen => {
              gameScreen.classList.add('hidden');
            });
            
            // Показываем главное меню
            if (this.uiService) {
              this.uiService.showScreen('main-menu');
            }
          });
        }
      });
      
      return true;
    } catch (error) {
      sharedState.log(`Ошибка при отображении результатов игры: ${error.message}`, 'error');
      
      // Показываем сообщение об ошибке
      this.uiService.showError(`Ошибка: ${error.message}`);
      
      return false;
    }
  }
  
  /**
   * Получить результаты текущей игры
   * @returns {Object} - объект с результатами игры
   */
  getGameResults() {
    return {
      gameId: this.gameId,
      totalStories: this.totalStories,
      answeredStories: this.answers.length,
      correctAnswers: this.answers.filter(answer => answer.isCorrect).length,
      totalScore: this.answers.reduce((sum, answer) => sum + (answer.points || 0), 0)
    };
  }
  
  /**
   * Обработка истечения времени
   */
  timeOut() {
    sharedState.log('Время на ответ истекло', 'info');
    
    // Отправляем на сервер, что время истекло
    this.submitAnswer(null, -1);
  }
  
  /**
   * Прерывание игры
   */
  abandonGame() {
    try {
      // Очищаем таймер
      this.clearTimer();
      
      // Если есть активная игра, отправляем запрос на прерывание
      if (this.gameId) {
        // Асинхронно отправляем запрос на прерывание игры
        this.apiService.abandonGame(this.gameId).catch(error => {
          sharedState.log(`Ошибка при отправке запроса на прерывание игры: ${error.message}`, 'error');
        });
      }
      
      // Сбрасываем состояние игры
      this.resetGameState();
      
      // Скрываем экран игры
      sharedState.safelyManipulateDOM('#game-screen', element => {
        element.classList.add('hidden');
      });
      
      return true;
    } catch (error) {
      sharedState.log(`Ошибка при прерывании игры: ${error.message}`, 'error');
      return false;
    }
  }
}

// Создаем и экспортируем единственный экземпляр сервиса
export const gameService = new GameService(); 