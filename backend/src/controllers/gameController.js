/**
 * Контроллер для управления игровым процессом
 */
const { Story, GameSession, User } = require('../models');
const logger = require('../utils/logger');
const { calculateScore } = require('../utils/scoreCalculator');
const { checkAchievements } = require('../utils/achievementChecker');
const redisService = require('../services/redisService');
const leaderboardService = require('../services/leaderboardService');
const { startTransaction, captureException } = require('../config/sentry');

/**
 * Начать новую игру
 * Получить 5 случайных историй и создать игровую сессию
 */
exports.startGame = async (req, res) => {
  // Создаем транзакцию Sentry для отслеживания производительности
  const transaction = startTransaction({
    op: 'game',
    name: 'start_game'
  });
  
  try {
    const user = req.user;
    
    // Проверяем наличие активной сессии
    const activeSession = await GameSession.findOne({
      userId: user._id,
      status: 'active'
    });
    
    // Если есть активная сессия, продолжаем её
    if (activeSession) {
      const stories = await Story.find({
        _id: { $in: activeSession.stories }
      });
      
      transaction.finish();
      return res.status(200).json({
        success: true,
        message: 'Найдена активная игровая сессия',
        id: activeSession._id,
        stories,
        currentStory: activeSession.currentStory,
        streak: activeSession.streak
      });
    }
    
    // Получаем случайные истории (с учетом сложности и разных категорий)
    const totalStories = await Story.countDocuments({ active: true });
    
    // Если историй недостаточно, возвращаем ошибку
    if (totalStories < 5) {
      transaction.setStatus('failed');
      transaction.finish();
      return res.status(404).json({
        success: false,
        message: 'Недостаточно историй для начала игры'
      });
    }
    
    // Агрегация для получения 5 случайных историй с разнообразием
    const stories = await Story.aggregate([
      { $match: { active: true } },
      { $sample: { size: 5 } }
    ]);
    
    // Создаем новую игровую сессию
    const gameSession = new GameSession({
      userId: user._id,
      telegramId: user.telegramId,
      stories: stories.map(story => story._id),
      status: 'active',
      startedAt: new Date()
    });
    
    await gameSession.save();
    
    // Обновляем статус пользователя
    await User.findByIdAndUpdate(user._id, {
      lastPlayed: new Date()
    });
    
    // Добавляем достижение "Новичок", если это первая игра
    if (user.gamesPlayed === 0) {
      const newAchievement = {
        name: 'Новичок',
        description: 'Сыграть первую игру',
        unlockedAt: new Date()
      };
      
      await User.findByIdAndUpdate(user._id, {
        $push: { achievements: newAchievement }
      });
    }
    
    // Завершаем транзакцию
    transaction.finish();
    
    // Возвращаем данные для начала игры
    return res.status(200).json({
      success: true,
      message: 'Новая игра успешно начата',
      id: gameSession._id,
      stories,
      currentStory: 0,
      streak: 0
    });
    
  } catch (error) {
    // Отмечаем транзакцию как неудачную и завершаем её
    transaction.setStatus('error');
    transaction.finish();
    
    // Отправляем ошибку в Sentry
    captureException(error, {
      tags: {
        component: 'gameController',
        method: 'startGame',
        userId: req.user?._id
      }
    });
    
    logger.error(`Error starting game: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Ошибка при начале игры'
    });
  }
};

/**
 * Отправить ответ на текущую историю
 */
exports.submitAnswer = async (req, res) => {
  // Создаем транзакцию Sentry для отслеживания производительности
  const transaction = startTransaction({
    op: 'game',
    name: 'submit_answer'
  });
  
  try {
    const user = req.user;
    const { gameId, storyId, selectedOption, responseTime } = req.body;
    
    // Проверка наличия всех нужных данных
    if (!gameId || !storyId) {
      transaction.setStatus('failed');
      transaction.finish();
      return res.status(400).json({
        success: false,
        message: 'Не указан ID игры или истории'
      });
    }
    
    // Получаем игровую сессию
    const gameSession = await GameSession.findOne({
      _id: gameId,
      userId: user._id,
      status: 'active'
    });
    
    if (!gameSession) {
      transaction.setStatus('failed');
      transaction.finish();
      return res.status(404).json({
        success: false,
        message: 'Активная игровая сессия не найдена'
      });
    }
    
    // Получаем текущую историю
    const story = await Story.findById(storyId);
    
    if (!story) {
      transaction.setStatus('failed');
      transaction.finish();
      return res.status(404).json({
        success: false,
        message: 'История не найдена'
      });
    }
    
    // Проверяем, не отвечали ли уже на эту историю
    const alreadyAnswered = gameSession.answers.some(a => a.storyId.toString() === storyId);
    
    if (alreadyAnswered) {
      transaction.setStatus('failed');
      transaction.finish();
      return res.status(400).json({
        success: false,
        message: 'Вы уже ответили на эту историю'
      });
    }
    
    // Проверяем правильность ответа
    const isCorrect = selectedOption === story.correctAnswer;
    
    // Вычисляем очки за ответ
    const pointsEarned = calculateScore(
      isCorrect,
      responseTime,
      gameSession.streak
    );
    
    // Обновляем серию правильных ответов
    let newStreak = gameSession.streak || 0;
    
    if (isCorrect) {
      newStreak += 1;
    } else {
      newStreak = 0;
    }
    
    // Создаем запись ответа
    const answerData = {
      storyId: story._id,
      selectedOption,
      isCorrect,
      responseTime,
      pointsEarned,
      answeredAt: new Date()
    };
    
    // Обновляем игровую сессию
    gameSession.answers.push(answerData);
    gameSession.streak = newStreak;
    gameSession.totalScore += pointsEarned;
    gameSession.currentStory += 1;
    
    // Завершаем игру, если все истории отвечены
    if (gameSession.answers.length >= gameSession.stories.length) {
      gameSession.status = 'completed';
      gameSession.completedAt = new Date();
    }
    
    await gameSession.save();
    
    // Проверяем достижения
    if (isCorrect) {
      if (responseTime <= 3000) {
        // Достижение "Скоростной детектив"
        await checkAchievements(user._id, 'speed');
      }
      
      if (newStreak >= 10) {
        // Достижение "Эксперт"
        await checkAchievements(user._id, 'streak');
      }
    }
    
    // Завершаем транзакцию
    transaction.finish();
    
    // Возвращаем результат
    return res.status(200).json({
      success: true,
      message: 'Ответ успешно отправлен',
      isCorrect,
      pointsEarned,
      explanation: story.explanation,
      gameSession
    });
    
  } catch (error) {
    // Отмечаем транзакцию как неудачную и завершаем её
    transaction.setStatus('error');
    transaction.finish();
    
    // Отправляем ошибку в Sentry
    captureException(error, {
      tags: {
        component: 'gameController',
        method: 'submitAnswer',
        userId: req.user?._id,
        gameId: req.body?.gameId,
        storyId: req.body?.storyId
      }
    });
    
    logger.error(`Error submitting answer: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Ошибка при отправке ответа'
    });
  }
};

/**
 * Завершить текущую игру
 */
exports.finishGame = async (req, res) => {
  // Создаем транзакцию Sentry для отслеживания производительности
  const transaction = startTransaction({
    op: 'game',
    name: 'finish_game'
  });
  
  try {
    const user = req.user;
    const { gameId } = req.body;
    
    if (!gameId) {
      transaction.setStatus('failed');
      transaction.finish();
      return res.status(400).json({
        success: false,
        message: 'Не указан ID игры'
      });
    }
    
    // Получаем игровую сессию
    const gameSession = await GameSession.findOne({
      _id: gameId,
      userId: user._id
    });
    
    if (!gameSession) {
      transaction.setStatus('failed');
      transaction.finish();
      return res.status(404).json({
        success: false,
        message: 'Игровая сессия не найдена'
      });
    }
    
    // Если игра уже завершена, просто возвращаем результаты
    if (gameSession.status === 'completed') {
      // Считаем статистику
      const correctAnswers = gameSession.answers.filter(a => a.isCorrect).length;
      const totalScore = gameSession.totalScore;
      const bestStreak = gameSession.streak;
      
      transaction.finish();
      return res.status(200).json({
        success: true,
        message: 'Игра уже завершена',
        correctAnswers,
        totalScore,
        bestStreak
      });
    }
    
    // Завершаем игру
    gameSession.status = 'completed';
    gameSession.completedAt = new Date();
    await gameSession.save();
    
    // Обновляем статистику пользователя
    const correctAnswers = gameSession.answers.filter(a => a.isCorrect).length;
    const totalScore = gameSession.totalScore;
    
    // Получаем пользователя для обновления
    const userToUpdate = await User.findById(user._id);
    
    // Вычисляем лучшую серию
    const bestStreak = Math.max(userToUpdate.bestStreak || 0, gameSession.streak || 0);
    
    // Обновляем статистику пользователя
    userToUpdate.gamesPlayed += 1;
    userToUpdate.score += totalScore;
    userToUpdate.correctAnswers += correctAnswers;
    userToUpdate.bestStreak = bestStreak;
    userToUpdate.lastPlayed = new Date();
    
    await userToUpdate.save();
    
    // Обновляем рейтинги через leaderboardService
    try {
      await leaderboardService.updateUserLeaderboards(
        user._id, 
        totalScore, 
        userToUpdate.score
      );
    } catch (leaderboardError) {
      logger.error(`Error updating leaderboards: ${leaderboardError.message}`);
      // Не прерываем выполнение в случае ошибки с рейтингами
    }
    
    // Проверяем достижение "Серийный игрок"
    if (userToUpdate.gamesPlayed >= 100) {
      await checkAchievements(user._id, 'serial');
    }
    
    // Проверяем достижение "Мастер дедукции"
    if (correctAnswers === 5) {
      await checkAchievements(user._id, 'master');
    }
    
    // Завершаем транзакцию
    transaction.finish();
    
    return res.status(200).json({
      success: true,
      message: 'Игра успешно завершена',
      correctAnswers,
      totalScore,
      bestStreak: Math.max(bestStreak, gameSession.streak || 0)
    });
    
  } catch (error) {
    // Отмечаем транзакцию как неудачную и завершаем её
    transaction.setStatus('error');
    transaction.finish();
    
    // Отправляем ошибку в Sentry
    captureException(error, {
      tags: {
        component: 'gameController',
        method: 'finishGame',
        userId: req.user?._id,
        gameId: req.body?.gameId
      },
      level: 'fatal' // Критическая ошибка, т.к. может привести к потере прогресса игрока
    });
    
    logger.error(`Error finishing game: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Ошибка при завершении игры'
    });
  }
};

/**
 * Получить текущую активную игровую сессию
 */
exports.getCurrentGame = async (req, res) => {
  // Создаем транзакцию Sentry для отслеживания производительности
  const transaction = startTransaction({
    op: 'game',
    name: 'get_current_game'
  });
  
  try {
    const user = req.user;
    
    // Ищем активную сессию
    const gameSession = await GameSession.findOne({
      userId: user._id,
      status: 'active'
    });
    
    if (!gameSession) {
      transaction.finish();
      return res.status(404).json({
        success: false,
        message: 'Активная игровая сессия не найдена'
      });
    }
    
    // Получаем истории
    const stories = await Story.find({
      _id: { $in: gameSession.stories }
    });
    
    // Завершаем транзакцию
    transaction.finish();
    
    return res.status(200).json({
      success: true,
      message: 'Активная игровая сессия найдена',
      id: gameSession._id,
      stories,
      answers: gameSession.answers,
      currentStory: gameSession.currentStory,
      streak: gameSession.streak,
      totalScore: gameSession.totalScore
    });
    
  } catch (error) {
    // Отмечаем транзакцию как неудачную и завершаем её
    transaction.setStatus('error');
    transaction.finish();
    
    // Отправляем ошибку в Sentry
    captureException(error, {
      tags: {
        component: 'gameController',
        method: 'getCurrentGame',
        userId: req.user?._id
      }
    });
    
    logger.error(`Error getting current game: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Ошибка при получении текущей игры'
    });
  }
};

/**
 * Вспомогательная функция для получения номера недели
 * @param {Date} date - дата
 * @returns {string} - номер недели в формате YYYY-WW
 */
function getWeekNumber(date) {
  // Клонируем дату, чтобы не изменять оригинал
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  
  // Устанавливаем на первый день недели (воскресенье)
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  
  // Получаем первый день года
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  
  // Вычисляем номер недели
  const weekNum = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  
  // Возвращаем в формате YYYY-WW
  return `${d.getUTCFullYear()}-${weekNum.toString().padStart(2, '0')}`;
} 